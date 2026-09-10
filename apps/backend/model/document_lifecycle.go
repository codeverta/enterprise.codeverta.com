package model

import "time"

const (
	DocStatusDraft     = 0
	DocStatusSubmitted = 1
	DocStatusCancelled = 2
)

// BaseDocument is embedded by every transactional DocType that needs the
// Frappe-style Draft -> Submitted -> Cancelled -> Amended lifecycle.
type BaseDocument struct {
	ID             string     `gorm:"primaryKey;size:64" json:"id"`
	TenantID       string     `gorm:"size:64;not null;index" json:"tenant_id"`
	DocumentNo     string     `gorm:"size:180;not null;index" json:"document_no"`
	BaseDocumentNo string     `gorm:"size:180;not null;index" json:"base_document_no"`
	DocStatus      int        `gorm:"not null;default:0;index" json:"doc_status"`
	Version        uint       `gorm:"not null;default:1" json:"version"`
	AmendmentNo    int        `gorm:"not null;default:0" json:"amendment_no"`
	AmendedFrom    string     `gorm:"size:64;index" json:"amended_from"`
	SubmittedAt    *time.Time `json:"submitted_at"`
	CancelledAt    *time.Time `json:"cancelled_at"`
	CreatedAt      time.Time  `json:"created_at"`
	UpdatedAt      time.Time  `json:"updated_at"`
}

func (document *BaseDocument) DocumentBase() *BaseDocument { return document }

type DocumentRevision struct {
	ID         string    `gorm:"primaryKey;size:64" json:"id"`
	TenantID   string    `gorm:"size:64;not null;index:idx_document_revision_lookup,priority:1" json:"tenant_id"`
	DocType    string    `gorm:"size:120;not null;index:idx_document_revision_lookup,priority:2" json:"doctype"`
	DocumentID string    `gorm:"size:64;not null;index:idx_document_revision_lookup,priority:3" json:"document_id"`
	Version    uint      `gorm:"not null" json:"version"`
	Action     string    `gorm:"size:32;not null" json:"action"`
	Data       string    `gorm:"type:text;not null" json:"data"`
	ActorID    string    `gorm:"size:64;index" json:"actor_id"`
	CreatedAt  time.Time `json:"created_at"`
}

func (DocumentRevision) TableName() string { return "document_revisions" }
