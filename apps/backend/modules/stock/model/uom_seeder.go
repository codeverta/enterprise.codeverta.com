package model

import (
	"log"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type DefaultUOMSeed struct {
	UOMName           string
	Symbol            string
	CommonCode        string
	Description       string
	MustBeWholeNumber bool
}

var DefaultUOMs = []DefaultUOMSeed{
	{UOMName: "Unit", Symbol: "U", CommonCode: "C62", MustBeWholeNumber: true, Description: "Unit / Satuan umum"},
	{UOMName: "Nos", Symbol: "Nos", CommonCode: "C62", MustBeWholeNumber: true, Description: "Numbers / Jumlah satuan"},
	{UOMName: "Pcs", Symbol: "pcs", CommonCode: "H87", MustBeWholeNumber: true, Description: "Pieces / Keping atau potong"},
	{UOMName: "Box", Symbol: "box", CommonCode: "BX", MustBeWholeNumber: true, Description: "Box / Kotak pembungkus"},
	{UOMName: "Kg", Symbol: "kg", CommonCode: "KGM", MustBeWholeNumber: false, Description: "Kilogram / Satuan berat dasar"},
	{UOMName: "Gram", Symbol: "g", CommonCode: "GRM", MustBeWholeNumber: false, Description: "Gram / Satuan berat kecil"},
	{UOMName: "Meter", Symbol: "m", CommonCode: "MTR", MustBeWholeNumber: false, Description: "Meter / Satuan panjang"},
	{UOMName: "Centimeter", Symbol: "cm", CommonCode: "CMT", MustBeWholeNumber: false, Description: "Centimeter / Satuan panjang"},
	{UOMName: "Millimeter", Symbol: "mm", CommonCode: "MMT", MustBeWholeNumber: false, Description: "Milimeter / Satuan presisi"},
	{UOMName: "Liter", Symbol: "L", CommonCode: "LTR", MustBeWholeNumber: false, Description: "Liter / Satuan volume cairan"},
	{UOMName: "Milliliter", Symbol: "mL", CommonCode: "MLT", MustBeWholeNumber: false, Description: "Mililiter / Satuan volume cairan"},
	{UOMName: "Set", Symbol: "set", CommonCode: "SET", MustBeWholeNumber: true, Description: "Set / Pasangan komplit"},
	{UOMName: "Roll", Symbol: "roll", CommonCode: "ROL", MustBeWholeNumber: true, Description: "Roll / Gulungan"},
	{UOMName: "Pack", Symbol: "pk", CommonCode: "PK", MustBeWholeNumber: true, Description: "Pack / Paket kemasan"},
	{UOMName: "Pair", Symbol: "pr", CommonCode: "PR", MustBeWholeNumber: true, Description: "Pair / Sepasang"},
	{UOMName: "Lusin", Symbol: "doz", CommonCode: "DZN", MustBeWholeNumber: true, Description: "Dozen / Lusin (12 pcs)"},
	{UOMName: "Kodi", Symbol: "kodi", CommonCode: "C62", MustBeWholeNumber: true, Description: "Kodi (20 keping)"},
	{UOMName: "Rim", Symbol: "rim", CommonCode: "RM", MustBeWholeNumber: true, Description: "Ream / Rim kertas (500 lembar)"},
	{UOMName: "Pallet", Symbol: "plt", CommonCode: "PF", MustBeWholeNumber: true, Description: "Pallet / Palet logistik"},
	{UOMName: "Ton", Symbol: "t", CommonCode: "TNE", MustBeWholeNumber: false, Description: "Metric Ton (1.000 kg)"},
	{UOMName: "Hour", Symbol: "h", CommonCode: "HUR", MustBeWholeNumber: false, Description: "Hour / Jam kerja atau jasa"},
	{UOMName: "Day", Symbol: "d", CommonCode: "DAY", MustBeWholeNumber: false, Description: "Day / Hari kerja atau sewa"},
}

// SeedUOMs populates default standard UOMs for a tenant
func SeedUOMs(db *gorm.DB, tenantID string) error {
	for _, def := range DefaultUOMs {
		var existing UOM
		err := db.Where("(tenant_id = ? OR tenant_id = '' OR tenant_id IS NULL) AND uom_name = ?", tenantID, def.UOMName).First(&existing).Error
		if err == gorm.ErrRecordNotFound {
			newUOM := UOM{
				ID:                "uom-" + uuid.NewString()[:8],
				TenantID:          tenantID,
				UOMName:           def.UOMName,
				Symbol:            def.Symbol,
				CommonCode:        def.CommonCode,
				Description:       def.Description,
				Enabled:           true,
				MustBeWholeNumber: def.MustBeWholeNumber,
			}
			if err := db.Create(&newUOM).Error; err != nil {
				log.Printf("[UOMSeeder] Failed to seed UOM %s: %v\n", def.UOMName, err)
			}
		}
	}
	return nil
}
