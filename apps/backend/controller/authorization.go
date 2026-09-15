package controller

import (
	"fmt"
	"net/http"
	"sort"
	"strings"

	"gin-template/model"
	framework "gin-template/modules/framework"

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

func findRole(db *gorm.DB, identifier string, row *model.RoleDefinition) error {
	if _, err := uuid.Parse(identifier); err == nil {
		return db.Preload("Permissions").Where("id = ? OR name = ?", identifier, identifier).First(row).Error
	}
	return db.Preload("Permissions").Where("name = ?", identifier).First(row).Error
}

func (a *AuthorizationController) ListRoles(c *gin.Context) {
	db := model.GetDB(c)
	var count int64
	db.Model(&model.RoleDefinition{}).Count(&count)
	if count == 0 {
		_ = model.SeedDefaultRoles(db)
	}
	var rows []model.RoleDefinition
	if err := db.Preload("Permissions").Order("name ASC").Find(&rows).Error; err != nil {
		authErr(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": rows})
}
func (a *AuthorizationController) GetRole(c *gin.Context) {
	identifier := c.Param("id")
	if identifier == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "id or role name is required"})
		return
	}
	var row model.RoleDefinition
	if err := findRole(model.GetDB(c), identifier, &row); err != nil {
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
	if row.Name == "" && row.RoleName != "" {
		row.Name = row.RoleName
	}
	if row.RoleName == "" && row.Name != "" {
		row.RoleName = row.Name
	}
	if row.Disabled {
		row.Enabled = false
	} else {
		row.Enabled = true
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
	identifier := c.Param("id")
	if identifier == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "id or role name is required"})
		return
	}
	var input, existing model.RoleDefinition
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	db := model.GetDB(c)
	if err := findRole(db, identifier, &existing); err != nil {
		authErr(c, err)
		return
	}
	if input.RoleName != "" && input.Name == "" {
		input.Name = input.RoleName
	}
	if input.Name != "" && input.RoleName == "" {
		input.RoleName = input.Name
	}
	if input.Disabled {
		input.Enabled = false
	} else {
		input.Enabled = true
	}
	input.ID, input.TenantID, input.CreatedAt, input.IsCustom = existing.ID, existing.TenantID, existing.CreatedAt, existing.IsCustom
	permissions := input.Permissions
	input.Permissions = nil
	err := db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Omit("Permissions").Save(&input).Error; err != nil {
			return err
		}
		if err := tx.Where("role_id = ?", existing.ID).Delete(&model.RolePermission{}).Error; err != nil {
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
	identifier := c.Param("id")
	if identifier == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "id or role name is required"})
		return
	}
	db := model.GetDB(c)
	var row model.RoleDefinition
	if err := findRole(db, identifier, &row); err != nil {
		authErr(c, err)
		return
	}
	if !row.IsCustom {
		c.JSON(http.StatusConflict, gin.H{"error": "standard roles cannot be deleted; disable them instead"})
		return
	}
	if err := db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Where("role_id = ?", row.ID).Delete(&model.RolePermission{}).Error; err != nil {
			return err
		}
		if err := tx.Where("role_id = ?", row.ID).Delete(&model.UserRoleAssignment{}).Error; err != nil {
			return err
		}
		return tx.Delete(&row).Error
	}); err != nil {
		authErr(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "role deleted"})
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

var standardDocTypes = []string{
	"Address",
	"Attendance",
	"Blanket Order",
	"Branch",
	"Campaign",
	"Company",
	"Contact",
	"Customer",
	"Customer Group",
	"Delivery Note",
	"Delivery Trip",
	"Department",
	"Employee",
	"Employee Onboarding",
	"Item",
	"Item Group",
	"Item Price",
	"Journal Entry",
	"Landed Cost Voucher",
	"Lead",
	"Letter Head",
	"Material Request",
	"Opportunity",
	"Payment Entry",
	"Pick List",
	"POS Closing Entry",
	"POS Invoice",
	"POS Opening Entry",
	"POS Profile",
	"Price List",
	"Pricing Rule",
	"Project",
	"Purchase Invoice",
	"Purchase Order",
	"Purchase Receipt",
	"Quotation",
	"Role",
	"Sales Invoice",
	"Sales Order",
	"Sales Partner",
	"Stock Entry",
	"Stock Reconciliation",
	"Supplier",
	"Supplier Quotation",
	"Task",
	"Territory",
	"Timesheet",
	"User",
	"Warehouse",
}

