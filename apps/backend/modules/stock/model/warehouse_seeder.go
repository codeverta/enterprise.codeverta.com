package model

import (
	"log"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type WarehouseSeed struct {
	WarehouseName   string
	IsGroup         bool
	ParentWarehouse string
	Company         string
	WarehouseType   string
	Description     string
}

// SeedWarehouses populates a default warehouse tree for every active company.
func SeedWarehouses(db *gorm.DB, tenantID string) error {
	var companies []struct {
		Name         string
		Abbreviation string
	}
	if err := db.Table("companies").Select("name", "abbreviation").Where("tenant_id = ? AND is_active = ? AND deleted_at IS NULL", tenantID, true).Order("name asc").Scan(&companies).Error; err != nil {
		return err
	}
	for _, company := range companies {
		suffix := company.Abbreviation
		if suffix == "" {
			suffix = company.Name
		}
		root := "All Warehouses - " + suffix
		nodes := []WarehouseSeed{
			{
				WarehouseName:   root,
				IsGroup:         true,
				ParentWarehouse: "",
				Company:         company.Name,
				WarehouseType:   "Group",
			},
			{
				WarehouseName:   "Finished Goods - " + suffix,
				IsGroup:         false,
				ParentWarehouse: root,
				Company:         company.Name,
				WarehouseType:   "Finished Goods",
			},
			{
				WarehouseName:   "Goods In Transit - " + suffix,
				IsGroup:         false,
				ParentWarehouse: root,
				Company:         company.Name,
				WarehouseType:   "Transit",
			},
			{
				WarehouseName:   "Stores - " + suffix,
				IsGroup:         false,
				ParentWarehouse: root,
				Company:         company.Name,
				WarehouseType:   "Stores",
			},
			{
				WarehouseName:   "Work In Progress - " + suffix,
				IsGroup:         false,
				ParentWarehouse: root,
				Company:         company.Name,
				WarehouseType:   "Work In Progress",
			},
		}

		for _, n := range nodes {
			var existing Warehouse
			err := db.Where("(tenant_id = ? OR tenant_id = '' OR tenant_id IS NULL) AND warehouse_name = ?", tenantID, n.WarehouseName).First(&existing).Error
			if err == gorm.ErrRecordNotFound {
				newWH := Warehouse{
					ID:              "wh-" + uuid.NewString()[:8],
					TenantID:        tenantID,
					WarehouseName:   n.WarehouseName,
					IsGroup:         n.IsGroup,
					ParentWarehouse: n.ParentWarehouse,
					Company:         n.Company,
					WarehouseType:   n.WarehouseType,
					Disabled:        false,
				}
				if err := db.Create(&newWH).Error; err != nil {
					log.Printf("[WarehouseSeeder] Failed to seed %s: %v\n", n.WarehouseName, err)
				}
			}
		}
	}

	return nil
}
