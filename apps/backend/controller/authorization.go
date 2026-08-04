package controller

import (
	"net/http"
	"strings"

	"gin-template/model"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

type AuthorizationController struct{}

func NewAuthorizationController() *AuthorizationController { return &AuthorizationController{} }
func authTenantID(c *gin.Context) (uuid.UUID, bool) {
	id, err := uuid.Parse(c.GetString("tenant_id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid tenant"})
		return uuid.Nil, false
	}
	return id, true
}
func authID(c *gin.Context) (uuid.UUID, bool) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid id"})
		return uuid.Nil, false
	}
	return id, true
}
func authErr(c *gin.Context, err error) {
	if err == gorm.ErrRecordNotFound {
		c.JSON(http.StatusNotFound, gin.H{"error": "record not found"})
		return
	}
	if strings.Contains(strings.ToLower(err.Error()), "duplicate") || strings.Contains(strings.ToLower(err.Error()), "unique") {
		c.JSON(http.StatusConflict, gin.H{"error": "name already exists"})
		return
	}
	c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
}

func (a *AuthorizationController) ListRoles(c *gin.Context) {
	var rows []model.RoleDefinition
	if err := model.GetDB(c).Preload("Permissions").Order("name").Find(&rows).Error; err != nil {
		authErr(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": rows})
}
func (a *AuthorizationController) GetRole(c *gin.Context) {
	id, ok := authID(c)
	if !ok {
		return
	}
	var row model.RoleDefinition
	if err := model.GetDB(c).Preload("Permissions").First(&row, "id = ?", id).Error; err != nil {
		authErr(c, err)
		return
	}
	c.JSON(http.StatusOK, row)
}
func preparePermissions(role *model.RoleDefinition, tenantID uuid.UUID) {
	for i := range role.Permissions {
		role.Permissions[i].ID = uuid.Nil
		role.Permissions[i].RoleID = role.ID
		role.Permissions[i].TenantID = tenantID
	}
}
func (a *AuthorizationController) CreateRole(c *gin.Context) {
	tenantID, ok := authTenantID(c)
	if !ok {
		return
	}
	var row model.RoleDefinition
	if err := c.ShouldBindJSON(&row); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	row.ID = uuid.New()
	row.TenantID = tenantID
	row.IsCustom = true
	permissions := row.Permissions
	row.Permissions = nil
	db := model.GetDB(c)
	err := db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Create(&row).Error; err != nil {
			return err
		}
		row.Permissions = permissions
		preparePermissions(&row, tenantID)
		if len(row.Permissions) > 0 {
			return tx.Create(&row.Permissions).Error
		}
		return nil
	})
	if err != nil {
		authErr(c, err)
		return
	}
	c.JSON(http.StatusCreated, row)
}
func (a *AuthorizationController) UpdateRole(c *gin.Context) {
	id, ok := authID(c)
	if !ok {
		return
	}
	var input, existing model.RoleDefinition
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	db := model.GetDB(c)
	if err := db.First(&existing, "id = ?", id).Error; err != nil {
		authErr(c, err)
		return
	}
	input.ID, input.TenantID, input.CreatedAt, input.IsCustom = existing.ID, existing.TenantID, existing.CreatedAt, existing.IsCustom
	permissions := input.Permissions
	input.Permissions = nil
	err := db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Omit("Permissions").Save(&input).Error; err != nil {
			return err
		}
		if err := tx.Where("role_id = ?", id).Delete(&model.RolePermission{}).Error; err != nil {
			return err
		}
		input.Permissions = permissions
		preparePermissions(&input, input.TenantID)
		if len(input.Permissions) > 0 {
			return tx.Create(&input.Permissions).Error
		}
		return nil
	})
	if err != nil {
		authErr(c, err)
		return
	}
	c.JSON(http.StatusOK, input)
}
func (a *AuthorizationController) DeleteRole(c *gin.Context) {
	id, ok := authID(c)
	if !ok {
		return
	}
	db := model.GetDB(c)
	var row model.RoleDefinition
	if err := db.First(&row, "id = ?", id).Error; err != nil {
		authErr(c, err)
		return
	}
	if !row.IsCustom {
		c.JSON(http.StatusConflict, gin.H{"error": "standard roles cannot be deleted; disable them instead"})
		return
	}
	if err := db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Where("role_id = ?", id).Delete(&model.RolePermission{}).Error; err != nil {
			return err
		}
		if err := tx.Where("role_id = ?", id).Delete(&model.UserRoleAssignment{}).Error; err != nil {
			return err
		}
		return tx.Delete(&row).Error
	}); err != nil {
		authErr(c, err)
		return
	}
	c.Status(http.StatusNoContent)
}

type profileInput struct {
	model.RoleProfile
	RoleIDs []uuid.UUID `json:"role_ids"`
}

