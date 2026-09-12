package model

import (
	"encoding/json"
	"fmt"
	"time"
)

type StockEntry struct {
	ID                 string           `gorm:"primaryKey;size:64" json:"id"`
	TenantID           string           `gorm:"size:64;not null;index" json:"tenant_id"`
	Series             string           `gorm:"size:80;not null;default:'MAT-STE-.YYYY.-'" json:"naming_series"`
	StockEntryNumber   string           `gorm:"size:120;not null;index" json:"stock_entry_number"`
	StockEntryType     string           `gorm:"size:80;not null;index" json:"stock_entry_type"`
	Purpose            string           `gorm:"size:80" json:"purpose"`
	CompanyID          string           `gorm:"size:64;index" json:"company_id"`
	Company            string           `gorm:"size:180;not null;index" json:"company"`
	PostingDate        time.Time        `gorm:"index;not null" json:"posting_date"`
	PostingTime        string           `gorm:"size:16" json:"posting_time"`
	SetPostingTime     bool             `gorm:"default:false" json:"set_posting_time"`
	InspectionRequired bool             `gorm:"default:false" json:"inspection_required"`
	AddToTransit       bool             `gorm:"default:false" json:"add_to_transit"`
	ApplyPutawayRule   bool             `gorm:"default:false" json:"apply_putaway_rule"`
	WorkOrder          string           `gorm:"size:120" json:"work_order"`
	FromBOM            bool             `gorm:"default:false" json:"from_bom"`
	BOMNo              string           `gorm:"size:120" json:"bom_no"`
	FromWarehouse      string           `gorm:"size:180" json:"from_warehouse"`
	ToWarehouse        string           `gorm:"size:180" json:"to_warehouse"`
	ScanBarcode        string           `gorm:"size:120" json:"scan_barcode"`
	TotalQty           float64          `gorm:"type:decimal(18,2);default:0" json:"total_qty"`
	TotalAmount        float64          `gorm:"type:decimal(18,2);default:0" json:"total_amount"`
	Status             string           `gorm:"size:32;not null;default:'Draft';index" json:"status"`
	Remarks            string           `gorm:"type:text" json:"remarks"`
	Items              []StockEntryItem `gorm:"foreignKey:StockEntryID" json:"items"`
	CreatedAt          time.Time        `json:"created_at"`
	UpdatedAt          time.Time        `json:"updated_at"`
}

// UnmarshalJSON accepts both the browser's date-only input and API timestamps.
// HTML date inputs submit YYYY-MM-DD, while time.Time only accepts RFC3339.
func (entry *StockEntry) UnmarshalJSON(data []byte) error {
	type alias StockEntry
	var payload struct {
		PostingDate json.RawMessage `json:"posting_date"`
		*alias
	}
	payload.alias = (*alias)(entry)
	if err := json.Unmarshal(data, &payload); err != nil {
		return err
	}
	if len(payload.PostingDate) == 0 || string(payload.PostingDate) == "null" {
		return nil
	}
	var value string
	if err := json.Unmarshal(payload.PostingDate, &value); err != nil {
		return err
	}
	for _, layout := range []string{
		time.RFC3339,
		"2006-01-02",
		"2006-01-02 15:04:05",
		"2006-01-02T15:04:05",
		"2006-01-02T15:04:05Z07:00",
		"2006-01-02T15:04:05.000Z",
	} {
		if parsed, err := time.Parse(layout, value); err == nil {
			entry.PostingDate = parsed
			return nil
		}
	}
	return fmt.Errorf("invalid posting_date: %s", value)
}

func (StockEntry) TableName() string { return "stock_entries" }

type StockEntryItem struct {
	ID               string    `gorm:"primaryKey;size:64" json:"id"`
	StockEntryID     string    `gorm:"size:64;not null;index" json:"stock_entry_id"`
	TenantID         string    `gorm:"size:64;not null;index" json:"tenant_id"`
	ItemCode         string    `gorm:"size:120;not null;index" json:"item_code"`
	ItemName         string    `gorm:"size:180" json:"item_name"`
	Description      string    `gorm:"type:text" json:"description"`
	SourceWarehouse  string    `gorm:"size:180" json:"source_warehouse"`
	TargetWarehouse  string    `gorm:"size:180" json:"target_warehouse"`
	Qty              float64   `gorm:"type:decimal(18,2);not null;default:0" json:"qty"`
	TransferQty      float64   `gorm:"type:decimal(18,2);not null;default:0" json:"transfer_qty"`
	UOM              string    `gorm:"size:32;default:'Nos'" json:"uom"`
	ConversionFactor float64   `gorm:"type:decimal(18,4);default:1" json:"conversion_factor"`
	BasicRate        float64   `gorm:"type:decimal(18,2);default:0" json:"basic_rate"`
	Amount           float64   `gorm:"type:decimal(18,2);default:0" json:"amount"`
	Barcode          string    `gorm:"size:120" json:"barcode"`
	BatchNo          string    `gorm:"size:120" json:"batch_no"`
	Idx              int       `gorm:"default:0" json:"idx"`
	CreatedAt        time.Time `json:"created_at"`
	UpdatedAt        time.Time `json:"updated_at"`
}

func (StockEntryItem) TableName() string { return "stock_entry_items" }
