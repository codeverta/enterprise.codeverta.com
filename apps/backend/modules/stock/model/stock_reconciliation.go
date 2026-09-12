package model

import (
	"encoding/json"
	"fmt"
	"time"
)

type StockReconciliation struct {
	ID                   string                    `gorm:"primaryKey;size:64" json:"id"`
	TenantID             string                    `gorm:"size:64;not null;index" json:"tenant_id"`
	Series               string                    `gorm:"size:80;not null;default:'MAT-RECO-.YYYY.-'" json:"naming_series"`
	ReconciliationNumber string                    `gorm:"size:120;not null;index" json:"reconciliation_number"`
	CompanyID            string                    `gorm:"size:64;index" json:"company_id"`
	Company              string                    `gorm:"size:180;not null;index" json:"company"`
	Purpose              string                    `gorm:"size:80;not null;default:'Stock Reconciliation'" json:"purpose"`
	PostingDate          time.Time                 `gorm:"index;not null" json:"posting_date"`
	PostingTime          string                    `gorm:"size:16" json:"posting_time"`
	SetPostingTime       bool                      `gorm:"default:false" json:"set_posting_time"`
	DefaultWarehouse     string                    `gorm:"size:180" json:"set_warehouse"`
	ScanBarcode          string                    `gorm:"size:120" json:"scan_barcode"`
	ScanMode             bool                      `gorm:"default:false" json:"scan_mode"`
	ExpenseAccount       string                    `gorm:"size:180" json:"expense_account"`
	CostCenter           string                    `gorm:"size:180" json:"cost_center"`
	TotalQty             float64                   `gorm:"type:decimal(18,2);default:0" json:"total_qty"`
	TotalAmount          float64                   `gorm:"type:decimal(18,2);default:0" json:"total_amount"`
	Status               string                    `gorm:"size:32;not null;default:'Draft';index" json:"status"`
	Remarks              string                    `gorm:"type:text" json:"remarks"`
	Items                []StockReconciliationItem `gorm:"foreignKey:StockReconciliationID" json:"items"`
	CreatedAt            time.Time                 `json:"created_at"`
	UpdatedAt            time.Time                 `json:"updated_at"`
}

func (reco *StockReconciliation) UnmarshalJSON(data []byte) error {
	type alias StockReconciliation
	var payload struct {
		PostingDate json.RawMessage `json:"posting_date"`
		*alias
	}
	payload.alias = (*alias)(reco)
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
	for _, layout := range []string{time.RFC3339, "2006-01-02", "2006-01-02 15:04:05"} {
		if parsed, err := time.Parse(layout, value); err == nil {
			reco.PostingDate = parsed
			return nil
		}
	}
	return fmt.Errorf("invalid posting_date: %s", value)
}

func (StockReconciliation) TableName() string { return "stock_reconciliations" }

type StockReconciliationItem struct {
	ID                    string    `gorm:"primaryKey;size:64" json:"id"`
	StockReconciliationID string    `gorm:"size:64;not null;index" json:"stock_reconciliation_id"`
	TenantID              string    `gorm:"size:64;not null;index" json:"tenant_id"`
	ItemCode              string    `gorm:"size:120;not null;index" json:"item_code"`
	ItemName              string    `gorm:"size:180" json:"item_name"`
	Warehouse             string    `gorm:"size:180;not null;index" json:"warehouse"`
	Qty                   float64   `gorm:"type:decimal(18,2);not null;default:0" json:"quantity"`
	CurrentQty            float64   `gorm:"type:decimal(18,2);default:0" json:"current_qty"`
	UOM                   string    `gorm:"size:32;default:'Nos'" json:"stock_uom"`
	ValuationRate         float64   `gorm:"type:decimal(18,2);default:0" json:"valuation_rate"`
	Amount                float64   `gorm:"type:decimal(18,2);default:0" json:"amount"`
	Barcode               string    `gorm:"size:120" json:"barcode"`
	Idx                   int       `gorm:"default:0" json:"idx"`
	CreatedAt             time.Time `json:"created_at"`
	UpdatedAt             time.Time `json:"updated_at"`
}

func (StockReconciliationItem) TableName() string { return "stock_reconciliation_items" }
