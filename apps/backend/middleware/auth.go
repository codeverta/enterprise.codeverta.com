package middleware

import (
	"gin-template/common"
	"gin-template/model"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

// Claims mirrors controller/auth.go Claims — both MUST stay in sync.
type Claims struct {
	UserId                 string `json:"id"`
	Username               string `json:"username"`
	Role                   int    `json:"role"`
	TokenVersion           string `json:"token_version"`
	ImpersonatorID         string `json:"impersonator_id,omitempty"`
	ImpersonatorRole       int    `json:"impersonator_role,omitempty"`
	ImpersonationSessionID string `json:"impersonation_session_id,omitempty"`
	jwt.RegisteredClaims
}

func validateImpersonationClaims(c *gin.Context, db *gorm.DB, claims *Claims, user *model.User) bool {
	if claims.ImpersonationSessionID == "" {
		return true
	}
	sessionID, err := uuid.Parse(claims.ImpersonationSessionID)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"success": false, "message": "Unauthorized: Invalid impersonation session"})
		c.Abort()
		return false
	}
	session, actor, err := model.ValidateActiveImpersonationSession(db, sessionID, user.ID)
	if err != nil || session.ImpersonatorID.String() != claims.ImpersonatorID || user.Role != claims.Role {
		c.JSON(http.StatusUnauthorized, gin.H{"success": false, "message": "Impersonation session has expired or was revoked"})
		c.Abort()
		return false
	}
	c.Set("impersonator_id", actor.ID.String())
	c.Set("impersonator_role", actor.Role)
	c.Set("impersonation_session_id", session.ID.String())
	return true
}

func authHelper(c *gin.Context, minRole int) {
	// 1. Ambil Header Authorization
	authHeader := c.GetHeader("Authorization")
	if c.Request.Method == http.MethodOptions {
		c.Next()
		return
	}
	if authHeader == "" {
		c.JSON(http.StatusUnauthorized, gin.H{
			"success": false,
			"message": "Unauthorized: No token provided",
		})
		c.Abort()
		return
	}

	// 2. Format harus "Bearer <token>"
	parts := strings.SplitN(authHeader, " ", 2)
	if len(parts) != 2 || parts[0] != "Bearer" {
		c.JSON(http.StatusUnauthorized, gin.H{
			"success": false,
			"message": "Unauthorized: Invalid token format",
		})
		c.Abort()
		return
	}

	tokenString := parts[1]

	// 3. Parse dan Validasi Token
	claims := &Claims{}
	token, err := jwt.ParseWithClaims(tokenString, claims, func(token *jwt.Token) (interface{}, error) {
		return []byte(common.JWTSecret), nil
	})

	// Cek error parsing atau token tidak valid
	if err != nil || !token.Valid {
		c.JSON(http.StatusUnauthorized, gin.H{
			"success": false,
			"message": "Unauthorized: Invalid or expired token",
		})
		c.Abort()
		return
	}

	// 4. Cek Role (Authorization)
	if claims.Role < minRole {
		c.JSON(http.StatusForbidden, gin.H{
			"success": false,
			"message": "Forbidden: Insufficient permissions",
		})
		c.Abort()
		return
	}
	userID, err := uuid.Parse(claims.UserId)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"success": false, "message": "Unauthorized: Invalid token subject"})
		c.Abort()
		return
	}
	var user model.User
	db := model.GetDB(c)
	if _, exists := c.Get("db"); !exists {
		db = db.Set("skip_tenant_scope", true)
	}

	if err := db.Select("id", "status").First(&user, "id = ?", userID).Error; err != nil || user.Status == common.UserStatusDisabled {
		c.JSON(http.StatusForbidden, gin.H{
			"success": false,
			"message": "Your account has been deactivated. Please contact administrator.",
		})
		c.Abort()
		return
	}
	// The signed claim remains the backward-compatible legacy role source.
	// Dynamic assignments are resolved separately from the database.
	user.Role = claims.Role
	if !validateImpersonationClaims(c, db, claims, &user) {
		return
	}

	// 5. Set Context untuk digunakan di Controller
	c.Set("id", claims.UserId)
	c.Set("userID", userID)
	c.Set("username", claims.Username)
	c.Set("role", claims.Role)

	c.Next()
}

// UserAuth: Middleware untuk User biasa ke atas
func UserAuth() func(c *gin.Context) {
	return func(c *gin.Context) {
		authHelper(c, common.RoleCommonUser)
	}
}