func (a *AuthorizationController) ListPermissions(c *gin.Context) {
	db := model.GetDB(c)
	query := db.Preload("Role")
	if dt := strings.TrimSpace(c.Query("doctype")); dt != "" {
		query = query.Where("resource = ?", dt)
	}
	if roleID := strings.TrimSpace(c.Query("role_id")); roleID != "" {
		query = query.Where("role_id = ?", roleID)
	}
	if roleName := strings.TrimSpace(c.Query("role")); roleName != "" {
		query = query.Joins("JOIN role_definitions ON role_definitions.id = role_permissions.role_id").Where("role_definitions.name = ?", roleName)
	}
	if level := strings.TrimSpace(c.Query("level")); level != "" {
		query = query.Where("level = ?", level)
	}
	var rows []model.RolePermission
	if err := query.Order("resource ASC, level ASC, created_at ASC").Find(&rows).Error; err != nil {
		authErr(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": rows})
}

type createPermissionInput struct {
	RoleID        *uuid.UUID `json:"role_id"`
	RoleName      string     `json:"role_name"`
	Resource      string     `json:"resource"`
	Level         int        `json:"level"`
	OnlyIfCreator bool       `json:"only_if_creator"`
	CanSelect     bool       `json:"can_select"`
	CanRead       bool       `json:"can_read"`
	CanWrite      bool       `json:"can_write"`
	CanCreate     bool       `json:"can_create"`
	CanDelete     bool       `json:"can_delete"`
	CanSubmit     bool       `json:"can_submit"`
	CanCancel     bool       `json:"can_cancel"`
	CanAmend      bool       `json:"can_amend"`
	CanPrint      bool       `json:"can_print"`
	CanEmail      bool       `json:"can_email"`
	CanReport     bool       `json:"can_report"`
	CanImport     bool       `json:"can_import"`
	CanExport     bool       `json:"can_export"`
	CanShare      bool       `json:"can_share"`
	CanMask       bool       `json:"can_mask"`
	AllowMenu     bool       `json:"allow_menu"`
	AllowPage     bool       `json:"allow_page"`
	AllowAPI      bool       `json:"allow_api"`
}

func (a *AuthorizationController) CreatePermission(c *gin.Context) {
	tenantID, ok := authTenantID(c)
	if !ok {
		return
	}
	var input createPermissionInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	input.Resource = strings.TrimSpace(input.Resource)
	if input.Resource == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Document Type wajib diisi"})
		return
	}
	db := model.GetDB(c)
	var role model.RoleDefinition
	if input.RoleID != nil && *input.RoleID != uuid.Nil {
		if err := db.First(&role, "id = ?", *input.RoleID).Error; err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Role tidak ditemukan"})
			return
		}
	} else if input.RoleName != "" {
		if err := db.Where("name = ?", input.RoleName).First(&role).Error; err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Role tidak ditemukan"})
			return
		}
	} else {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Role wajib dipilih"})
		return
	}

	var existing model.RolePermission
	if err := db.Where("role_id = ? AND resource = ? AND level = ?", role.ID, input.Resource, input.Level).First(&existing).Error; err == nil {
		c.JSON(http.StatusConflict, gin.H{"error": fmt.Sprintf("Permission rule untuk role %s dan doctype %s level %d sudah ada", role.Name, input.Resource, input.Level)})
		return
	}

	canUpdate := input.CanWrite
	perm := model.RolePermission{
		ID:            uuid.New(),
		TenantID:      tenantID,
		RoleID:        role.ID,
		Resource:      input.Resource,
		Level:         input.Level,
		OnlyIfCreator: input.OnlyIfCreator,
		CanSelect:     input.CanSelect,
		CanRead:       input.CanRead,
		CanCreate:     input.CanCreate,
		CanUpdate:     canUpdate,
		CanDelete:     input.CanDelete,
		CanSubmit:     input.CanSubmit,
		CanCancel:     input.CanCancel,
		CanAmend:      input.CanAmend,
		CanPrint:      input.CanPrint,
		CanEmail:      input.CanEmail,
		CanReport:     input.CanReport,
		CanImport:     input.CanImport,
		CanExport:     input.CanExport,
		CanShare:      input.CanShare,
		CanMask:       input.CanMask,
		AllowMenu:     input.AllowMenu || input.CanRead,
		AllowPage:     input.AllowPage || input.CanRead,
		AllowAPI:      input.AllowAPI,
		FieldRead:     true,
		FieldWrite:    true,
	}
	if err := db.Create(&perm).Error; err != nil {
		authErr(c, err)
		return
	}
	perm.Role = role
	c.JSON(http.StatusCreated, gin.H{"data": perm})
}

type updatePermissionInput struct {
	Level         *int  `json:"level"`
	OnlyIfCreator *bool `json:"only_if_creator"`
	CanSelect     *bool `json:"can_select"`
	CanRead       *bool `json:"can_read"`
	CanWrite      *bool `json:"can_write"`
	CanUpdate     *bool `json:"can_update"`
	CanCreate     *bool `json:"can_create"`
	CanDelete     *bool `json:"can_delete"`
	CanSubmit     *bool `json:"can_submit"`
	CanCancel     *bool `json:"can_cancel"`
	CanAmend      *bool `json:"can_amend"`
	CanPrint      *bool `json:"can_print"`
	CanEmail      *bool `json:"can_email"`
	CanReport     *bool `json:"can_report"`
	CanImport     *bool `json:"can_import"`
	CanExport     *bool `json:"can_export"`
	CanShare      *bool `json:"can_share"`
	CanMask       *bool `json:"can_mask"`
	AllowMenu     *bool `json:"allow_menu"`
	AllowPage     *bool `json:"allow_page"`
	AllowAPI      *bool `json:"allow_api"`
}

