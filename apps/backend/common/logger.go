package common

import (
	"fmt"
	"os"
	"strings"

	"go.uber.org/zap"
	"go.uber.org/zap/zapcore"
	"gopkg.in/natefinch/lumberjack.v2"
)

// Logger is the global Zap logger instance
var Logger *zap.Logger

// InitZapLogger initializes the Zap logger
func InitZapLogger() {
	ginMode := strings.ToLower(os.Getenv("GIN_MODE"))
	var core zapcore.Core
	var err error

	// Konfigurasi Encoder Time (ISO8601) agar sama untuk Dev & Prod
	encoderConfig := zap.NewProductionEncoderConfig()
	encoderConfig.EncodeTime = zapcore.ISO8601TimeEncoder

	if ginMode == "debug" || ginMode == "test" || ginMode == "" {
		// --- DEVELOPMENT CONFIG ---
		config := zap.NewDevelopmentConfig()
		config.EncoderConfig.EncodeLevel = zapcore.CapitalColorLevelEncoder
		config.EncoderConfig.EncodeTime = zapcore.ISO8601TimeEncoder
		config.Level.SetLevel(zapcore.DebugLevel)

		// Hapus ":=" agar tidak membuat variabel baru (shadowing), tapi isi ke variabel global Logger
		Logger, err = config.Build()
		if err != nil {
			panic(err)
		}
	} else {
		// --- PRODUCTION CONFIG ---
		rotator := &lumberjack.Logger{
			Filename:   "./logs/app.log",
			MaxSize:    10,
			MaxBackups: 5,
			MaxAge:     30,
			Compress:   true,
		}

		encoder := zapcore.NewJSONEncoder(encoderConfig)

		// MultiWriteSyncer: Tulis ke File DAN Console
		writeSyncer := zapcore.NewMultiWriteSyncer(
			zapcore.AddSync(rotator),
			zapcore.AddSync(os.Stdout),
		)

		core = zapcore.NewCore(encoder, writeSyncer, zapcore.InfoLevel)
		Logger = zap.New(core, zap.AddCaller())
	}

	// 🔥🔥🔥 FIX UTAMA ADA DISINI 🔥🔥🔥
	// Ini memerintahkan Zap: "Hei, pakai logger yang baru kubuat ini sebagai zap.L() di seluruh aplikasi"
	zap.ReplaceGlobals(Logger)
}

// SyncLogger flushes any buffered log entries.
func SyncLogger() {
	if Logger != nil {
		_ = Logger.Sync()
	}
}

// --- Wrapper Functions (Agar tidak double print) ---

func SysLog(msg string) {
	// Cek logger dulu, kalau ada pakai logger, kalau tidak pakai fmt
	if Logger != nil {
		Logger.Info(msg)
	} else {
		fmt.Println(msg)
	}
}

func FatalLog(err error) {
	if Logger != nil {
		Logger.Fatal(err.Error())
	} else {
		fmt.Printf("[FATAL] %s\n", err.Error())
		os.Exit(1)
	}
}

func SysError(msg string) {
	if Logger != nil {
		Logger.Error(msg)
	} else {
		fmt.Printf("[ERROR] %s\n", msg)
	}
}
