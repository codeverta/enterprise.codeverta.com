package model

import (
	"log"
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type DefaultStockEntryTypeSeed struct {
	Name        string
	Purpose     string
	Description string
}

var DefaultStockEntryTypes = []DefaultStockEntryTypeSeed{
	{
		Name:        "Material Issue",
		Purpose:     "Material Issue",
		Description: "Pengeluaran material atau barang dari gudang untuk keperluan internal atau operasional tanpa penjualan.",
	},
	{
		Name:        "Material Receipt",
		Purpose:     "Material Receipt",
		Description: "Penerimaan material atau barang ke dalam gudang dari sumber non-pembelian langsung.",
	},
	{
		Name:        "Material Transfer",
		Purpose:     "Material Transfer",
		Description: "Pemindahan stok barang antar gudang internal dalam perusahaan.",
	},
	{
		Name:        "Manufacture",
		Purpose:     "Manufacture",
		Description: "Proses produksi barang jadi dari bahan baku sesuai Bill of Materials (BOM).",
	},
	{
		Name:        "Repack",
		Purpose:     "Repack",
		Description: "Pengemasan ulang barang atau penggabungan beberapa komponen menjadi satu kemasan baru.",
	},
	{
		Name:        "Disassemble",
		Purpose:     "Disassemble",
		Description: "Pembongkaran barang jadi kembali menjadi komponen-komponen penyusunnya.",
	},
	{
		Name:        "Send to Subcontractor",
		Purpose:     "Send to Subcontractor",
		Description: "Pengiriman bahan baku atau komponen ke pihak subkontraktor untuk diproses.",
	},
	{
		Name:        "Material Transfer for Manufacture",
		Purpose:     "Material Transfer for Manufacture",
		Description: "Pemindahan bahan baku dari gudang penyimpanan ke gudang Work In Progress (WIP) produksi.",
	},
	{
		Name:        "Material Consumption for Manufacture",
		Purpose:     "Material Consumption for Manufacture",
		Description: "Konsumsi aktual bahan baku pada saat proses manufaktur berjalan.",
	},
	{
		Name:        "Receive from Customer",
		Purpose:     "Receive from Customer",
		Description: "Penerimaan barang dari customer untuk perbaikan, retur, atau pemrosesan khusus.",
	},
	{
		Name:        "Return Raw Material to Customer",
		Purpose:     "Return Raw Material to Customer",
		Description: "Pengembalian sisa bahan baku atau material titipan kembali ke customer.",
	},
	{
		Name:        "Subcontracting Delivery",
		Purpose:     "Subcontracting Delivery",
		Description: "Pengiriman barang hasil pekerjaan subkontrak ke gudang atau tujuan berikutnya.",
	},
	{
		Name:        "Subcontracting Return",
		Purpose:     "Subcontracting Return",
		Description: "Pengembalian bahan sisa atau cacat dari pihak subkontraktor.",
	},
}

// SeedStockEntryTypes populates the 13 standard stock entry types for a tenant
func SeedStockEntryTypes(db *gorm.DB, tenantID string) error {
	now := time.Now()
	for _, def := range DefaultStockEntryTypes {
		var existing StockEntryType
		err := db.Where("(tenant_id = ? OR tenant_id = '' OR tenant_id IS NULL) AND name = ?", tenantID, def.Name).First(&existing).Error
		if err == gorm.ErrRecordNotFound {
			newType := StockEntryType{
				ID:          "set-" + uuid.NewString()[:8],
				TenantID:    tenantID,
				Name:        def.Name,
				Purpose:     def.Purpose,
				IsStandard:  true,
				Disabled:    false,
				Description: def.Description,
				CreatedAt:   now,
				UpdatedAt:   now,
			}
			if err := db.Create(&newType).Error; err != nil {
				log.Printf("[StockEntryTypeSeeder] Failed to seed %s: %v\n", def.Name, err)
			}
		}
	}
	return nil
}
