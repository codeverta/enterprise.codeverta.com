package model

import (
	"strings"
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type RoleDefinition struct {
	ID          uuid.UUID        `json:"id" gorm:"type:char(36);primaryKey"`
	TenantID    uuid.UUID        `json:"tenant_id" gorm:"type:char(36);not null;index:idx_role_tenant_name,unique"`
	Name        string           `json:"name" gorm:"type:varchar(120);not null;index:idx_role_tenant_name,unique" binding:"required,max=120"`
	Description string           `json:"description" gorm:"type:text"`
	Enabled     bool             `json:"enabled" gorm:"not null;default:true;index"`
	IsCustom    bool             `json:"is_custom" gorm:"not null;default:true"`
	DeskAccess  bool             `json:"desk_access" gorm:"not null;default:false"`
	LegacyLevel *int             `json:"legacy_level" gorm:"index"`
	CreatedAt   time.Time        `json:"created_at"`
	UpdatedAt   time.Time        `json:"updated_at"`
	DeletedAt   gorm.DeletedAt   `json:"-" gorm:"index"`
	Permissions []RolePermission `json:"permissions,omitempty" gorm:"foreignKey:RoleID"`
}

func (r *RoleDefinition) BeforeCreate(_ *gorm.DB) error {
	if r.ID == uuid.Nil {
		r.ID = uuid.New()
	}
	return nil
}

type RolePermission struct {
	ID         uuid.UUID `json:"id" gorm:"type:char(36);primaryKey"`
	TenantID   uuid.UUID `json:"tenant_id" gorm:"type:char(36);not null;index"`
	RoleID     uuid.UUID `json:"role_id" gorm:"type:char(36);not null;index"`
	Resource   string    `json:"resource" gorm:"type:varchar(255);not null;index" binding:"required"`
	CanRead    bool      `json:"can_read"`
	CanCreate  bool      `json:"can_create"`
	CanUpdate  bool      `json:"can_update"`
	CanDelete  bool      `json:"can_delete"`
	AllowMenu  bool      `json:"allow_menu"`
	AllowPage  bool      `json:"allow_page"`
	AllowAPI   bool      `json:"allow_api"`
	FieldName  string    `json:"field_name" gorm:"type:varchar(120);index"`
	FieldRead  bool      `json:"field_read"`
	FieldWrite bool      `json:"field_write"`
	CreatedAt  time.Time `json:"created_at"`
	UpdatedAt  time.Time `json:"updated_at"`
}

func (p *RolePermission) BeforeCreate(_ *gorm.DB) error {
	if p.ID == uuid.Nil {
		p.ID = uuid.New()
	}
	return nil
}

type RoleProfile struct {
	ID          uuid.UUID        `json:"id" gorm:"type:char(36);primaryKey"`
	TenantID    uuid.UUID        `json:"tenant_id" gorm:"type:char(36);not null;index:idx_profile_tenant_name,unique"`
	Name        string           `json:"name" gorm:"type:varchar(120);not null;index:idx_profile_tenant_name,unique" binding:"required"`
	Description string           `json:"description" gorm:"type:text"`
	Enabled     bool             `json:"enabled" gorm:"not null;default:true"`
	Roles       []RoleDefinition `json:"roles,omitempty" gorm:"many2many:role_profile_roles;"`
	CreatedAt   time.Time        `json:"created_at"`
	UpdatedAt   time.Time        `json:"updated_at"`
}

func (p *RoleProfile) BeforeCreate(_ *gorm.DB) error {
	if p.ID == uuid.Nil {
		p.ID = uuid.New()
	}
	return nil
}

type UserRoleAssignment struct {
	ID        uuid.UUID      `json:"id" gorm:"type:char(36);primaryKey"`
	TenantID  uuid.UUID      `json:"tenant_id" gorm:"type:char(36);not null;index"`
	UserID    uuid.UUID      `json:"user_id" gorm:"type:char(36);not null;index:idx_user_role_assignment,unique"`
	RoleID    uuid.UUID      `json:"role_id" gorm:"type:char(36);not null;index:idx_user_role_assignment,unique"`
	Role      RoleDefinition `json:"role,omitempty" gorm:"foreignKey:RoleID"`
	CreatedAt time.Time      `json:"created_at"`
}

func (a *UserRoleAssignment) BeforeCreate(_ *gorm.DB) error {
	if a.ID == uuid.Nil {
		a.ID = uuid.New()
	}
	return nil
}

type UserRoleProfileAssignment struct {
	ID            uuid.UUID `json:"id" gorm:"type:char(36);primaryKey"`
	TenantID      uuid.UUID `json:"tenant_id" gorm:"type:char(36);not null;index"`
	UserID        uuid.UUID `json:"user_id" gorm:"type:char(36);not null;index:idx_user_profile_assignment,unique"`
	RoleProfileID uuid.UUID `json:"role_profile_id" gorm:"type:char(36);not null;index:idx_user_profile_assignment,unique"`
	CreatedAt     time.Time `json:"created_at"`
}

func (a *UserRoleProfileAssignment) BeforeCreate(_ *gorm.DB) error {
	if a.ID == uuid.Nil {
		a.ID = uuid.New()
	}
	return nil
}

func permissionActionAllowed(permission RolePermission, action string) bool {
	switch strings.ToLower(action) {
	case "read":
		return permission.CanRead
	case "create":
		return permission.CanCreate
	case "update":
		return permission.CanUpdate
	case "delete":
		return permission.CanDelete
	case "menu":
		return permission.AllowMenu
	case "page":
		return permission.AllowPage
	case "api":
		return permission.AllowAPI
	}
	return false
}

func resourceMatches(rule, resource string) bool {
	rule, resource = strings.TrimSpace(strings.ToLower(rule)), strings.TrimSpace(strings.ToLower(resource))
	return rule == "*" || rule == resource || (strings.HasSuffix(rule, "*") && strings.HasPrefix(resource, strings.TrimSuffix(rule, "*")))
}

func UserHasPermission(db *gorm.DB, userID uuid.UUID, resource, action, field string) bool {
	var user User
	if err := db.Set("skip_tenant_scope", true).Select("id", "role", "tenant_id").First(&user, "id = ?", userID).Error; err != nil {
		return false
	}
	if user.Role >= RoleAdmin {
		return true
	}
	roleIDs := make([]uuid.UUID, 0)
	_ = db.Model(&UserRoleAssignment{}).Where("user_id = ?", userID).Pluck("role_id", &roleIDs).Error
	var profileIDs []uuid.UUID
	_ = db.Model(&UserRoleProfileAssignment{}).Where("user_id = ?", userID).Pluck("role_profile_id", &profileIDs).Error
	if len(profileIDs) > 0 {
		var profileRoleIDs []uuid.UUID
		_ = db.Table("role_profile_roles").Where("role_profile_id IN ?", profileIDs).Pluck("role_definition_id", &profileRoleIDs).Error
		roleIDs = append(roleIDs, profileRoleIDs...)
	}
	if len(roleIDs) == 0 {
		return false
	}
	var permissions []RolePermission
	if err := db.Joins("JOIN role_definitions ON role_definitions.id = role_permissions.role_id AND role_definitions.enabled = ?", true).Where("role_permissions.role_id IN ?", roleIDs).Find(&permissions).Error; err != nil {
		return false
	}
	for _, permission := range permissions {
		if resourceMatches(permission.Resource, resource) && permissionActionAllowed(permission, action) {
			if field == "" || permission.FieldName == "" || strings.EqualFold(permission.FieldName, field) {
				if field == "" || (action == "read" && permission.FieldRead) || (action != "read" && permission.FieldWrite) {
					return true
				}
			}
		}
	}
	return false
}
