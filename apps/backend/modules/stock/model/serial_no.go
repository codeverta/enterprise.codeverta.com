package model

import (
	"time"
)

type SerialNoStatus string

const (
	SerialNoStatusAvailable SerialNoStatus = "Available"
	SerialNoStatusDelivered SerialNoStatus = "Delivered"
	SerialNoStatusExpired   SerialNoStatus = "Expired"
	SerialNoStatusInactive  SerialNoStatus = "Inactive"
)

type SerialNo struct {
	ID                   string         `gorm:"primaryKey;size:64" json:"id"`
	TenantID             string         `gorm:"size:64;not null;index" json:"tenant_id"`
	SerialNo             string         `gorm:"size:140;not null;index" json:"serial_no"`
	ItemCode             string         `gorm:"size:120;not null;index" json:"item_code"`
	ItemName             string         `gorm:"size:180" json:"item_name"`
	Description          string         `gorm:"type:text" json:"description"`
	Warehouse            string         `gorm:"size:180;index" json:"warehouse"`
	Company              string         `gorm:"size:180;index" json:"company"`
	Status               SerialNoStatus `gorm:"size:40;not null;default:'Available';index" json:"status"`
	BatchNo              string         `gorm:"size:120;index" json:"batch_no"`

	// Purchase / Manufacture Details
	PurchaseDocumentType string     `gorm:"size:80" json:"purchase_document_type"`
	PurchaseDocumentNo   string     `gorm:"size:120;index" json:"purchase_document_no"`
	PurchaseDate         *time.Time `json:"purchase_date"`
	PurchaseRate         float64    `gorm:"type:decimal(18,2);default:0" json:"purchase_rate"`
	Supplier             string     `gorm:"size:180" json:"supplier"`
	SupplierName         string     `gorm:"size:180" json:"supplier_name"`

	// Delivery Details
	DeliveryDocumentType string     `gorm:"size:80" json:"delivery_document_type"`
	DeliveryDocumentNo   string     `gorm:"size:120;index" json:"delivery_document_no"`
	DeliveryDate         *time.Time `json:"delivery_date"`
	Customer             string     `gorm:"size:180" json:"customer"`
	CustomerName         string     `gorm:"size:180" json:"customer_name"`

	// Warranty / AMC Details
	WarrantyPeriod     int        `gorm:"default:0" json:"warranty_period"` // in days
	WarrantyExpiryDate *time.Time `json:"warranty_expiry_date"`
	AMCExpiryDate      *time.Time `json:"amc_expiry_date"`
	MaintenanceStatus  string     `gorm:"size:80" json:"maintenance_status"`

	// Additional Info
	Notes     string    `gorm:"type:text" json:"notes"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

func (SerialNo) TableName() string {
	return "stock_serial_nos"
}
