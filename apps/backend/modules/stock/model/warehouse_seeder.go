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

// SeedWarehouses populates the default warehouse tree for PT ZENIT TECHNOLOGY SOLUTION (PZTS)
func SeedWarehouses(db *gorm.DB, tenantID string) error {
	company := "PT ZENIT TECHNOLOGY SOLUTION"

	nodes := []WarehouseSeed{
		{
			WarehouseName:   "All Warehouses - PZTS",
			IsGroup:         true,
			ParentWarehouse: "",
			Company:         company,
			WarehouseType:   "Group",
		},
		{
			WarehouseName:   "Finished Goods - PZTS",
			IsGroup:         false,
			ParentWarehouse: "All Warehouses - PZTS",
			Company:         company,
			WarehouseType:   "Finished Goods",
		},
		{
			WarehouseName:   "Goods In Transit - PZTS",
			IsGroup:         false,
			ParentWarehouse: "All Warehouses - PZTS",
			Company:         company,
			WarehouseType:   "Transit",
		},
		{
			WarehouseName:   "Stores - PZTS",
			IsGroup:         false,
			ParentWarehouse: "All Warehouses - PZTS",
			Company:         company,
			WarehouseType:   "Stores",
		},
		{
			WarehouseName:   "Work In Progress - PZTS",
			IsGroup:         false,
			ParentWarehouse: "All Warehouses - PZTS",
			Company:         company,
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

	return nil
}
