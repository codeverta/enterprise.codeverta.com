package main

import (
	"context"
	"fmt"
	"gin-template/common"
	"gin-template/middleware"
	"gin-template/model"
	"gin-template/router"
	"gin-template/services"
	"net/http"
	"os"
	"os/signal"
	"reflect"
	"strconv"
	"strings"
	"syscall"
	"time"

	"github.com/gin-contrib/sessions"
	"github.com/gin-contrib/sessions/cookie"
	"github.com/gin-contrib/sessions/redis"
	"github.com/gin-gonic/gin"
	"github.com/gin-gonic/gin/binding"
	"github.com/go-playground/validator/v10"
	"github.com/joho/godotenv"
)

const (
	shutdownTimeout = 10 * time.Second
	readTimeout     = 10 * time.Second
	writeTimeout    = 15 * time.Second
)

func main() {
	// LOAD .ENV
	errEnv := godotenv.Load()
	if errEnv != nil {
		// Jangan fatal, karena mungkin user pakai env sistem (Docker/Kubernetes)
		common.SysLog("Warning: .env file not found or error loading")
	}
	// Setup graceful shutdown
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()
	// Init Logger
	common.InitZapLogger()
	if !strings.EqualFold(os.Getenv("OFFLINE_MODE"), "true") {
		services.InitXenditClient()
	}
	defer common.SyncLogger()
	if err := run(ctx); err != nil {
		common.FatalLog(fmt.Errorf("application failed: %w", err))
		os.Exit(1)
	}
}

func run(ctx context.Context) error {
	printBanner()
	common.SysLog("Gin Template " + common.Version + " starting...")

	// Set Gin mode
	ginMode := os.Getenv("GIN_MODE")
	if ginMode == "" {
		ginMode = "release"
	}
	gin.SetMode(ginMode)
	common.SysLog(fmt.Sprintf("Running in %s mode", ginMode))

	// Initialize database
	common.SysLog("Initializing database connection...")
	if err := model.InitDB(); err != nil {
		return fmt.Errorf("failed to initialize database: %w", err)
	}
	defer func() {
		common.SysLog("Closing database connection...")
		if err := model.CloseDB(); err != nil {
			common.SysLog(fmt.Sprintf("Error closing database: %v", err))
		}
	}()
	common.SysLog("✓ Database connected successfully")

	// Initialize Redis
	common.SysLog("Initializing Redis connection...")
	if err := common.InitRedisClient(); err != nil {
		return fmt.Errorf("failed to initialize Redis: %w", err)
	}
	if common.RedisEnabled {
		common.SysLog("✓ Redis connected successfully")
	} else {
		common.SysLog("⚠ Redis disabled, using in-memory sessions")
	}
	if os.Getenv("DISCORD_WEBHOOK_URL") != "" {
		// Start Discord worker
		go common.StartDiscordWorker()
	}

	// Setup HTTP server
	server := setupServer()

	// Get port
	port := getPort()
	addr := ":" + port
	if strings.EqualFold(os.Getenv("OFFLINE_MODE"), "true") {
		// Never expose a standalone desktop database to the local network.
		addr = "127.0.0.1:" + port
	}

	// Create HTTP server with timeouts
	srv := &http.Server{
		Addr:         addr,
		Handler:      server,
		ReadTimeout:  readTimeout,
		WriteTimeout: writeTimeout,
	}

	// Start server in goroutine
	serverErr := make(chan error, 1)
	go func() {
		displayAddr := addr
		if strings.HasPrefix(displayAddr, ":") {
			displayAddr = "localhost" + displayAddr
		}
		common.SysLog(fmt.Sprintf("🚀 Server starting on http://%s", displayAddr))
		common.SysLog("Press Ctrl+C to shutdown")
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			serverErr <- fmt.Errorf("server error: %w", err)
		}
	}()

	// Wait for interrupt signal or server error
	select {
	case <-ctx.Done():
		common.SysLog("\n⏳ Shutting down gracefully...")
		return gracefulShutdown(srv)
	case err := <-serverErr:
		return err
	}
}

func setupServer() *gin.Engine {
	server := gin.New()
	server.RedirectTrailingSlash = false
	server.RedirectFixedPath = false
	server.SetTrustedProxies([]string{"127.0.0.1"})
	server.ForwardedByClientIP = true

	// Custom middleware
	server.Use(gin.LoggerWithFormatter(func(param gin.LogFormatterParams) string {
		return fmt.Sprintf("[%s] %s %s %d %s %s\n",
			param.TimeStamp.Format("2006-01-02 15:04:05"),
			param.Method,
			param.Path,
			param.StatusCode,
			param.Latency,
			param.ErrorMessage,
		)
	}))
	if v, ok := binding.Validator.Engine().(*validator.Validate); ok {
		v.RegisterTagNameFunc(func(f reflect.StructField) string {
			jsonTag := f.Tag.Get("json")
			if jsonTag == "" {
				return f.Name
			}
			return jsonTag
		})
	}
	server.Use(gin.Recovery())
	server.Use(middleware.CORS())

	// Session store setup
	if common.RedisEnabled {
		common.SysLog("Using Redis session store")
		opt := common.ParseRedisOption()
		store, err := redis.NewStore(opt.MinIdleConns, opt.Network, opt.Addr, opt.Password, []byte(common.SessionSecret))
		if err != nil {
			common.SysLog(fmt.Sprintf("⚠ Failed to create Redis store: %v, falling back to cookie store", err))
			store := cookie.NewStore([]byte(common.SessionSecret))
			server.Use(sessions.Sessions("session", store))
		} else {
			server.Use(sessions.Sessions("session", store))
		}
	} else {
		common.SysLog("Using cookie session store")
		store := cookie.NewStore([]byte(common.SessionSecret))
		server.Use(sessions.Sessions("session", store))
	}

	// Health check endpoint
	server.GET("/health", func(c *gin.Context) {
		loc, _ := time.LoadLocation("Asia/Jakarta")
		c.JSON(http.StatusOK, gin.H{
			"status":  "healthy",
			"version": common.Version,
			"time":    time.Now().UTC().In(loc).Format("2006-01-02 15:04:05 MST"),
		})
	})

	if !strings.EqualFold(os.Getenv("OFFLINE_MODE"), "true") {
		// Network-backed workers are intentionally disabled for standalone desktop installs.
		go services.StartEmailWorker()
		go services.StartOrderReservationCleanupWorker(model.DB)
		go services.StartDailyResetWorker()
		go services.StartBulkEmailWorker()
	}
	// Web Socket
	// Setup API routes only
	router.SetApiRouter(server, model.DB)

	return server
}

func gracefulShutdown(srv *http.Server) error {
	ctx, cancel := context.WithTimeout(context.Background(), shutdownTimeout)
	defer cancel()

	if err := srv.Shutdown(ctx); err != nil {
		return fmt.Errorf("server forced to shutdown: %w", err)
	}

	common.SysLog("✓ Server stopped gracefully")
	return nil
}

func getPort() string {
	port := os.Getenv("PORT")
	if port == "" {
		if common.Port != nil {
			port = strconv.Itoa(*common.Port)
		} else {
			port = "3000" // Default port
		}
	}
	return port
}

func printBanner() {
	banner := `
╔═══════════════════════════════════════╗
║        GIN TEMPLATE SERVER            ║
║                                       ║
║  Version: %-28s║
╚═══════════════════════════════════════╝
`
	fmt.Printf(banner, common.Version)
}
