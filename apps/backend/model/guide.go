package model

import (
	"fmt"
	"gin-template/common"
	"regexp"
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type Guide struct {
	ID          uuid.UUID      `json:"id" gorm:"type:char(36);primaryKey"`
	Title       string         `json:"title" gorm:"type:varchar(200);not null"`
	Description string         `json:"description" gorm:"type:text"`
	YoutubeURL  string         `json:"youtube_url" gorm:"type:varchar(500)"`
	Category    string         `json:"category" gorm:"type:varchar(100);default:'umum';index"`
	Roles       string         `json:"roles" gorm:"type:varchar(200);default:'student'"`
	SortOrder   int            `json:"sort_order" gorm:"default:0"`
	CreatedAt   time.Time      `json:"created_at" gorm:"autoCreateTime"`
	UpdatedAt   time.Time      `json:"updated_at" gorm:"autoUpdateTime"`
	DeletedAt   gorm.DeletedAt `json:"deleted_at" gorm:"index"`

	TenantID *uuid.UUID `json:"tenant_id" gorm:"type:char(36);index"`
	Tenant   Tenant     `json:"-" gorm:"foreignKey:TenantID;constraint:OnUpdate:CASCADE,OnDelete:SET NULL;"`
}

func (g *Guide) BeforeCreate(tx *gorm.DB) error {
	if g.ID == uuid.Nil {
		g.ID = uuid.New()
	}
	if err := g.validate(); err != nil {
		return err
	}
	if tenant, ok := tx.Statement.Context.Value(common.CtxTenantKey).(Tenant); ok {
		g.TenantID = &tenant.ID
	} else {
		return fmt.Errorf("tenant_id is required for security isolation")
	}
	return nil
}

func (g *Guide) validate() error {
	if len(g.Title) > 200 {
		return fmt.Errorf("judul maksimal 200 karakter")
	}
	if len(g.Description) > 2000 {
		return fmt.Errorf("deskripsi maksimal 2000 karakter")
	}
	if g.YoutubeURL != "" {
		matched, _ := regexp.MatchString(
			`^(https?://)?(www\.)?(youtube\.com/watch\?v=|youtu\.be/)[\w-]{11}(\S*)?$`,
			g.YoutubeURL,
		)
		if !matched {
			return fmt.Errorf("URL harus dari YouTube (youtube.com/watch atau youtu.be)")
		}
	}
	return nil
}
