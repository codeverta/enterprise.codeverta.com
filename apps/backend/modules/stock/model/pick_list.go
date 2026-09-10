package model

import (
	"time"
)

type PickListStatus string

const (
	PickListStatusDraft     PickListStatus = "Draft"
	PickListStatusSubmitted PickListStatus = "Submitted"
	PickListStatusCompleted PickListStatus = "Completed"
	PickListStatusCancelled PickListStatus = "Cancelled"
)

type PickListPurpose string

const (
	PickListPurposeDelivery             PickListPurpose = "Delivery"
	PickListPurposeTransferForMfg      PickListPurpose = "Material Transfer for Manufacture"
	PickListPurposeMaterialTransfer     PickListPurpose = "Material Transfer"
)

type PickList struct {
	ID                          string         `gorm:"primaryKey;size:64" json:"id"`
	TenantID                    string         `gorm:"size:64;not null;index" json:"tenant_id"`
	NamingSeries                string         `gorm:"size:64;default:'STO-PICK-.YYYY.-'" json:"naming_series"`
	PickListNumber              string         `gorm:"size:64;not null;index;uniqueIndex:idx_pick_list_number_tenant" json:"pick_list_number"`
	CompanyID                   string         `gorm:"size:64;index" json:"company_id"`
	Company                     string         `gorm:"size:180;not null;index" json:"company"`
	Purpose                     string         `gorm:"size:80;not null;default:'Delivery';index" json:"purpose"`
	Status                      PickListStatus `gorm:"size:32;not null;default:'Draft';index" json:"status"`
	ParentWarehouse             string         `gorm:"size:180" json:"parent_warehouse"`
	ConsiderRejectedWarehouses  bool           `gorm:"default:false" json:"consider_rejected_warehouses"`
	PickManually                bool           `gorm:"default:false" json:"pick_manually"`
	IgnorePricingRule           bool           `gorm:"default:false" json:"ignore_pricing_rule"`
	ScanBarcode                 string         `gorm:"size:120" json:"scan_barcode"`
	ScanMode                    bool           `gorm:"default:false" json:"scan_mode"`
	PromptQty                   bool           `gorm:"default:false" json:"prompt_qty"`
	TotalQty                    float64        `gorm:"type:decimal(18,2);default:0" json:"total_qty"`
	TotalPickedQty              float64        `gorm:"type:decimal(18,2);default:0" json:"total_picked_qty"`
	Remarks                     string         `gorm:"type:text" json:"remarks"`
	Locations                   []PickListItem `gorm:"foreignKey:PickListID" json:"locations"`
	CreatedAt                   time.Time      `json:"created_at"`
	UpdatedAt                   time.Time      `json:"updated_at"`
}

func (PickList) TableName() string { return "pick_lists" }

type PickListItem struct {
	ID                  string    `gorm:"primaryKey;size:64" json:"id"`
	PickListID          string    `gorm:"size:64;not null;index" json:"pick_list_id"`
	TenantID            string    `gorm:"size:64;not null;index" json:"tenant_id"`
	ItemCode            string    `gorm:"size:120;not null;index" json:"item_code"`
	ItemName            string    `gorm:"size:180" json:"item_name"`
	Description         string    `gorm:"type:text" json:"description"`
	Warehouse           string    `gorm:"size:180;not null" json:"warehouse"`
	Qty                 float64   `gorm:"type:decimal(18,2);not null;default:0" json:"qty"`
	StockQty            float64   `gorm:"type:decimal(18,2);not null;default:0" json:"stock_qty"`
	PickedQty           float64   `gorm:"type:decimal(18,2);not null;default:0" json:"picked_qty"`
	UOM                 string    `gorm:"size:32;default:'Nos'" json:"uom"`
	ConversionFactor    float64   `gorm:"type:decimal(18,4);default:1" json:"conversion_factor"`
	BatchNo             string    `gorm:"size:120" json:"batch_no"`
	SerialNo            string    `gorm:"type:text" json:"serial_no"`
	SalesOrder          string    `gorm:"size:120;index" json:"sales_order"`
	SalesOrderItem      string    `gorm:"size:120" json:"sales_order_item"`
	WorkOrder           string    `gorm:"size:120;index" json:"work_order"`
	MaterialRequest     string    `gorm:"size:120;index" json:"material_request"`
	MaterialRequestItem string    `gorm:"size:120" json:"material_request_item"`
	Idx                 int       `gorm:"default:0" json:"idx"`
	CreatedAt           time.Time `json:"created_at"`
	UpdatedAt           time.Time `json:"updated_at"`
}

func (PickListItem) TableName() string { return "pick_list_items" }
