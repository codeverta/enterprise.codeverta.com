package model

import (
	"time"
)

type ShipmentStatus string

const (
	ShipmentStatusDraft     ShipmentStatus = "Draft"
	ShipmentStatusSubmitted ShipmentStatus = "Submitted"
	ShipmentStatusInTransit ShipmentStatus = "In Transit"
	ShipmentStatusDelivered ShipmentStatus = "Delivered"
	ShipmentStatusCancelled ShipmentStatus = "Cancelled"
)

type Shipment struct {
	ID        string    `gorm:"primaryKey;size:64" json:"id"`
	TenantID  string    `gorm:"size:64;not null;index" json:"tenant_id"`
	Number    string    `gorm:"size:64;not null;index;uniqueIndex:idx_shipment_number_tenant" json:"number"`
	Status    ShipmentStatus `gorm:"size:32;not null;default:'Draft';index" json:"status"`

	// Pickup From Section
	PickupFromType     string `gorm:"size:32;default:'Company'" json:"pickup_from_type"`
	PickupCompany      string `gorm:"size:180" json:"pickup_company"`
	PickupAddressName  string `gorm:"size:180" json:"pickup_address_name"`
	PickupAddress      string `gorm:"type:text" json:"pickup_address"`
	PickupContactPerson string `gorm:"size:180" json:"pickup_contact_person"`
	PickupContact      string `gorm:"size:180" json:"pickup_contact"`

	// Delivery To Section
	DeliveryToType     string `gorm:"size:32;default:'Customer'" json:"delivery_to_type"`
	DeliveryCustomer   string `gorm:"size:180" json:"delivery_customer"`
	DeliveryAddressName string `gorm:"size:180" json:"delivery_address_name"`
	DeliveryAddress    string `gorm:"type:text" json:"delivery_address"`
	DeliveryContactPerson string `gorm:"size:180" json:"delivery_contact_person"`
	DeliveryContact    string `gorm:"size:180" json:"delivery_contact"`

	// Parcels Summary
	TotalWeight float64 `gorm:"type:decimal(18,2);default:0" json:"total_weight"`

	// Shipment Details Section
	Pallets              bool      `gorm:"default:false" json:"pallets"`
	ValueOfGoods         float64   `gorm:"type:decimal(18,2);default:0" json:"value_of_goods"`
	PickupDate           *time.Time `json:"pickup_date"`
	PickupFromTime       string    `gorm:"size:32" json:"pickup_from"`
	PickupToTime         string    `gorm:"size:32" json:"pickup_to"`
	ShipmentType         string    `gorm:"size:32;default:'Goods'" json:"shipment_type"`
	PickupType           string    `gorm:"size:32;default:'Pickup'" json:"pickup_type"`
	Incoterm             string    `gorm:"size:32" json:"incoterm"`
	DescriptionOfContent string    `gorm:"type:text" json:"description_of_content"`

	// Shipment Information / Carrier & Tracking
	ServiceProvider string  `gorm:"size:120" json:"service_provider"`
	ShipmentID      string  `gorm:"size:120" json:"shipment_id"`
	ShipmentAmount  float64 `gorm:"type:decimal(18,2);default:0" json:"shipment_amount"`
	Carrier         string  `gorm:"size:120" json:"carrier"`
	CarrierService  string  `gorm:"size:120" json:"carrier_service"`
	AWBNumber       string  `gorm:"size:120;index" json:"awb_number"`
	TrackingStatus  string  `gorm:"size:120" json:"tracking_status"`

	// Child collections
	Parcels       []ShipmentParcel       `gorm:"foreignKey:ShipmentID;constraint:OnDelete:CASCADE" json:"parcels"`
	DeliveryNotes []ShipmentDeliveryNote `gorm:"foreignKey:ShipmentID;constraint:OnDelete:CASCADE" json:"delivery_notes"`

	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

func (Shipment) TableName() string { return "stock_shipments" }

type ShipmentParcel struct {
	ID             string  `gorm:"primaryKey;size:64" json:"id"`
	ShipmentID     string  `gorm:"size:64;not null;index" json:"shipment_id"`
	Idx            int     `gorm:"default:0" json:"idx"`
	Length         float64 `gorm:"type:decimal(18,2);default:0" json:"length"`
	Width          float64 `gorm:"type:decimal(18,2);default:0" json:"width"`
	Height         float64 `gorm:"type:decimal(18,2);default:0" json:"height"`
	Weight         float64 `gorm:"type:decimal(18,2);default:0" json:"weight"`
	Count          int     `gorm:"default:1" json:"count"`
	ParcelTemplate string  `gorm:"size:120" json:"parcel_template"`
}

func (ShipmentParcel) TableName() string { return "stock_shipment_parcels" }

type ShipmentDeliveryNote struct {
	ID           string  `gorm:"primaryKey;size:64" json:"id"`
	ShipmentID   string  `gorm:"size:64;not null;index" json:"shipment_id"`
	Idx          int     `gorm:"default:0" json:"idx"`
	DeliveryNote string  `gorm:"size:180;not null" json:"delivery_note"`
	Value        float64 `gorm:"type:decimal(18,2);default:0" json:"value"`
}

func (ShipmentDeliveryNote) TableName() string { return "stock_shipment_delivery_notes" }
