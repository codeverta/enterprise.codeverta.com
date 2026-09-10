package model

import (
	"fmt"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

var defaultRoleNames = []string{
	"Analytics", "Supplier", "Support Team", "Fulfillment User", "Quality Manager", "Academics User",
	"Delivery User", "Delivery Manager", "Fleet Manager", "Customer", "Item Manager", "Manufacturing User",
	"HR User", "Projects Manager", "Projects User", "Manufacturing Manager", "HR Manager", "Stock User",
	"Stock Manager", "Employee", "Auditor", "Sales Manager", "Maintenance Manager", "Purchase Master Manager",
	"Sales Master Manager", "Purchase Manager", "Maintenance User", "Accounts Manager", "Sales User", "Purchase User",
	"Accounts User", "Newsletter Manager", "Marketing Manager", "Knowledge Base Contributor", "Knowledge Base Editor",
	"Translator", "Prepared Report User", "Inbox User", "Script Manager", "Report Manager", "Workspace Manager",
	"Dashboard Manager", "Website Manager", "Administrator", "Desk User", "System Manager", "Guest", "All",
	"Admin", "Super Admin",
}

func defaultRoleAccess(name string) (desk bool, legacy *int) {
	desk = name != "Guest" && name != "Customer" && name != "Supplier" && name != "All"
	if name == "Admin" || name == "Administrator" {
		value := RoleAdmin
		return true, &value
	}
	if name == "Super Admin" || name == "System Manager" {
		value := RoleSuperAdmin
		return true, &value
	}
	return desk, nil
}

func SeedDefaultRoles(db *gorm.DB) error {
	var tenants []Tenant
	if err := db.Set("skip_tenant_scope", true).Find(&tenants).Error; err != nil {
		return err
	}
	for _, tenant := range tenants {
		roles := map[string]RoleDefinition{}
		for _, name := range defaultRoleNames {
			desk, legacy := defaultRoleAccess(name)
			role := RoleDefinition{
				TenantID:    tenant.ID,
				Name:        name,
				RoleName:    name,
				Enabled:     true,
				Disabled:    false,
				IsCustom:    false,
				DeskAccess:  desk,
				LegacyLevel: legacy,
			}
			if err := db.Where("tenant_id = ? AND name = ?", tenant.ID, name).Attrs(role).FirstOrCreate(&role).Error; err != nil {
				return fmt.Errorf("seed role %s: %w", name, err)
			}
			roles[name] = role
			if name == "Admin" || name == "Super Admin" || name == "Administrator" || name == "System Manager" {
				permission := RolePermission{TenantID: tenant.ID, RoleID: role.ID, Resource: "*", CanRead: true, CanCreate: true, CanUpdate: true, CanDelete: true, AllowMenu: true, AllowPage: true, AllowAPI: true, FieldRead: true, FieldWrite: true}
				if err := db.Where("role_id = ? AND resource = ? AND field_name = ''", role.ID, "*").FirstOrCreate(&permission).Error; err != nil {
					return err
				}
			}
		}
		adminRole, superRole := roles["Admin"], roles["Super Admin"]
		var users []User
		if err := db.Set("skip_tenant_scope", true).Where("tenant_id = ? AND role >= ?", tenant.ID, RoleAdmin).Find(&users).Error; err != nil {
			return err
		}
		for _, user := range users {
			role := adminRole
			if user.Role >= RoleSuperAdmin {
				role = superRole
			}
			assignment := UserRoleAssignment{TenantID: tenant.ID, UserID: user.ID, RoleID: role.ID}
			if err := db.Where("user_id = ? AND role_id = ?", user.ID, role.ID).FirstOrCreate(&assignment).Error; err != nil {
				return err
			}
		}
	}
	return nil
}

func roleIDsFromStrings(values []string) []uuid.UUID {
	result := make([]uuid.UUID, 0, len(values))
	for _, value := range values {
		if id, err := uuid.Parse(value); err == nil {
			result = append(result, id)
		}
	}
	return result
}
