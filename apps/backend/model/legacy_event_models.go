package model

import (
	"fmt"
	"gin-template/common"
	"time"

	"github.com/google/uuid"
	"gorm.io/datatypes"
	"gorm.io/gorm"
)

type TicketPriceType string

const (
	PriceNormal    TicketPriceType = "NORMAL"
	PriceEarlyBird TicketPriceType = "EARLY_BIRD"
)

type TicketCategory struct {
	ID           uuid.UUID      `gorm:"type:char(36);primaryKey" json:"id"`
	EventID      uuid.UUID      `gorm:"type:char(36);index" json:"event_id"`
	Name         string         `gorm:"type:varchar(100)" json:"name"`
	DistanceKM   float64        `json:"distance_km"`
	Requirements []string       `gorm:"serializer:json" json:"requirements"`
	Event        *Event         `gorm:"foreignKey:EventID;constraint:OnUpdate:CASCADE,OnDelete:CASCADE;" json:"event,omitempty"`
	Prices       []TicketPrice  `gorm:"foreignKey:TicketCategoryID" json:"prices"`
	CreatedAt    time.Time      `json:"created_at"`
	UpdatedAt    time.Time      `json:"updated_at"`
	DeletedAt    gorm.DeletedAt `gorm:"index" json:"-"`
	TenantID     *uuid.UUID     `json:"tenant_id" gorm:"type:char(36);index"`
	Tenant       *Tenant        `json:"tenant,omitempty" gorm:"foreignKey:TenantID;constraint:OnUpdate:CASCADE,OnDelete:SET NULL;"`
}

func (tc *TicketCategory) BeforeCreate(tx *gorm.DB) error {
	if tc.ID == uuid.Nil {
		tc.ID = uuid.New()
	}
	if tenant, ok := tx.Statement.Context.Value(common.CtxTenantKey).(Tenant); ok {
		tc.TenantID = &tenant.ID
		return nil
	}
	return fmt.Errorf("tenant_id is required for security isolation")
}

type TicketPrice struct {
	ID               uuid.UUID       `gorm:"type:char(36);primaryKey" json:"id"`
	TicketCategory   *TicketCategory `gorm:"foreignKey:TicketCategoryID;constraint:OnUpdate:CASCADE,OnDelete:CASCADE;" json:"ticket_category,omitempty"`
	TicketCategoryID uuid.UUID       `gorm:"type:char(36);index" json:"ticket_category_id"`
	Price            float64         `json:"price"`
	Type             TicketPriceType `gorm:"type:varchar(24);default:'NORMAL'" json:"type"`
	Quota            int             `json:"quota"`
	StartAt          time.Time       `json:"start_at"`
	EndAt            time.Time       `json:"end_at"`
	CreatedAt        time.Time       `json:"created_at"`
	UpdatedAt        time.Time       `json:"updated_at"`
	DeletedAt        gorm.DeletedAt  `gorm:"index" json:"-"`
	TenantID         *uuid.UUID      `json:"tenant_id" gorm:"type:char(36);index"`
	Tenant           *Tenant         `json:"tenant,omitempty" gorm:"foreignKey:TenantID;constraint:OnUpdate:CASCADE,OnDelete:SET NULL;"`
}

func (tp *TicketPrice) BeforeCreate(tx *gorm.DB) error {
	if tp.ID == uuid.Nil {
		tp.ID = uuid.New()
	}
	if tenant, ok := tx.Statement.Context.Value(common.CtxTenantKey).(Tenant); ok {
		tp.TenantID = &tenant.ID
		return nil
	}
	return fmt.Errorf("tenant_id is required for security isolation")
}

type TicketReservation struct {
	ID            uuid.UUID      `json:"id" gorm:"type:char(36);primaryKey"`
	ExpiresAt     time.Time      `gorm:"index"`
	Status        string         `gorm:"type:varchar(20);default:'ACTIVE'"`
	PriceSnapshot datatypes.JSON `gorm:"type:json"`
	TotalAmount   float64
	PromoCode     string
	Participants  int
	CreatedAt     *time.Time
	UpdatedAt     *time.Time
	TenantID      *uuid.UUID `json:"tenant_id" gorm:"type:char(36);index"`
	Tenant        Tenant     `gorm:"foreignKey:TenantID;constraint:OnUpdate:CASCADE,OnDelete:SET NULL;"`
}

func (tr *TicketReservation) BeforeCreate(tx *gorm.DB) error {
	if tr.ID == uuid.Nil {
		tr.ID = uuid.New()
	}
	if tenant, ok := tx.Statement.Context.Value(common.CtxTenantKey).(Tenant); ok {
		tr.TenantID = &tenant.ID
		return nil
	}
	return fmt.Errorf("tenant_id is required for security isolation")
}

type TrainingEvent struct {
	ID              uuid.UUID      `json:"id" gorm:"type:char(36);primaryKey"`
	Title           string         `gorm:"size:150;not null" json:"title" binding:"required"`
	Description     string         `gorm:"type:text" json:"description"`
	Location        string         `gorm:"size:255" json:"location"`
	StartTime       time.Time      `json:"start_time" binding:"required"`
	EndTime         *time.Time     `json:"end_time"`
	RegistrationURL string         `gorm:"size:255" json:"registration_url"`
	CreatedAt       time.Time      `json:"created_at"`
	UpdatedAt       time.Time      `json:"updated_at"`
	DeletedAt       gorm.DeletedAt `gorm:"index" json:"-"`
	TenantID        *uuid.UUID     `json:"tenant_id" gorm:"type:char(36);index"`
	Tenant          Tenant         `gorm:"foreignKey:TenantID;constraint:OnUpdate:CASCADE,OnDelete:SET NULL;"`
}

func (te *TrainingEvent) BeforeCreate(tx *gorm.DB) error {
	if te.ID == uuid.Nil {
		te.ID = uuid.New()
	}
	if tenant, ok := tx.Statement.Context.Value(common.CtxTenantKey).(Tenant); ok {
		te.TenantID = &tenant.ID
		return nil
	}
	return fmt.Errorf("tenant_id is required for security isolation")
}


