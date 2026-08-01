package crm

import (
	"time"

	"github.com/google/uuid"
)

type Activity struct {
	Base
	Type          string     `json:"type" gorm:"type:varchar(20);not null;index" binding:"required,oneof=call email meeting task"`
	Subject       string     `json:"subject" gorm:"type:varchar(150);index" binding:"max=150"`
	Description   string     `json:"description" gorm:"type:text"`
	RelatedToType string     `json:"related_to_type" gorm:"type:varchar(30);not null;index:idx_crm_activity_related,priority:1" binding:"required,oneof=lead account contact opportunity ticket"`
	RelatedToID   uuid.UUID  `json:"related_to_id" gorm:"type:char(36);not null;index:idx_crm_activity_related,priority:2" binding:"required"`
	OwnerID       *uuid.UUID `json:"owner_id" gorm:"type:char(36);index"`
	DueDate       *time.Time `json:"due_date" gorm:"index"`
	Status        string     `json:"status" gorm:"type:varchar(20);not null;default:'pending';index" binding:"omitempty,oneof=pending completed cancelled"`
	CompletedAt   *time.Time `json:"completed_at"`
}

func (Activity) TableName() string { return "crm_activities" }

type Ticket struct {
	Base
	Subject     string     `json:"subject" gorm:"type:varchar(150);not null;index" binding:"required,max=150"`
	Description string     `json:"description" gorm:"type:text"`
	AccountID   *uuid.UUID `json:"account_id" gorm:"type:char(36);index"`
	ContactID   *uuid.UUID `json:"contact_id" gorm:"type:char(36);index"`
	AssignedTo  *uuid.UUID `json:"assigned_to" gorm:"type:char(36);index"`
	Priority    string     `json:"priority" gorm:"type:varchar(20);not null;default:'normal';index" binding:"omitempty,oneof=low normal high urgent"`
	Status      string     `json:"status" gorm:"type:varchar(20);not null;default:'open';index" binding:"omitempty,oneof=open in_progress resolved closed"`
	ResolvedAt  *time.Time `json:"resolved_at"`
}

func (Ticket) TableName() string { return "crm_tickets" }

type TicketComment struct {
	Base
	TicketID uuid.UUID `json:"ticket_id" gorm:"type:char(36);not null;index" binding:"required"`
	UserID   uuid.UUID `json:"user_id" gorm:"type:char(36);not null;index"`
	Comment  string    `json:"comment" gorm:"type:text;not null" binding:"required"`
}

func (TicketComment) TableName() string { return "crm_ticket_comments" }

type Note struct {
	Base
	RelatedToType string    `json:"related_to_type" gorm:"type:varchar(30);not null;index:idx_crm_note_related,priority:1" binding:"required,oneof=lead account contact opportunity ticket campaign"`
	RelatedToID   uuid.UUID `json:"related_to_id" gorm:"type:char(36);not null;index:idx_crm_note_related,priority:2" binding:"required"`
	Content       string    `json:"content" gorm:"type:text;not null" binding:"required"`
	CreatedBy     uuid.UUID `json:"created_by" gorm:"type:char(36);not null;index"`
}

func (Note) TableName() string { return "crm_notes" }

// Attachment references the existing core files table instead of duplicating
// file metadata and storage concerns inside CRM.
type Attachment struct {
	Base
	RelatedToType string    `json:"related_to_type" gorm:"type:varchar(30);not null;index:idx_crm_attachment_related,priority:1" binding:"required,oneof=lead account contact opportunity ticket campaign"`
	RelatedToID   uuid.UUID `json:"related_to_id" gorm:"type:char(36);not null;index:idx_crm_attachment_related,priority:2" binding:"required"`
	FileID        uuid.UUID `json:"file_id" gorm:"type:char(36);not null;index" binding:"required"`
	UploadedBy    uuid.UUID `json:"uploaded_by" gorm:"type:char(36);not null;index"`
}

func (Attachment) TableName() string { return "crm_attachments" }

type Tag struct {
	Base
	Name string `json:"name" gorm:"type:varchar(50);not null;index" binding:"required,max=50"`
}

func (Tag) TableName() string { return "crm_tags" }

type Taggable struct {
	Base
	TagID         uuid.UUID `json:"tag_id" gorm:"type:char(36);not null;index" binding:"required"`
	RelatedToType string    `json:"related_to_type" gorm:"type:varchar(30);not null;index" binding:"required,oneof=lead account contact opportunity ticket campaign"`
	RelatedToID   uuid.UUID `json:"related_to_id" gorm:"type:char(36);not null;index" binding:"required"`
}

func (Taggable) TableName() string { return "crm_taggables" }