func (a *AuthorizationController) ListProfiles(c *gin.Context) {
	var rows []model.RoleProfile
	if err := model.GetDB(c).Preload("Roles").Order("name").Find(&rows).Error; err != nil {
		authErr(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": rows})
}
func saveProfileRoles(tx *gorm.DB, row *model.RoleProfile, ids []uuid.UUID) error {
	var roles []model.RoleDefinition
	if len(ids) > 0 {
		if err := tx.Where("id IN ?", ids).Find(&roles).Error; err != nil {
			return err
		}
	}
	return tx.Model(row).Association("Roles").Replace(roles)
}
func (a *AuthorizationController) CreateProfile(c *gin.Context) {
	tenantID, ok := authTenantID(c)
	if !ok {
		return
	}
	var input profileInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	input.ID = uuid.New()
	input.TenantID = tenantID
	db := model.GetDB(c)
	if err := db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Omit("Roles").Create(&input.RoleProfile).Error; err != nil {
			return err
		}
		return saveProfileRoles(tx, &input.RoleProfile, input.RoleIDs)
	}); err != nil {
		authErr(c, err)
		return
	}
	c.JSON(http.StatusCreated, input.RoleProfile)
}
func (a *AuthorizationController) UpdateProfile(c *gin.Context) {
	id, ok := authID(c)
	if !ok {
		return
	}
	var input profileInput
	var existing model.RoleProfile
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	db := model.GetDB(c)
	if err := db.First(&existing, "id = ?", id).Error; err != nil {
		authErr(c, err)
		return
	}
	input.ID, input.TenantID, input.CreatedAt = existing.ID, existing.TenantID, existing.CreatedAt
	if err := db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Omit("Roles").Save(&input.RoleProfile).Error; err != nil {
			return err
		}
		return saveProfileRoles(tx, &input.RoleProfile, input.RoleIDs)
	}); err != nil {
		authErr(c, err)
		return
	}
	c.JSON(http.StatusOK, input.RoleProfile)
}
func (a *AuthorizationController) DeleteProfile(c *gin.Context) {
	id, ok := authID(c)
	if !ok {
		return
	}
	db := model.GetDB(c)
	var row model.RoleProfile
	if err := db.First(&row, "id = ?", id).Error; err != nil {
		authErr(c, err)
		return
	}
	if err := db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Model(&row).Association("Roles").Clear(); err != nil {
			return err
		}
		if err := tx.Where("role_profile_id = ?", id).Delete(&model.UserRoleProfileAssignment{}).Error; err != nil {
			return err
		}
		return tx.Delete(&row).Error
	}); err != nil {
		authErr(c, err)
		return
	}
	c.Status(http.StatusNoContent)
}

type assignmentInput struct {
	RoleIDs    []uuid.UUID `json:"role_ids"`
	ProfileIDs []uuid.UUID `json:"profile_ids"`
}

func (a *AuthorizationController) GetAssignments(c *gin.Context) {
	userID, ok := authID(c)
	if !ok {
		return
	}
	var roles []model.UserRoleAssignment
	var profiles []model.UserRoleProfileAssignment
	db := model.GetDB(c)
	if err := db.Preload("Role").Where("user_id = ?", userID).Find(&roles).Error; err != nil {
		authErr(c, err)
		return
	}
	_ = db.Where("user_id = ?", userID).Find(&profiles).Error
	c.JSON(http.StatusOK, gin.H{"roles": roles, "profiles": profiles})
}
func (a *AuthorizationController) SetAssignments(c *gin.Context) {
	userID, ok := authID(c)
	if !ok {
		return
	}
	tenantID, ok := authTenantID(c)
	if !ok {
		return
	}
	var input assignmentInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	db := model.GetDB(c)
	err := db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Where("user_id = ?", userID).Delete(&model.UserRoleAssignment{}).Error; err != nil {
			return err
		}
		if err := tx.Where("user_id = ?", userID).Delete(&model.UserRoleProfileAssignment{}).Error; err != nil {
			return err
		}
		for _, roleID := range input.RoleIDs {
			if err := tx.Create(&model.UserRoleAssignment{TenantID: tenantID, UserID: userID, RoleID: roleID}).Error; err != nil {
				return err
			}
		}
		for _, profileID := range input.ProfileIDs {
			if err := tx.Create(&model.UserRoleProfileAssignment{TenantID: tenantID, UserID: userID, RoleProfileID: profileID}).Error; err != nil {
				return err
			}
		}
		return nil
	})
	if err != nil {
		authErr(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true})
}

func (a *AuthorizationController) MyPermissions(c *gin.Context) {
	userID, ok := c.Get("userID")
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}
	id := userID.(uuid.UUID)
	db := model.GetDB(c)
	var assignments []model.UserRoleAssignment
	_ = db.Preload("Role.Permissions").Where("user_id = ?", id).Find(&assignments).Error
	var profileAssignments []model.UserRoleProfileAssignment
	_ = db.Where("user_id = ?", id).Find(&profileAssignments).Error
	profileIDs := make([]uuid.UUID, 0, len(profileAssignments))
	for _, assignment := range profileAssignments {
		profileIDs = append(profileIDs, assignment.RoleProfileID)
	}
	var profiles []model.RoleProfile
	if len(profileIDs) > 0 {
		_ = db.Preload("Roles.Permissions").Where("id IN ? AND enabled = ?", profileIDs, true).Find(&profiles).Error
	}
	c.JSON(http.StatusOK, gin.H{"legacy_admin": c.GetInt("role") >= 99, "assignments": assignments, "profiles": profiles})
}