// MentorAuth allows mentors and higher roles, as well as parents with course-creation permissions.
func MentorAuth() func(c *gin.Context) {
	return func(c *gin.Context) {
		authHeader := c.GetHeader("Authorization")
		if c.Request.Method == http.MethodOptions {
			c.Next()
			return
		}
		if authHeader == "" {
			c.JSON(http.StatusUnauthorized, gin.H{"success": false, "message": "Unauthorized: No token provided"})
			c.Abort()
			return
		}
		parts := strings.SplitN(authHeader, " ", 2)
		if len(parts) != 2 || parts[0] != "Bearer" {
			c.JSON(http.StatusUnauthorized, gin.H{"success": false, "message": "Unauthorized: Invalid token format"})
			c.Abort()
			return
		}
		tokenString := parts[1]
		claims := &Claims{}
		token, err := jwt.ParseWithClaims(tokenString, claims, func(token *jwt.Token) (interface{}, error) {
			return []byte(common.JWTSecret), nil
		})
		if err != nil || !token.Valid {
			c.JSON(http.StatusUnauthorized, gin.H{"success": false, "message": "Unauthorized: Invalid or expired token"})
			c.Abort()
			return
		}

		userID, err := uuid.Parse(claims.UserId)
		if err != nil {
			c.JSON(http.StatusUnauthorized, gin.H{"success": false, "message": "Unauthorized: Invalid token subject"})
			c.Abort()
			return
		}

		db := model.GetDB(c)
		if _, exists := c.Get("db"); !exists {
			db = db.Set("skip_tenant_scope", true)
		}

		var user model.User
		if err := db.Select("id", "role", "status").First(&user, "id = ?", userID).Error; err != nil || user.Status == common.UserStatusDisabled {
			c.JSON(http.StatusForbidden, gin.H{"success": false, "message": "Your account has been deactivated. Please contact administrator."})
			c.Abort()
			return
		}
		if !validateImpersonationClaims(c, db, claims, &user) {
			return
		}

		allowed := false
		if claims.Role == model.RoleMentor || claims.Role >= model.RoleAdmin {
			allowed = true
		} else if claims.Role == model.RoleParent || claims.Role == model.RoleGuruExternal {
			rules, plan, err := model.GetCourseSellerActiveRules(db, userID, claims.Role)
			if err == nil && rules != nil && plan != nil {
				if c.GetBool("require_seller_finance") {
					if claims.Role == model.RoleParent && !model.IsParentExternalPlan(plan) {
						allowed = false
					} else {
						requirementsMet, reason, requirementErr := model.CheckCourseSellerRequirements(db, userID, rules, plan)
						if requirementErr != nil {
							c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "Gagal memeriksa akses keuangan"})
							c.Abort()
							return
						}
						allowed = requirementsMet
						if !requirementsMet {
							c.JSON(http.StatusForbidden, gin.H{"success": false, "message": "Syarat akses keuangan belum terpenuhi", "reason": reason})
							c.Abort()
							return
						}
					}
				} else {
					requirementsMet, _, requirementErr := model.CheckCourseCreationRequirements(db, userID, rules, plan)
					if requirementErr != nil {
						c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "Gagal memeriksa akses course"})
						c.Abort()
						return
					}
					allowed = requirementsMet
				}
			}
		}

		// Allow read-only (GET) access to guide-categories for all authenticated users
		if !allowed && c.Request.Method == http.MethodGet {
			resParam := c.Param("resource")
			if resParam == "guide-categories" {
				allowed = true
			}
		}

		if !allowed {
			c.JSON(http.StatusForbidden, gin.H{"success": false, "message": "Forbidden: Insufficient permissions"})
			c.Abort()
			return
		}

		c.Set("id", claims.UserId)
		c.Set("userID", userID)
		c.Set("username", claims.Username)
		c.Set("role", claims.Role)
		c.Next()
	}
}

// AdminAuth: Middleware untuk Admin ke atas
func AdminAuth() func(c *gin.Context) {
	return func(c *gin.Context) {
		authHelper(c, common.RoleCommonUser)
		if c.IsAborted() {
			return
		}
		if c.GetInt("role") >= common.RoleAdminUser {
			return
		}
		userID, ok := c.Get("userID")
		id, valid := userID.(uuid.UUID)
		if !ok || !valid || !model.UserHasPermission(model.GetDB(c), id, c.Request.URL.Path, permissionAction(c.Request.Method), "") || !model.UserHasPermission(model.GetDB(c), id, c.Request.URL.Path, "api", "") {
			c.JSON(http.StatusForbidden, gin.H{"success": false, "message": "Forbidden: Dynamic role permission denied"})
			c.Abort()
		}
	}
}

