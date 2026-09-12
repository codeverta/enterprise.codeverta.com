package model

import (
	"time"

	"gorm.io/gorm"
)

type Operation struct {
	ID        string    `gorm:"primaryKey;size:36" json:"id"`
	TenantID  string    `gorm:"size:64;index" json:"tenant_id"`
	Name      string    `gorm:"size:160;not null" json:"name"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}
type WorkstationType struct {
	ID        string    `gorm:"primaryKey;size:36" json:"id"`
	TenantID  string    `gorm:"size:64;index" json:"tenant_id"`
	Name      string    `gorm:"size:160;not null" json:"name"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}
type Workstation struct {
	ID                string    `gorm:"primaryKey;size:36" json:"id"`
	TenantID          string    `gorm:"size:64;index" json:"tenant_id"`
	WorkstationName   string    `gorm:"size:160;not null" json:"workstation_name"`
	WorkstationTypeID string    `gorm:"size:36" json:"workstation_type_id"`
	JobCapacity       int       `gorm:"default:1" json:"job_capacity"`
	CreatedAt         time.Time `json:"created_at"`
	UpdatedAt         time.Time `json:"updated_at"`
}

type BOM struct {
	ID                                 string         `gorm:"primaryKey;size:36" json:"id"`
	TenantID                           string         `gorm:"size:64;index" json:"tenant_id"`
	BOMNo                              string         `gorm:"size:100;index" json:"bom_no"`
	Company                            string         `gorm:"size:160" json:"company"`
	ItemCode                           string         `gorm:"size:100;index" json:"item_code"`
	ItemName                           string         `gorm:"size:200" json:"item_name"`
	UOM                                string         `gorm:"size:50" json:"uom"`
	Quantity                           float64        `json:"quantity"`
	IsActive                           bool           `json:"is_active"`
	IsDefault                          bool           `json:"is_default"`
	AllowAlternativeItem               bool           `json:"allow_alternative_item"`
	SetRateOfSubAssemblyItemBasedOnBOM bool           `json:"set_rate_of_sub_assembly_item_based_on_bom"`
	IsPhantomBOM                       bool           `json:"is_phantom_bom"`
	RMCostAsPer                        string         `gorm:"size:60" json:"rm_cost_as_per"`
	BuyingPriceList                    string         `gorm:"size:160" json:"buying_price_list"`
	Currency                           string         `gorm:"size:10" json:"currency"`
	WithOperations                     bool           `json:"with_operations"`
	TrackSemiFinishedGoods             bool           `json:"track_semi_finished_goods"`
	TransferMaterialAgainst            string         `gorm:"size:60" json:"transfer_material_against"`
	Routing                            string         `gorm:"size:160" json:"routing"`
	ProcessLossPercentage              float64        `json:"process_loss_percentage"`
	QualityInspectionRequired          bool           `json:"quality_inspection_required"`
	DefaultSourceWarehouse             string         `gorm:"size:160" json:"default_source_warehouse"`
	DefaultTargetWarehouse             string         `gorm:"size:160" json:"default_target_warehouse"`
	Project                            string         `gorm:"size:160" json:"project"`
	WebsiteDescription                 string         `gorm:"type:text" json:"website_description"`
	RawMaterialCost                    float64        `json:"raw_material_cost"`
	TotalCost                          float64        `json:"total_cost"`
	Items                              []BOMItem      `json:"items"`
	ScrapItems                         []BOMScrapItem `json:"scrap_items"`
	Operations                         []BOMOperation `json:"operations"`
	CreatedAt                          time.Time      `json:"created_at"`
	UpdatedAt                          time.Time      `json:"updated_at"`
}
type BOMItem struct {
	ID       string  `gorm:"primaryKey;size:36" json:"id"`
	BOMID    string  `gorm:"size:36;index" json:"bom_id"`
	ItemCode string  `gorm:"size:100" json:"item_code"`
	ItemName string  `gorm:"size:200" json:"item_name"`
	Qty      float64 `json:"qty"`
	UOM      string  `gorm:"size:50" json:"uom"`
	Rate     float64 `json:"rate"`
	Amount   float64 `json:"amount"`
}
type BOMScrapItem struct {
	ID       string  `gorm:"primaryKey;size:36" json:"id"`
	BOMID    string  `gorm:"size:36;index" json:"bom_id"`
	ItemCode string  `gorm:"size:100" json:"item_code"`
	ItemName string  `gorm:"size:200" json:"item_name"`
	Qty      float64 `json:"qty"`
	Rate     float64 `json:"rate"`
}
type BOMOperation struct {
	ID                string  `gorm:"primaryKey;size:36" json:"id"`
	BOMID             string  `gorm:"size:36;index" json:"bom_id"`
	OperationID       string  `gorm:"size:36" json:"operation_id"`
	SequenceID        int     `json:"sequence_id"`
	FGItem            string  `gorm:"size:100" json:"fg_item"`
	QtyToProduce      float64 `json:"qty_to_produce"`
	BOMNo             string  `gorm:"size:100" json:"bom_no"`
	WorkstationTypeID string  `gorm:"size:36" json:"workstation_type_id"`
	WorkstationID     string  `gorm:"size:36" json:"workstation_id"`
	OperationTime     float64 `json:"operation_time"`
}

