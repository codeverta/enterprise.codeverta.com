package model

import (
	"fmt"
	"gin-template/common"
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type ChatConversationStatus string
type ChatReceiverRole string

// ChatTargetRole is kept as a type alias so older code compiles while the
// conversation schema moves to sender/receiver naming.
type ChatTargetRole = ChatReceiverRole

const (
	ChatConversationOpen     ChatConversationStatus = "open"
	ChatConversationResolved ChatConversationStatus = "resolved"
	ChatConversationClosed   ChatConversationStatus = "closed"

	ChatReceiverMentor ChatReceiverRole = "mentor"
	ChatReceiverParent ChatReceiverRole = "parent"
	ChatReceiverAI     ChatReceiverRole = "ai"

	ChatTargetMentor = ChatReceiverMentor
	ChatTargetParent = ChatReceiverParent
	ChatTargetAI     = ChatReceiverAI
)

// ChatConversation is a thread between a sender and receiver,
// optionally scoped to a specific lesson.
type ChatConversation struct {
	ID           uuid.UUID              `json:"id" gorm:"type:char(36);primaryKey"`
	SenderID     uuid.UUID              `json:"sender_id" gorm:"type:char(36);not null;index"`
	Sender       User                   `json:"sender,omitempty" gorm:"foreignKey:SenderID;constraint:OnUpdate:CASCADE,OnDelete:CASCADE;"`
	ReceiverID   *uuid.UUID             `json:"receiver_id" gorm:"type:char(36);index"`
	Receiver     *User                  `json:"receiver,omitempty" gorm:"foreignKey:ReceiverID;constraint:OnUpdate:CASCADE,OnDelete:SET NULL;"`
	Title        string                 `json:"title" gorm:"type:varchar(220);not null"`
	Status       ChatConversationStatus `json:"status" gorm:"type:varchar(24);default:'open';index"`
	ReceiverRole ChatReceiverRole       `json:"receiver_role" gorm:"type:varchar(24);default:'mentor';index"`

	// Lesson context — optional, set when student asks from a lesson page
	LessonID    *uuid.UUID `json:"lesson_id" gorm:"type:char(36);index"`
	Lesson      *Lesson    `json:"lesson,omitempty" gorm:"foreignKey:LessonID;constraint:OnUpdate:CASCADE,OnDelete:SET NULL;"`
	LessonTitle string     `json:"lesson_title" gorm:"type:varchar(220)"`
	CourseID    *uuid.UUID `json:"course_id" gorm:"type:char(36);index"`
	Course      *Course    `json:"course,omitempty" gorm:"foreignKey:CourseID;constraint:OnUpdate:CASCADE,OnDelete:SET NULL;"`

	LastMessage   string     `json:"last_message" gorm:"type:text"`
	LastMessageAt *time.Time `json:"last_message_at" gorm:"index"`
	UnreadCount   int        `json:"unread_count" gorm:"default:0"` // unread by conversation sender
	IsArchived    bool       `json:"is_archived" gorm:"-"`
	IsPinned      bool       `json:"is_pinned" gorm:"-"`

	Messages  []ChatMessage  `json:"messages,omitempty" gorm:"foreignKey:ConversationID"`
	CreatedAt time.Time      `json:"created_at" gorm:"autoCreateTime"`
	UpdatedAt time.Time      `json:"updated_at" gorm:"autoUpdateTime"`
	DeletedAt gorm.DeletedAt `json:"deleted_at" gorm:"index"`

	TenantID *uuid.UUID `json:"tenant_id" gorm:"type:char(36);index"`
	Tenant   Tenant     `json:"-" gorm:"foreignKey:TenantID;constraint:OnUpdate:CASCADE,OnDelete:SET NULL;"`
}

type ChatConversationUserState struct {
	ID             uuid.UUID  `json:"id" gorm:"type:char(36);primaryKey"`
	ConversationID uuid.UUID  `json:"conversation_id" gorm:"type:char(36);not null;uniqueIndex:idx_chat_conversation_user_state"`
	UserID         uuid.UUID  `json:"user_id" gorm:"type:char(36);not null;uniqueIndex:idx_chat_conversation_user_state"`
	IsArchived     bool       `json:"is_archived" gorm:"not null;default:false;index"`
	IsPinned       bool       `json:"is_pinned" gorm:"not null;default:false;index"`
	ArchivedAt     *time.Time `json:"archived_at"`
	PinnedAt       *time.Time `json:"pinned_at"`
	CreatedAt      time.Time  `json:"created_at" gorm:"autoCreateTime"`
	UpdatedAt      time.Time  `json:"updated_at" gorm:"autoUpdateTime"`

	TenantID *uuid.UUID `json:"tenant_id" gorm:"type:char(36);index"`
}

func (m *ChatConversationUserState) BeforeCreate(tx *gorm.DB) error {
	if m.ID == uuid.Nil {
		m.ID = uuid.New()
	}
	if m.TenantID != nil {
		return nil
	}
	if tenant, ok := tx.Statement.Context.Value(common.CtxTenantKey).(Tenant); ok {
		m.TenantID = &tenant.ID
		return nil
	}
	return fmt.Errorf("tenant_id is required for security isolation")
}

func (m *ChatConversation) BeforeCreate(tx *gorm.DB) error {
	if m.ID == uuid.Nil {
		m.ID = uuid.New()
	}
	// Biarkan pengisian tenant dilakukan secara eksplisit di controller demi keamanan & kejelasan code
	return nil
}

// ChatMessage is a single message within a conversation.
// SenderRole distinguishes whether it was sent by the student,
// a mentor, or an admin so the frontend can render it correctly.
type ChatMessage struct {
	ID             uuid.UUID        `json:"id" gorm:"type:char(36);primaryKey"`
	ConversationID uuid.UUID        `json:"conversation_id" gorm:"type:char(36);not null;index"`
	Conversation   ChatConversation `json:"-" gorm:"foreignKey:ConversationID;constraint:OnUpdate:CASCADE,OnDelete:CASCADE;"`
	SenderID       uuid.UUID        `json:"sender_id" gorm:"type:char(36);not null;index"`
	Sender         User             `json:"sender,omitempty" gorm:"foreignKey:SenderID;constraint:OnUpdate:CASCADE,OnDelete:CASCADE;"`
	SenderName     string           `json:"sender_name" gorm:"type:varchar(160)"` // denormalised for performance
	SenderRole     LMSRole          `json:"sender_role" gorm:"type:varchar(24);index"`
	Body           string           `json:"body" gorm:"type:text;not null"`
	IsRead         bool             `json:"is_read" gorm:"default:false;index"`
	ReadAt         *time.Time       `json:"read_at"`

	// Lesson context — carried on the message that triggered the thread,
	// or on any subsequent message that references a lesson
	LessonID    *uuid.UUID `json:"lesson_id,omitempty" gorm:"type:char(36);index"`
	LessonTitle string     `json:"lesson_title,omitempty" gorm:"type:varchar(220)"`

	CreatedAt time.Time      `json:"created_at" gorm:"autoCreateTime"`
	UpdatedAt time.Time      `json:"updated_at" gorm:"autoUpdateTime"`
	DeletedAt gorm.DeletedAt `json:"deleted_at" gorm:"index"`

	TenantID *uuid.UUID `json:"tenant_id" gorm:"type:char(36);index"`
	Tenant   Tenant     `json:"-" gorm:"foreignKey:TenantID;constraint:OnUpdate:CASCADE,OnDelete:SET NULL;"`
}

type AIChatDailyUsage struct {
	ID         uuid.UUID      `json:"id" gorm:"type:char(36);primaryKey"`
	UserID     uuid.UUID      `json:"user_id" gorm:"type:char(36);not null;uniqueIndex:idx_ai_chat_user_date"`
	UsageDate  time.Time      `json:"usage_date" gorm:"type:date;not null;uniqueIndex:idx_ai_chat_user_date"`
	Used       int            `json:"used" gorm:"not null;default:0"`
	DailyLimit int            `json:"daily_limit" gorm:"not null;default:200"`
	CreatedAt  time.Time      `json:"created_at" gorm:"autoCreateTime"`
	UpdatedAt  time.Time      `json:"updated_at" gorm:"autoUpdateTime"`
	DeletedAt  gorm.DeletedAt `json:"deleted_at" gorm:"index"`

	TenantID *uuid.UUID `json:"tenant_id" gorm:"type:char(36);index"`
}

func (m *AIChatDailyUsage) BeforeCreate(tx *gorm.DB) error {
	if m.ID == uuid.Nil {
		m.ID = uuid.New()
	}
	if m.DailyLimit <= 0 {
		m.DailyLimit = 200
	}
	if tenant, ok := tx.Statement.Context.Value(common.CtxTenantKey).(Tenant); ok {
		m.TenantID = &tenant.ID
	} else {
		return fmt.Errorf("tenant_id is required for security isolation")
	}
	return nil
}

func (m *ChatMessage) BeforeCreate(tx *gorm.DB) error {
	if m.ID == uuid.Nil {
		m.ID = uuid.New()
	}
	if tenant, ok := tx.Statement.Context.Value(common.CtxTenantKey).(Tenant); ok {
		m.TenantID = &tenant.ID
	} else {
		return fmt.Errorf("tenant_id is required for security isolation")
	}
	return nil
}

// ChatModels returns all chat models for auto-migration.
func ChatModels() []interface{} {
	return []interface{}{
		&ChatConversation{},
		&ChatConversationUserState{},
		&ChatMessage{},
		&UserAppPreference{},
		&AIChatDailyUsage{},
		&RAGDocument{},
		&RAGDocumentChunk{},
	}
}