func permissionAction(method string) string {
	switch method {
	case http.MethodGet, http.MethodHead:
		return "read"
	case http.MethodPost:
		return "create"
	case http.MethodPut, http.MethodPatch:
		return "update"
	case http.MethodDelete:
		return "delete"
	}
	return "api"
}

// RequirePermission can protect new endpoints with an explicit logical resource.
// Legacy Admin/Superadmin users always remain allowed for backward compatibility.
func RequirePermission(resource string) gin.HandlerFunc {
	return func(c *gin.Context) {
		authHelper(c, common.RoleCommonUser)
		if c.IsAborted() || c.GetInt("role") >= common.RoleAdminUser {
			return
		}
		id, ok := c.MustGet("userID").(uuid.UUID)
		if !ok || !model.UserHasPermission(model.GetDB(c), id, resource, permissionAction(c.Request.Method), "") {
			c.JSON(http.StatusForbidden, gin.H{"success": false, "message": "Forbidden: Permission denied", "resource": resource})
			c.Abort()
			return
		}
	}
}

// RequireFieldPermission is available for handlers that expose sensitive fields.
func RequireFieldPermission(resource, field string) gin.HandlerFunc {
	return func(c *gin.Context) {
		authHelper(c, common.RoleCommonUser)
		if c.IsAborted() || c.GetInt("role") >= common.RoleAdminUser {
			return
		}
		id, ok := c.MustGet("userID").(uuid.UUID)
		if !ok || !model.UserHasPermission(model.GetDB(c), id, resource, permissionAction(c.Request.Method), field) {
			c.JSON(http.StatusForbidden, gin.H{"success": false, "message": "Forbidden: Field permission denied", "resource": resource, "field": field})
			c.Abort()
		}
	}
}

// FinanceAuth allows mentors/admins and fully-qualified parent-external sellers.
func FinanceAuth() func(c *gin.Context) {
	mentorAuth := MentorAuth()
	return func(c *gin.Context) {
		c.Set("require_seller_finance", true)
		mentorAuth(c)
	}
}

// RootAuth: Middleware untuk Root only
func RootAuth() func(c *gin.Context) {
	return func(c *gin.Context) {
		authHelper(c, common.RoleRootUser)
	}
}

// PassiveAuth: Coba cek token. Jika valid set context, jika tidak valid/kosong biarkan lanjut (sebagai guest).
func PassiveAuth() gin.HandlerFunc {
	return func(c *gin.Context) {
		authHeader := c.GetHeader("Authorization")

		// Jika tidak ada header, lanjut sebagai guest
		if authHeader == "" {
			c.Next()
			return
		}

		parts := strings.SplitN(authHeader, " ", 2)
		if len(parts) != 2 || parts[0] != "Bearer" {
			c.Next() // Format salah, anggap guest
			return
		}

		tokenString := parts[1]
		claims := &Claims{}

		// Parse token
		token, err := jwt.ParseWithClaims(tokenString, claims, func(token *jwt.Token) (interface{}, error) {
			return []byte(common.JWTSecret), nil
		})

		// Jika token valid, set context
		if err == nil && token.Valid {
			if claims.ImpersonationSessionID != "" {
				userID, userErr := uuid.Parse(claims.UserId)
				sessionID, sessionErr := uuid.Parse(claims.ImpersonationSessionID)
				if userErr != nil || sessionErr != nil {
					c.Next()
					return
				}
				db := model.GetDB(c)
				var user model.User
				if userErr := db.Select("id", "role", "status").First(&user, "id = ?", userID).Error; userErr != nil || user.Status == common.UserStatusDisabled {
					c.Next()
					return
				}
				session, actor, validationErr := model.ValidateActiveImpersonationSession(db, sessionID, userID)
				if validationErr != nil || session.ImpersonatorID.String() != claims.ImpersonatorID || user.Role != claims.Role {
					c.Next()
					return
				}
				c.Set("impersonator_id", actor.ID.String())
				c.Set("impersonator_role", actor.Role)
				c.Set("impersonation_session_id", session.ID.String())
			}
			c.Set("id", claims.UserId)
			if userID, parseErr := uuid.Parse(claims.UserId); parseErr == nil {
				c.Set("userID", userID)
			}
			c.Set("username", claims.Username)
			c.Set("role", claims.Role)
		}

		// Lanjut ke controller (baik berhasil auth maupun gagal auth)
		c.Next()
	}
}
