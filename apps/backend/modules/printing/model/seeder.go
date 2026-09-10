package model

import (
	"crypto/sha1"
	"fmt"
	"strings"

	"gorm.io/gorm"
)

type DefaultPrintFormatSeed struct {
	Name     string
	DocType  string
	Disabled bool
}

var DefaultPrintFormats = []DefaultPrintFormatSeed{
	{Name: "Rabih Print Format", DocType: "Sales Invoice"},
	{Name: "Codeverta Sales Invoice", DocType: "Sales Invoice"},
	{Name: "Label Alamat Pengiriman", DocType: "Delivery Note"},
	{Name: "Sales Order with Item Image", DocType: "Sales Order"},
	{Name: "Sales Order Standard", DocType: "Sales Order"},
	{Name: "Purchase Invoice with Item Image", DocType: "Purchase Invoice"},
	{Name: "Purchase Invoice Standard", DocType: "Purchase Invoice"},
	{Name: "POS Invoice with Item Image", DocType: "POS Invoice"},
	{Name: "Delivery Note with Item Image", DocType: "Delivery Note"},
	{Name: "Purchase Order with Item Image", DocType: "Purchase Order"},
	{Name: "POS Invoice Standard", DocType: "POS Invoice"},
	{Name: "Purchase Order Standard", DocType: "Purchase Order"},
	{Name: "Delivery Note Standard", DocType: "Delivery Note"},
	{Name: "Sales Invoice with Item Image", DocType: "Sales Invoice"},
	{Name: "Sales Invoice Standard", DocType: "Sales Invoice"},
	{Name: "Sales Invoice Print", DocType: "Sales Invoice"},
	{Name: "Purchase Receipt Serial and Batch Bundle Print", DocType: "Purchase Receipt"},
	{Name: "IRS 1099 Form", DocType: "Supplier"},
	{Name: "Return POS Invoice", DocType: "POS Invoice"},
	{Name: "Dunning Letter", DocType: "Dunning"},
	{Name: "Purchase eInvoice", DocType: "Purchase Invoice", Disabled: true},
	{Name: "Pick List", DocType: "Pick List"},
	{Name: "Sales Invoice Return", DocType: "Sales Invoice"},
	{Name: "Sales Auditing Voucher", DocType: "Sales Invoice"},
	{Name: "Journal Auditing Voucher", DocType: "Journal Entry"},
	{Name: "Bank and Cash Payment Voucher", DocType: "Payment Entry"},
	{Name: "Purchase Auditing Voucher", DocType: "Purchase Invoice"},
	{Name: "Tax Invoice", DocType: "Sales Invoice", Disabled: true},
	{Name: "Detailed Tax Invoice", DocType: "Sales Invoice", Disabled: true},
	{Name: "Simplified Tax Invoice", DocType: "Sales Invoice", Disabled: true},
	{Name: "Drop Shipping Format", DocType: "Purchase Order"},
	{Name: "Credit Note", DocType: "Journal Entry"},
	{Name: "Payment Receipt Voucher", DocType: "Journal Entry"},
	{Name: "Cheque Printing Format", DocType: "Journal Entry"},
	{Name: "POS Invoice", DocType: "POS Invoice"},
}

func defaultPrintFormatID(tenantID, name string) string {
	sum := sha1.Sum([]byte(tenantID + ":" + name))
	return fmt.Sprintf("pf-%x", sum[:8])
}

func moduleForDocType(docType string) string {
	switch docType {
	case "Sales Invoice", "Sales Order", "POS Invoice", "Delivery Note":
		return "Selling"
	case "Purchase Invoice", "Purchase Order", "Purchase Receipt", "Supplier":
		return "Buying"
	case "Pick List":
		return "Stock"
	case "Journal Entry", "Payment Entry", "Dunning":
		return "Accounting"
	default:
		return ""
	}
}

// SeedPrintFormats installs the standard catalogue without overwriting formats
// that were customized after installation.
func SeedPrintFormats(db *gorm.DB, tenantID string) error {
	tenantID = strings.TrimSpace(tenantID)
	if tenantID == "" {
		return fmt.Errorf("tenant id is required to seed Print Formats")
	}
	return db.Transaction(func(tx *gorm.DB) error {
		for _, seed := range DefaultPrintFormats {
			var existing PrintFormat
			err := tx.Where("tenant_id = ? AND name = ?", tenantID, seed.Name).First(&existing).Error
			if err == nil {
				continue
			}
			if err != gorm.ErrRecordNotFound {
				return fmt.Errorf("find Print Format %q: %w", seed.Name, err)
			}
			row := PrintFormat{
				ID:                   defaultPrintFormatID(tenantID, seed.Name),
				TenantID:             tenantID,
				Name:                 seed.Name,
				PrintFormatFor:       "DocType",
				DocType:              seed.DocType,
				Module:               moduleForDocType(seed.DocType),
				DefaultPrintLanguage: "id",
				Disabled:             seed.Disabled,
				PDFGenerator:         "chrome",
				MarginTop:            15,
				MarginBottom:         15,
				MarginLeft:           15,
				MarginRight:          15,
				ShowSectionHeadings:  true,
				PageNumber:           "Hide",
			}
			if err := tx.Create(&row).Error; err != nil {
				return fmt.Errorf("seed Print Format %q: %w", seed.Name, err)
			}
		}
		return nil
	})
}
