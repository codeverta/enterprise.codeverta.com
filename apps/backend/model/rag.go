package model

import (
	"fmt"
	"gin-template/common"
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// RAGDocument stores application documentation managed by a superadmin.
// Its content is split into RAGDocumentChunk rows for bounded retrieval.
type RAGDocument struct {
	ID            uuid.UUID          `json:"id" gorm:"type:char(36);primaryKey"`
	Title         string             `json:"title" gorm:"type:varchar(220);not null;index"`
	SourceURL     string             `json:"source_url" gorm:"type:varchar(1000)"`
	Content       string             `json:"content,omitempty" gorm:"type:longtext;not null"`
	AudienceRoles string             `json:"audience_roles" gorm:"type:varchar(160);not null;default:'';index"`
	IsActive      bool               `json:"is_active" gorm:"not null;default:true;index"`
	CreatedByID   uuid.UUID          `json:"created_by_id" gorm:"type:char(36);not null;index"`
	ChunkCount    int                `json:"chunk_count" gorm:"not null;default:0"`
	CreatedAt     time.Time          `json:"created_at" gorm:"autoCreateTime"`
	UpdatedAt     time.Time          `json:"updated_at" gorm:"autoUpdateTime"`
	DeletedAt     gorm.DeletedAt     `json:"-" gorm:"index"`
	TenantID      *uuid.UUID         `json:"tenant_id" gorm:"type:char(36);not null;index"`
	Chunks        []RAGDocumentChunk `json:"-" gorm:"foreignKey:DocumentID;constraint:OnUpdate:CASCADE,OnDelete:CASCADE"`
}

type RAGDocumentChunk struct {
	ID            uuid.UUID  `json:"id" gorm:"type:char(36);primaryKey"`
	DocumentID    uuid.UUID  `json:"document_id" gorm:"type:char(36);not null;index;uniqueIndex:idx_rag_document_chunk"`
	ChunkIndex    int        `json:"chunk_index" gorm:"not null;uniqueIndex:idx_rag_document_chunk"`
	Content       string     `json:"content" gorm:"type:text;not null"`
	TokenEstimate int        `json:"token_estimate" gorm:"not null"`
	CreatedAt     time.Time  `json:"created_at" gorm:"autoCreateTime"`
	UpdatedAt     time.Time  `json:"updated_at" gorm:"autoUpdateTime"`
	TenantID      *uuid.UUID `json:"tenant_id" gorm:"type:char(36);not null;index;uniqueIndex:idx_rag_document_chunk"`
}

func ragTenantID(tx *gorm.DB) (*uuid.UUID, error) {
	if tenant, ok := tx.Statement.Context.Value(common.CtxTenantKey).(Tenant); ok {
		return &tenant.ID, nil
	}
	return nil, fmt.Errorf("tenant_id is required for security isolation")
}

func (m *RAGDocument) BeforeCreate(tx *gorm.DB) error {
	if m.ID == uuid.Nil {
		m.ID = uuid.New()
	}
	if m.TenantID == nil {
		tenantID, err := ragTenantID(tx)
		if err != nil {
			return err
		}
		m.TenantID = tenantID
	}
	return nil
}

func (m *RAGDocumentChunk) BeforeCreate(tx *gorm.DB) error {
	if m.ID == uuid.Nil {
		m.ID = uuid.New()
	}
	if m.TenantID == nil {
		tenantID, err := ragTenantID(tx)
		if err != nil {
			return err
		}
		m.TenantID = tenantID
	}
	return nil
}