func Migrate(db *gorm.DB) error {
	return db.AutoMigrate(&Operation{}, &WorkstationType{}, &Workstation{}, &BOM{}, &BOMItem{}, &BOMScrapItem{}, &BOMOperation{}, &WorkOrder{}, &WorkOrderItem{})
}

type WorkOrder struct {
	ID                                  string          `gorm:"primaryKey;size:36" json:"id"`
	TenantID                            string          `gorm:"size:64;index" json:"tenant_id"`
	WorkOrderNo                         string          `gorm:"size:100;index" json:"work_order_no"`
	Status                              string          `gorm:"size:30;default:'Draft'" json:"status"`
	Company                             string          `gorm:"size:160" json:"company"`
	NamingSeries                        string          `gorm:"size:80" json:"naming_series"`
	ProductionItem                      string          `gorm:"size:100" json:"production_item"`
	ItemName                            string          `gorm:"size:200" json:"item_name"`
	BOMNo                               string          `gorm:"size:100" json:"bom_no"`
	Qty                                 float64         `json:"qty"`
	SalesOrder                          string          `gorm:"size:100" json:"sales_order"`
	TrackSemiFinishedGoods              bool            `json:"track_semi_finished_goods"`
	SourceWarehouse                     string          `gorm:"size:160" json:"source_warehouse"`
	WIPWarehouse                        string          `gorm:"size:160" json:"wip_warehouse"`
	FGWarehouse                         string          `gorm:"size:160" json:"fg_warehouse"`
	ScrapWarehouse                      string          `gorm:"size:160" json:"scrap_warehouse"`
	AllowAlternativeItem                bool            `json:"allow_alternative_item"`
	UseMultiLevelBOM                    bool            `json:"use_multi_level_bom"`
	SkipTransfer                        bool            `json:"skip_transfer"`
	UpdateConsumedMaterialCostInProject bool            `json:"update_consumed_material_cost_in_project"`
	PlannedStartDate                    *time.Time      `json:"planned_start_date"`
	PlannedEndDate                      *time.Time      `json:"planned_end_date"`
	ExpectedDeliveryDate                *time.Time      `json:"expected_delivery_date"`
	ActualStartDate                     *time.Time      `json:"actual_start_date"`
	ActualEndDate                       *time.Time      `json:"actual_end_date"`
	LeadTime                            float64         `json:"lead_time"`
	Project                             string          `gorm:"size:160" json:"project"`
	RequiredItems                       []WorkOrderItem `json:"required_items"`
	CreatedAt                           time.Time       `json:"created_at"`
	UpdatedAt                           time.Time       `json:"updated_at"`
}
type WorkOrderItem struct {
	ID              string  `gorm:"primaryKey;size:36" json:"id"`
	WorkOrderID     string  `gorm:"size:36;index" json:"work_order_id"`
	ItemCode        string  `gorm:"size:100" json:"item_code"`
	ItemName        string  `gorm:"size:200" json:"item_name"`
	SourceWarehouse string  `gorm:"size:160" json:"source_warehouse"`
	RequiredQty     float64 `json:"required_qty"`
	TransferredQty  float64 `json:"transferred_qty"`
	ConsumedQty     float64 `json:"consumed_qty"`
	ReturnedQty     float64 `json:"returned_qty"`
}