func (a *AuthorizationController) UpdatePermission(c *gin.Context) {
	id, ok := authID(c)
	if !ok {
		return
	}
	var input updatePermissionInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	db := model.GetDB(c)
	var existing model.RolePermission
	if err := db.Preload("Role").First(&existing, "id = ?", id).Error; err != nil {
		authErr(c, err)
		return
	}
	if input.Level != nil {
		existing.Level = *input.Level
	}
	if input.OnlyIfCreator != nil {
		existing.OnlyIfCreator = *input.OnlyIfCreator
	}
	if input.CanSelect != nil {
		existing.CanSelect = *input.CanSelect
	}
	if input.CanRead != nil {
		existing.CanRead = *input.CanRead
	}
	if input.CanWrite != nil {
		existing.CanUpdate = *input.CanWrite
	}
	if input.CanUpdate != nil {
		existing.CanUpdate = *input.CanUpdate
	}
	if input.CanCreate != nil {
		existing.CanCreate = *input.CanCreate
	}
	if input.CanDelete != nil {
		existing.CanDelete = *input.CanDelete
	}
	if input.CanSubmit != nil {
		existing.CanSubmit = *input.CanSubmit
	}
	if input.CanCancel != nil {
		existing.CanCancel = *input.CanCancel
	}
	if input.CanAmend != nil {
		existing.CanAmend = *input.CanAmend
	}
	if input.CanPrint != nil {
		existing.CanPrint = *input.CanPrint
	}
	if input.CanEmail != nil {
		existing.CanEmail = *input.CanEmail
	}
	if input.CanReport != nil {
		existing.CanReport = *input.CanReport
	}
	if input.CanImport != nil {
		existing.CanImport = *input.CanImport
	}
	if input.CanExport != nil {
		existing.CanExport = *input.CanExport
	}
	if input.CanShare != nil {
		existing.CanShare = *input.CanShare
	}
	if input.CanMask != nil {
		existing.CanMask = *input.CanMask
	}
	if input.AllowMenu != nil {
		existing.AllowMenu = *input.AllowMenu
	}
	if input.AllowPage != nil {
		existing.AllowPage = *input.AllowPage
	}
	if input.AllowAPI != nil {
		existing.AllowAPI = *input.AllowAPI
	}

	if err := db.Save(&existing).Error; err != nil {
		authErr(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": existing})
}

func (a *AuthorizationController) DeletePermission(c *gin.Context) {
	id, ok := authID(c)
	if !ok {
		return
	}
	db := model.GetDB(c)
	if err := db.Where("id = ?", id).Delete(&model.RolePermission{}).Error; err != nil {
		authErr(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Permission rule deleted"})
}

func (a *AuthorizationController) RestorePermissions(c *gin.Context) {
	tenantID, ok := authTenantID(c)
	if !ok {
		return
	}
	var input struct {
		DocType string `json:"doctype"`
	}
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	input.DocType = strings.TrimSpace(input.DocType)
	if input.DocType == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Document Type wajib diisi"})
		return
	}

	db := model.GetDB(c)
	err := db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Where("tenant_id = ? AND resource = ?", tenantID, input.DocType).Delete(&model.RolePermission{}).Error; err != nil {
			return err
		}
		var adminRoles []model.RoleDefinition
		if err := tx.Where("tenant_id = ? AND name IN ?", tenantID, []string{"Administrator", "System Manager", "Admin", "Super Admin"}).Find(&adminRoles).Error; err != nil {
			return err
		}
		for _, r := range adminRoles {
			rule := model.RolePermission{
				TenantID:   tenantID,
				RoleID:     r.ID,
				Resource:   input.DocType,
				Level:      0,
				CanSelect:  true,
				CanRead:    true,
				CanCreate:  true,
				CanUpdate:  true,
				CanDelete:  true,
				CanSubmit:  true,
				CanCancel:  true,
				CanAmend:   true,
				CanPrint:   true,
				CanEmail:   true,
				CanReport:  true,
				CanImport:  true,
				CanExport:  true,
				CanShare:   true,
				AllowMenu:  true,
				AllowPage:  true,
				AllowAPI:   true,
				FieldRead:  true,
				FieldWrite: true,
			}
			if err := tx.Create(&rule).Error; err != nil {
				return err
			}
		}
		return nil
	})
	if err != nil {
		authErr(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": fmt.Sprintf("Permissions for %s restored to default", input.DocType)})
}

func (a *AuthorizationController) ListDocTypes(c *gin.Context) {
	db := model.GetDB(c)
	seen := make(map[string]bool)
	var list []string

	add := func(name string) {
		name = strings.TrimSpace(name)
		if name != "" && name != "*" && !seen[name] {
			seen[name] = true
			list = append(list, name)
		}
	}

	for _, name := range standardDocTypes {
		add(name)
	}
	for _, name := range framework.Documents.Names() {
		add(name)
	}

	var dbResources []string
	_ = db.Model(&model.RolePermission{}).Where("resource != '' AND resource != '*'").Distinct("resource").Pluck("resource", &dbResources).Error
	for _, r := range dbResources {
		add(r)
	}

	sort.Strings(list)
	c.JSON(http.StatusOK, gin.H{"data": list})
}
