package model

import (
	"log"
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type PriceList struct {
	ID            string    `gorm:"primaryKey;size:64" json:"id"`
	TenantID      string    `gorm:"size:64;not null;index" json:"tenant_id"`
	PriceListName string    `gorm:"size:180;not null;index" json:"price_list_name"`
	Currency      string    `gorm:"size:10;not null;default:'IDR'" json:"currency"`
	Buying        bool      `gorm:"default:false" json:"buying"`
	Selling       bool      `json:"selling"`
	Enabled       bool      `gorm:"default:true;index" json:"enabled"`
	CreatedAt     time.Time `json:"created_at"`
	UpdatedAt     time.Time `json:"updated_at"`
}

func (PriceList) TableName() string { return "selling_price_lists" }

type ItemPrice struct {
	ID            string     `gorm:"primaryKey;size:64" json:"id"`
	TenantID      string     `gorm:"size:64;not null;index" json:"tenant_id"`
	ItemCode      string     `gorm:"size:120;not null;index" json:"item_code"`
	ItemName      string     `gorm:"size:180;not null" json:"item_name"`
	PriceList     string     `gorm:"size:180;not null;index" json:"price_list"`
	PriceListRate float64    `gorm:"type:decimal(18,2);not null;default:0" json:"price_list_rate"`
	Currency      string     `gorm:"size:10;not null;default:'IDR'" json:"currency"`
	UOM           string     `gorm:"size:32" json:"uom"`
	PackingUnit   float64    `gorm:"type:decimal(18,2);default:1" json:"packing_unit"`
	BatchNo       string     `gorm:"size:120" json:"batch_no"`
	Buying        bool       `gorm:"default:false" json:"buying"`
	Selling       bool       `gorm:"default:true" json:"selling"`
	LeadTimeDays  int        `gorm:"default:0" json:"lead_time_days"`
	ValidFrom     *time.Time `json:"valid_from"`
	ValidUpto     *time.Time `json:"valid_upto"`
	Note          string     `gorm:"type:text" json:"note"`
	Reference     string     `gorm:"size:255" json:"reference"`
	IsActive      bool       `gorm:"default:true;index" json:"is_active"`
	CreatedAt     time.Time  `json:"created_at"`
	UpdatedAt     time.Time  `json:"updated_at"`
}

func (ItemPrice) TableName() string { return "selling_item_prices" }

type DefaultPriceListSeed struct {
	PriceListName string
	Currency      string
	Buying        bool
	Selling       bool
	Enabled       bool
}

var DefaultPriceLists = []DefaultPriceListSeed{
	{PriceListName: "Standar Selling", Currency: "IDR", Buying: false, Selling: true, Enabled: true},
	{PriceListName: "Standar Buying", Currency: "IDR", Buying: true, Selling: false, Enabled: true},
	{PriceListName: "Standard Selling", Currency: "IDR", Buying: false, Selling: true, Enabled: true},
	{PriceListName: "Standard Buying", Currency: "IDR", Buying: true, Selling: false, Enabled: true},
}

// SeedPriceLists seeds default price lists for a tenant
func SeedPriceLists(db *gorm.DB, tenantID string) error {
	for _, def := range DefaultPriceLists {
		var existing PriceList
		err := db.Where("(tenant_id = ? OR tenant_id = '' OR tenant_id IS NULL) AND price_list_name = ?", tenantID, def.PriceListName).First(&existing).Error
		if err == gorm.ErrRecordNotFound {
			newPL := PriceList{
				ID:            "pl-" + uuid.NewString()[:8],
				TenantID:      tenantID,
				PriceListName: def.PriceListName,
				Currency:      def.Currency,
				Buying:        def.Buying,
				Selling:       def.Selling,
				Enabled:       def.Enabled,
			}
			if err := db.Create(&newPL).Error; err != nil {
				log.Printf("[PriceListSeeder] Failed to seed Price List %s: %v\n", def.PriceListName, err)
				return err
			}
		}
	}
	return nil
}
