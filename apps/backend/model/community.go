package model

import (
	"context"
	"fmt"
	"gin-template/common"
	"os"
	"strings"
	"time"

	"github.com/google/uuid"
	"gorm.io/datatypes"
	"gorm.io/gorm"
)

type CommunityPostType string

const (
	CommunityPostTypeDiscussion   CommunityPostType = "discussion"
	CommunityPostTypeQuestion     CommunityPostType = "question"
	CommunityPostTypeMaterial     CommunityPostType = "material"
	CommunityPostTypeAnnouncement CommunityPostType = "announcement"
	CommunityPostTypeStudyTips    CommunityPostType = "study_tips"
	CommunityPostTypePoll         CommunityPostType = "poll"
	CommunityPostTypeShowcase     CommunityPostType = "showcase"
)

type CommunityPostStatus string

const (
	CommunityPostStatusDraft     CommunityPostStatus = "draft"
	CommunityPostStatusPublished CommunityPostStatus = "published"
	CommunityPostStatusHidden    CommunityPostStatus = "hidden"
	CommunityPostStatusArchived  CommunityPostStatus = "archived"
	CommunityPostStatusSolved    CommunityPostStatus = "solved"
)

type CommunityVisibility string

const (
	CommunityVisibilityPublic       CommunityVisibility = "public"
	CommunityVisibilityTenant       CommunityVisibility = "tenant"
	CommunityVisibilityCourse       CommunityVisibility = "course"
	CommunityVisibilityClass        CommunityVisibility = "class"
	CommunityVisibilityTeachersOnly CommunityVisibility = "teachers_only"
	CommunityVisibilityAdminsOnly   CommunityVisibility = "admins_only"
	CommunityVisibilityPrivate      CommunityVisibility = "private"
)

type CommunityReactionType string

const (
	CommunityReactionLike       CommunityReactionType = "like"
	CommunityReactionHelpful    CommunityReactionType = "helpful"
	CommunityReactionInsightful CommunityReactionType = "insightful"
	CommunityReactionThanks     CommunityReactionType = "thanks"
)

type CommunityReportStatus string

const (
	CommunityReportStatusPending   CommunityReportStatus = "pending"
	CommunityReportStatusRejected  CommunityReportStatus = "rejected"
	CommunityReportStatusApproved  CommunityReportStatus = "approved"
	CommunityReportStatusResolved  CommunityReportStatus = "resolved"
	CommunityReportStatusDuplicate CommunityReportStatus = "duplicate"
)

type CommunityPollChoiceMode string

const (
	CommunityPollChoiceSingle   CommunityPollChoiceMode = "single"
	CommunityPollChoiceMultiple CommunityPollChoiceMode = "multiple"
)

func communityBeforeCreate(tx *gorm.DB, id *uuid.UUID, tenantID **uuid.UUID) error {
	if *id == uuid.Nil {
		*id = uuid.New()
	}
	if tenantID != nil && *tenantID != nil {
		return nil
	}
	if tenant, ok := tx.Statement.Context.Value(common.CtxTenantKey).(Tenant); ok {
		if tenantID != nil {
			*tenantID = &tenant.ID
		}
		return nil
	}
	return fmt.Errorf("tenant_id is required for security isolation")
}

type CommunityCategory struct {
	ID           uuid.UUID      `json:"id" gorm:"type:char(36);primaryKey"`
	Name         string         `json:"name" gorm:"type:varchar(120);not null;index"`
	Slug         string         `json:"slug" gorm:"type:varchar(140);not null;index:idx_community_category_tenant_slug,unique"`
	Description  string         `json:"description" gorm:"type:text"`
	Icon         string         `json:"icon" gorm:"type:varchar(80)"`
	Color        string         `json:"color" gorm:"type:varchar(32)"`
	SortOrder    int            `json:"sort_order" gorm:"default:0;index"`
	IsVisible    bool           `json:"is_visible" gorm:"default:true;index"`
	CourseID     *uuid.UUID     `json:"course_id" gorm:"type:char(36);index"`
	Course       *Course        `json:"course,omitempty" gorm:"foreignKey:CourseID;constraint:OnUpdate:CASCADE,OnDelete:SET NULL;"`
	ClassID      *uuid.UUID     `json:"class_id" gorm:"type:char(36);index"`
	Class        *Class         `json:"class,omitempty" gorm:"foreignKey:ClassID;constraint:OnUpdate:CASCADE,OnDelete:SET NULL;"`
	AllowedRoles string         `json:"allowed_roles" gorm:"type:varchar(180);default:''"`
	CreatedAt    time.Time      `json:"created_at" gorm:"autoCreateTime"`
	UpdatedAt    time.Time      `json:"updated_at" gorm:"autoUpdateTime"`
	DeletedAt    gorm.DeletedAt `json:"deleted_at" gorm:"index"`

	TenantID *uuid.UUID `json:"tenant_id" gorm:"type:char(36);index;index:idx_community_category_tenant_slug,unique"`
	Tenant   Tenant     `json:"-" gorm:"foreignKey:TenantID;constraint:OnUpdate:CASCADE,OnDelete:SET NULL;"`
}

func (m *CommunityCategory) BeforeCreate(tx *gorm.DB) error {
	return communityBeforeCreate(tx, &m.ID, &m.TenantID)
}

type CommunityPost struct {
	ID                uuid.UUID           `json:"id" gorm:"type:char(36);primaryKey"`
	AuthorID          uuid.UUID           `json:"author_id" gorm:"type:char(36);not null;index"`
	Author            User                `json:"author,omitempty" gorm:"foreignKey:AuthorID;constraint:OnUpdate:CASCADE,OnDelete:RESTRICT;"`
	OrganizationID    *uuid.UUID          `json:"organization_id" gorm:"type:char(36);index"`
	Organization      *Organization       `json:"organization,omitempty" gorm:"foreignKey:OrganizationID;constraint:OnUpdate:CASCADE,OnDelete:SET NULL;"`
	CourseID          *uuid.UUID          `json:"course_id" gorm:"type:char(36);index"`
	Course            *Course             `json:"course,omitempty" gorm:"foreignKey:CourseID;constraint:OnUpdate:CASCADE,OnDelete:SET NULL;"`
	ClassID           *uuid.UUID          `json:"class_id" gorm:"type:char(36);index"`
	Class             *Class              `json:"class,omitempty" gorm:"foreignKey:ClassID;constraint:OnUpdate:CASCADE,OnDelete:SET NULL;"`
	CategoryID        *uuid.UUID          `json:"category_id" gorm:"type:char(36);index"`
	Category          *CommunityCategory  `json:"category,omitempty" gorm:"foreignKey:CategoryID;constraint:OnUpdate:CASCADE,OnDelete:SET NULL;"`
	Type              CommunityPostType   `json:"type" gorm:"type:varchar(32);not null;default:'discussion';index"`
	Title             string              `json:"title" gorm:"type:varchar(220);not null;index"`
	Content           string              `json:"content" gorm:"type:longtext"`
	Body              string              `json:"body,omitempty" gorm:"type:longtext"` // legacy compatibility for existing community_posts.body
	Status            CommunityPostStatus `json:"status" gorm:"type:varchar(32);not null;default:'draft';index"`
	Visibility        CommunityVisibility `json:"visibility" gorm:"type:varchar(32);not null;default:'tenant';index"`
	IsPublished       bool                `json:"is_published" gorm:"default:false;index"` // legacy compatibility
	IsPinned          bool                `json:"is_pinned" gorm:"default:false;index"`
	IsLocked          bool                `json:"is_locked" gorm:"default:false;index"`
	IsEdited          bool                `json:"is_edited" gorm:"default:false"`
	AcceptedCommentID *uuid.UUID          `json:"accepted_comment_id" gorm:"type:char(36);index"`
	ViewCount         int64               `json:"view_count" gorm:"default:0;not null"`
	ReactionCount     int64               `json:"reaction_count" gorm:"default:0;not null"`
	CommentCount      int64               `json:"comment_count" gorm:"default:0;not null"`
	BookmarkCount     int64               `json:"bookmark_count" gorm:"default:0;not null"`
	FollowCount       int64               `json:"follow_count" gorm:"default:0;not null"`
	PublishedAt       *time.Time          `json:"published_at" gorm:"index"`
	CreatedAt         time.Time           `json:"created_at" gorm:"autoCreateTime;index"`
	UpdatedAt         time.Time           `json:"updated_at" gorm:"autoUpdateTime"`
	DeletedAt         gorm.DeletedAt      `json:"deleted_at" gorm:"index"`

	TenantID *uuid.UUID `json:"tenant_id" gorm:"type:char(36);index"`
	Tenant   Tenant     `json:"-" gorm:"foreignKey:TenantID;constraint:OnUpdate:CASCADE,OnDelete:SET NULL;"`
}

func (m *CommunityPost) BeforeCreate(tx *gorm.DB) error {
	return communityBeforeCreate(tx, &m.ID, &m.TenantID)
}

func (m *CommunityPost) BeforeSave(tx *gorm.DB) error {
	if strings.TrimSpace(m.Content) == "" && strings.TrimSpace(m.Body) != "" {
		m.Content = m.Body
	}
	if strings.TrimSpace(m.Body) == "" && strings.TrimSpace(m.Content) != "" {
		m.Body = m.Content
	}
	return nil
}

type CommunityPostMedia struct {
	ID               uuid.UUID         `json:"id" gorm:"type:char(36);primaryKey"`
	PostID           *uuid.UUID        `json:"post_id" gorm:"type:char(36);index"`
	Post             *CommunityPost    `json:"-" gorm:"foreignKey:PostID;constraint:OnUpdate:CASCADE,OnDelete:SET NULL;"`
	CommentID        *uuid.UUID        `json:"comment_id" gorm:"type:char(36);index"`
	Comment          *CommunityComment `json:"-" gorm:"foreignKey:CommentID;constraint:OnUpdate:CASCADE,OnDelete:SET NULL;"`
	UploaderID       uuid.UUID         `json:"uploader_id" gorm:"type:char(36);not null;index"`
	Uploader         User              `json:"uploader,omitempty" gorm:"foreignKey:UploaderID;constraint:OnUpdate:CASCADE,OnDelete:RESTRICT;"`
	FileName         string            `json:"file_name" gorm:"type:varchar(255);not null"`
	OriginalFileName string            `json:"original_file_name" gorm:"type:varchar(255);not null"`
	FileURL          string            `json:"file_url" gorm:"type:text;not null"`
	StoragePath      string            `json:"storage_path" gorm:"type:text;not null"`
	MimeType         string            `json:"mime_type" gorm:"type:varchar(160);not null;index"`
	FileSize         int64             `json:"file_size" gorm:"not null;default:0"`
	Width            int               `json:"width" gorm:"default:0"`
	Height           int               `json:"height" gorm:"default:0"`
	ThumbnailURL     string            `json:"thumbnail_url" gorm:"type:text"`
	CreatedAt        time.Time         `json:"created_at" gorm:"autoCreateTime"`
	DeletedAt        gorm.DeletedAt    `json:"deleted_at" gorm:"index"`

	TenantID *uuid.UUID `json:"tenant_id" gorm:"type:char(36);index"`
	Tenant   Tenant     `json:"-" gorm:"foreignKey:TenantID;constraint:OnUpdate:CASCADE,OnDelete:SET NULL;"`
}

func (m *CommunityPostMedia) BeforeCreate(tx *gorm.DB) error {
	return communityBeforeCreate(tx, &m.ID, &m.TenantID)
}

type CommunityComment struct {
	ID               uuid.UUID         `json:"id" gorm:"type:char(36);primaryKey"`
	PostID           uuid.UUID         `json:"post_id" gorm:"type:char(36);not null;index"`
	Post             CommunityPost     `json:"-" gorm:"foreignKey:PostID;constraint:OnUpdate:CASCADE,OnDelete:RESTRICT;"`
	ParentCommentID  *uuid.UUID        `json:"parent_comment_id" gorm:"type:char(36);index"`
	ParentComment    *CommunityComment `json:"-" gorm:"foreignKey:ParentCommentID;constraint:OnUpdate:CASCADE,OnDelete:SET NULL;"`
	AuthorID         uuid.UUID         `json:"author_id" gorm:"type:char(36);not null;index"`
	Author           User              `json:"author,omitempty" gorm:"foreignKey:AuthorID;constraint:OnUpdate:CASCADE,OnDelete:RESTRICT;"`
	Content          string            `json:"content" gorm:"type:longtext;not null"`
	Depth            int               `json:"depth" gorm:"default:0;index"`
	IsAnswer         bool              `json:"is_answer" gorm:"default:false;index"`
	IsAcceptedAnswer bool              `json:"is_accepted_answer" gorm:"default:false;index"`
	IsEdited         bool              `json:"is_edited" gorm:"default:false"`
	ReactionCount    int64             `json:"reaction_count" gorm:"default:0;not null"`
	ReplyCount       int64             `json:"reply_count" gorm:"default:0;not null"`
	CreatedAt        time.Time         `json:"created_at" gorm:"autoCreateTime;index"`
	UpdatedAt        time.Time         `json:"updated_at" gorm:"autoUpdateTime"`
	DeletedAt        gorm.DeletedAt    `json:"deleted_at" gorm:"index"`

	TenantID *uuid.UUID `json:"tenant_id" gorm:"type:char(36);index"`
	Tenant   Tenant     `json:"-" gorm:"foreignKey:TenantID;constraint:OnUpdate:CASCADE,OnDelete:SET NULL;"`
}

func (m *CommunityComment) BeforeCreate(tx *gorm.DB) error {
	return communityBeforeCreate(tx, &m.ID, &m.TenantID)
}

type CommunityReaction struct {
	ID           uuid.UUID             `json:"id" gorm:"type:char(36);primaryKey"`
	UserID       uuid.UUID             `json:"user_id" gorm:"type:char(36);not null;index;uniqueIndex:idx_community_reaction_user_target"`
	User         User                  `json:"user,omitempty" gorm:"foreignKey:UserID;constraint:OnUpdate:CASCADE,OnDelete:CASCADE;"`
	TargetType   string                `json:"target_type" gorm:"type:varchar(32);not null;index;uniqueIndex:idx_community_reaction_user_target"`
	TargetID     uuid.UUID             `json:"target_id" gorm:"type:char(36);not null;index;uniqueIndex:idx_community_reaction_user_target"`
	ReactionType CommunityReactionType `json:"reaction_type" gorm:"type:varchar(32);not null;default:'like';index"`
	CreatedAt    time.Time             `json:"created_at" gorm:"autoCreateTime"`
	UpdatedAt    time.Time             `json:"updated_at" gorm:"autoUpdateTime"`

	TenantID *uuid.UUID `json:"tenant_id" gorm:"type:char(36);index"`
	Tenant   Tenant     `json:"-" gorm:"foreignKey:TenantID;constraint:OnUpdate:CASCADE,OnDelete:SET NULL;"`
}

func (m *CommunityReaction) BeforeCreate(tx *gorm.DB) error {
	return communityBeforeCreate(tx, &m.ID, &m.TenantID)
}

type CommunityBookmark struct {
	ID        uuid.UUID     `json:"id" gorm:"type:char(36);primaryKey"`
	UserID    uuid.UUID     `json:"user_id" gorm:"type:char(36);not null;index;uniqueIndex:idx_community_bookmark_user_post"`
	User      User          `json:"user,omitempty" gorm:"foreignKey:UserID;constraint:OnUpdate:CASCADE,OnDelete:CASCADE;"`
	PostID    uuid.UUID     `json:"post_id" gorm:"type:char(36);not null;index;uniqueIndex:idx_community_bookmark_user_post"`
	Post      CommunityPost `json:"-" gorm:"foreignKey:PostID;constraint:OnUpdate:CASCADE,OnDelete:CASCADE;"`
	CreatedAt time.Time     `json:"created_at" gorm:"autoCreateTime"`

	TenantID *uuid.UUID `json:"tenant_id" gorm:"type:char(36);index"`
	Tenant   Tenant     `json:"-" gorm:"foreignKey:TenantID;constraint:OnUpdate:CASCADE,OnDelete:SET NULL;"`
}

func (m *CommunityBookmark) BeforeCreate(tx *gorm.DB) error {
	return communityBeforeCreate(tx, &m.ID, &m.TenantID)
}

type CommunityPostFollower struct {
	ID        uuid.UUID     `json:"id" gorm:"type:char(36);primaryKey"`
	UserID    uuid.UUID     `json:"user_id" gorm:"type:char(36);not null;index;uniqueIndex:idx_community_follower_user_post"`
	User      User          `json:"user,omitempty" gorm:"foreignKey:UserID;constraint:OnUpdate:CASCADE,OnDelete:CASCADE;"`
	PostID    uuid.UUID     `json:"post_id" gorm:"type:char(36);not null;index;uniqueIndex:idx_community_follower_user_post"`
	Post      CommunityPost `json:"-" gorm:"foreignKey:PostID;constraint:OnUpdate:CASCADE,OnDelete:CASCADE;"`
	CreatedAt time.Time     `json:"created_at" gorm:"autoCreateTime"`

	TenantID *uuid.UUID `json:"tenant_id" gorm:"type:char(36);index"`
	Tenant   Tenant     `json:"-" gorm:"foreignKey:TenantID;constraint:OnUpdate:CASCADE,OnDelete:SET NULL;"`
}

func (m *CommunityPostFollower) BeforeCreate(tx *gorm.DB) error {
	return communityBeforeCreate(tx, &m.ID, &m.TenantID)
}

type CommunityTag struct {
	ID        uuid.UUID      `json:"id" gorm:"type:char(36);primaryKey"`
	Name      string         `json:"name" gorm:"type:varchar(80);not null;index"`
	Slug      string         `json:"slug" gorm:"type:varchar(100);not null;index:idx_community_tag_tenant_slug,unique"`
	UseCount  int64          `json:"use_count" gorm:"default:0;not null;index"`
	CreatedAt time.Time      `json:"created_at" gorm:"autoCreateTime"`
	UpdatedAt time.Time      `json:"updated_at" gorm:"autoUpdateTime"`
	DeletedAt gorm.DeletedAt `json:"deleted_at" gorm:"index"`

	TenantID *uuid.UUID `json:"tenant_id" gorm:"type:char(36);index;index:idx_community_tag_tenant_slug,unique"`
	Tenant   Tenant     `json:"-" gorm:"foreignKey:TenantID;constraint:OnUpdate:CASCADE,OnDelete:SET NULL;"`
}

func (m *CommunityTag) BeforeCreate(tx *gorm.DB) error {
	return communityBeforeCreate(tx, &m.ID, &m.TenantID)
}

type CommunityPostTag struct {
	ID        uuid.UUID     `json:"id" gorm:"type:char(36);primaryKey"`
	PostID    uuid.UUID     `json:"post_id" gorm:"type:char(36);not null;index;uniqueIndex:idx_community_post_tag"`
	Post      CommunityPost `json:"-" gorm:"foreignKey:PostID;constraint:OnUpdate:CASCADE,OnDelete:CASCADE;"`
	TagID     uuid.UUID     `json:"tag_id" gorm:"type:char(36);not null;index;uniqueIndex:idx_community_post_tag"`
	Tag       CommunityTag  `json:"tag,omitempty" gorm:"foreignKey:TagID;constraint:OnUpdate:CASCADE,OnDelete:CASCADE;"`
	CreatedAt time.Time     `json:"created_at" gorm:"autoCreateTime"`

	TenantID *uuid.UUID `json:"tenant_id" gorm:"type:char(36);index"`
	Tenant   Tenant     `json:"-" gorm:"foreignKey:TenantID;constraint:OnUpdate:CASCADE,OnDelete:SET NULL;"`
}

func (m *CommunityPostTag) BeforeCreate(tx *gorm.DB) error {
	return communityBeforeCreate(tx, &m.ID, &m.TenantID)
}

type CommunityMention struct {
	ID              uuid.UUID  `json:"id" gorm:"type:char(36);primaryKey"`
	PostID          *uuid.UUID `json:"post_id" gorm:"type:char(36);index"`
	CommentID       *uuid.UUID `json:"comment_id" gorm:"type:char(36);index"`
	MentionedUserID uuid.UUID  `json:"mentioned_user_id" gorm:"type:char(36);not null;index;uniqueIndex:idx_community_mention_once"`
	MentionedUser   User       `json:"mentioned_user,omitempty" gorm:"foreignKey:MentionedUserID;constraint:OnUpdate:CASCADE,OnDelete:CASCADE;"`
	MentionedByID   uuid.UUID  `json:"mentioned_by_id" gorm:"type:char(36);not null;index"`
	MentionedBy     User       `json:"mentioned_by,omitempty" gorm:"foreignKey:MentionedByID;constraint:OnUpdate:CASCADE,OnDelete:CASCADE;"`
	SourceHash      string     `json:"source_hash" gorm:"type:varchar(80);not null;uniqueIndex:idx_community_mention_once"`
	CreatedAt       time.Time  `json:"created_at" gorm:"autoCreateTime"`

	TenantID *uuid.UUID `json:"tenant_id" gorm:"type:char(36);index"`
	Tenant   Tenant     `json:"-" gorm:"foreignKey:TenantID;constraint:OnUpdate:CASCADE,OnDelete:SET NULL;"`
}

func (m *CommunityMention) BeforeCreate(tx *gorm.DB) error {
	return communityBeforeCreate(tx, &m.ID, &m.TenantID)
}

type CommunityReport struct {
	ID          uuid.UUID             `json:"id" gorm:"type:char(36);primaryKey"`
	ReporterID  uuid.UUID             `json:"reporter_id" gorm:"type:char(36);not null;index;uniqueIndex:idx_community_report_once"`
	Reporter    User                  `json:"reporter,omitempty" gorm:"foreignKey:ReporterID;constraint:OnUpdate:CASCADE,OnDelete:RESTRICT;"`
	TargetType  string                `json:"target_type" gorm:"type:varchar(32);not null;index;uniqueIndex:idx_community_report_once"`
	TargetID    uuid.UUID             `json:"target_id" gorm:"type:char(36);not null;index;uniqueIndex:idx_community_report_once"`
	Reason      string                `json:"reason" gorm:"type:varchar(80);not null;index"`
	Description string                `json:"description" gorm:"type:text"`
	Status      CommunityReportStatus `json:"status" gorm:"type:varchar(32);not null;default:'pending';index"`
	ReviewedBy  *uuid.UUID            `json:"reviewed_by" gorm:"type:char(36);index"`
	Reviewer    *User                 `json:"reviewer,omitempty" gorm:"foreignKey:ReviewedBy;constraint:OnUpdate:CASCADE,OnDelete:SET NULL;"`
	ReviewedAt  *time.Time            `json:"reviewed_at"`
	Resolution  string                `json:"resolution" gorm:"type:text"`
	CreatedAt   time.Time             `json:"created_at" gorm:"autoCreateTime;index"`
	UpdatedAt   time.Time             `json:"updated_at" gorm:"autoUpdateTime"`

	TenantID *uuid.UUID `json:"tenant_id" gorm:"type:char(36);index;uniqueIndex:idx_community_report_once"`
	Tenant   Tenant     `json:"-" gorm:"foreignKey:TenantID;constraint:OnUpdate:CASCADE,OnDelete:SET NULL;"`
}

func (m *CommunityReport) BeforeCreate(tx *gorm.DB) error {
	return communityBeforeCreate(tx, &m.ID, &m.TenantID)
}

type CommunityModerationLog struct {
	ID          uuid.UUID      `json:"id" gorm:"type:char(36);primaryKey"`
	ModeratorID uuid.UUID      `json:"moderator_id" gorm:"type:char(36);not null;index"`
	Moderator   User           `json:"moderator,omitempty" gorm:"foreignKey:ModeratorID;constraint:OnUpdate:CASCADE,OnDelete:RESTRICT;"`
	TargetType  string         `json:"target_type" gorm:"type:varchar(32);not null;index"`
	TargetID    uuid.UUID      `json:"target_id" gorm:"type:char(36);not null;index"`
	Action      string         `json:"action" gorm:"type:varchar(80);not null;index"`
	Reason      string         `json:"reason" gorm:"type:text"`
	Metadata    datatypes.JSON `json:"metadata" gorm:"type:json"`
	CreatedAt   time.Time      `json:"created_at" gorm:"autoCreateTime;index"`

	TenantID *uuid.UUID `json:"tenant_id" gorm:"type:char(36);index"`
	Tenant   Tenant     `json:"-" gorm:"foreignKey:TenantID;constraint:OnUpdate:CASCADE,OnDelete:SET NULL;"`
}

func (m *CommunityModerationLog) BeforeCreate(tx *gorm.DB) error {
	return communityBeforeCreate(tx, &m.ID, &m.TenantID)
}

type CommunityPoll struct {
	ID              uuid.UUID               `json:"id" gorm:"type:char(36);primaryKey"`
	PostID          uuid.UUID               `json:"post_id" gorm:"type:char(36);not null;uniqueIndex:idx_community_polls_post_id"`
	Post            CommunityPost           `json:"-" gorm:"foreignKey:PostID;constraint:OnUpdate:CASCADE,OnDelete:CASCADE;"`
	Question        string                  `json:"question" gorm:"type:varchar(280);not null"`
	ChoiceMode      CommunityPollChoiceMode `json:"choice_mode" gorm:"type:varchar(24);not null;default:'single'"`
	IsAnonymous     bool                    `json:"is_anonymous" gorm:"default:false"`
	AllowChangeVote bool                    `json:"allow_change_vote" gorm:"default:false"`
	ClosesAt        *time.Time              `json:"closes_at" gorm:"index"`
	ClosedAt        *time.Time              `json:"closed_at" gorm:"index"`
	CreatedAt       time.Time               `json:"created_at" gorm:"autoCreateTime"`
	UpdatedAt       time.Time               `json:"updated_at" gorm:"autoUpdateTime"`
	DeletedAt       gorm.DeletedAt          `json:"deleted_at" gorm:"index"`

	TenantID *uuid.UUID `json:"tenant_id" gorm:"type:char(36);index"`
	Tenant   Tenant     `json:"-" gorm:"foreignKey:TenantID;constraint:OnUpdate:CASCADE,OnDelete:SET NULL;"`
}

func (m *CommunityPoll) BeforeCreate(tx *gorm.DB) error {
	return communityBeforeCreate(tx, &m.ID, &m.TenantID)
}

type CommunityPollOption struct {
	ID        uuid.UUID      `json:"id" gorm:"type:char(36);primaryKey"`
	PollID    uuid.UUID      `json:"poll_id" gorm:"type:char(36);not null;index"`
	Poll      CommunityPoll  `json:"-" gorm:"foreignKey:PollID;constraint:OnUpdate:CASCADE,OnDelete:CASCADE;"`
	Text      string         `json:"text" gorm:"type:varchar(220);not null"`
	SortOrder int            `json:"sort_order" gorm:"default:0;index"`
	VoteCount int64          `json:"vote_count" gorm:"default:0;not null"`
	CreatedAt time.Time      `json:"created_at" gorm:"autoCreateTime"`
	DeletedAt gorm.DeletedAt `json:"deleted_at" gorm:"index"`

	TenantID *uuid.UUID `json:"tenant_id" gorm:"type:char(36);index"`
	Tenant   Tenant     `json:"-" gorm:"foreignKey:TenantID;constraint:OnUpdate:CASCADE,OnDelete:SET NULL;"`
}

func (m *CommunityPollOption) BeforeCreate(tx *gorm.DB) error {
	return communityBeforeCreate(tx, &m.ID, &m.TenantID)
}

type CommunityPollVote struct {
	ID        uuid.UUID           `json:"id" gorm:"type:char(36);primaryKey"`
	PollID    uuid.UUID           `json:"poll_id" gorm:"type:char(36);not null;index;uniqueIndex:idx_community_poll_vote"`
	Poll      CommunityPoll       `json:"-" gorm:"foreignKey:PollID;constraint:OnUpdate:CASCADE,OnDelete:CASCADE;"`
	OptionID  uuid.UUID           `json:"option_id" gorm:"type:char(36);not null;index;uniqueIndex:idx_community_poll_vote"`
	Option    CommunityPollOption `json:"-" gorm:"foreignKey:OptionID;constraint:OnUpdate:CASCADE,OnDelete:CASCADE;"`
	VoterID   uuid.UUID           `json:"voter_id" gorm:"type:char(36);not null;index;uniqueIndex:idx_community_poll_vote"`
	Voter     User                `json:"voter,omitempty" gorm:"foreignKey:VoterID;constraint:OnUpdate:CASCADE,OnDelete:CASCADE;"`
	CreatedAt time.Time           `json:"created_at" gorm:"autoCreateTime"`
	UpdatedAt time.Time           `json:"updated_at" gorm:"autoUpdateTime"`

	TenantID *uuid.UUID `json:"tenant_id" gorm:"type:char(36);index"`
	Tenant   Tenant     `json:"-" gorm:"foreignKey:TenantID;constraint:OnUpdate:CASCADE,OnDelete:SET NULL;"`
}

func (m *CommunityPollVote) BeforeCreate(tx *gorm.DB) error {
	return communityBeforeCreate(tx, &m.ID, &m.TenantID)
}

type CommunityPostView struct {
	ID            uuid.UUID     `json:"id" gorm:"type:char(36);primaryKey"`
	PostID        uuid.UUID     `json:"post_id" gorm:"type:char(36);not null;index;uniqueIndex:idx_community_post_view_dedupe"`
	Post          CommunityPost `json:"-" gorm:"foreignKey:PostID;constraint:OnUpdate:CASCADE,OnDelete:CASCADE;"`
	UserID        *uuid.UUID    `json:"user_id" gorm:"type:char(36);index"`
	ViewerKey     string        `json:"viewer_key" gorm:"type:varchar(160);not null;uniqueIndex:idx_community_post_view_dedupe"`
	FirstViewedAt time.Time     `json:"first_viewed_at" gorm:"autoCreateTime"`
	LastViewedAt  time.Time     `json:"last_viewed_at" gorm:"autoUpdateTime"`
	ViewCount     int64         `json:"view_count" gorm:"default:1;not null"`

	TenantID *uuid.UUID `json:"tenant_id" gorm:"type:char(36);index"`
	Tenant   Tenant     `json:"-" gorm:"foreignKey:TenantID;constraint:OnUpdate:CASCADE,OnDelete:SET NULL;"`
}

func (m *CommunityPostView) BeforeCreate(tx *gorm.DB) error {
	return communityBeforeCreate(tx, &m.ID, &m.TenantID)
}

func CommunityModels() []interface{} {
	return []interface{}{
		&CommunityCategory{},
		&CommunityPost{},
		&CommunityPostMedia{},
		&CommunityComment{},
		&CommunityReaction{},
		&CommunityBookmark{},
		&CommunityPostFollower{},
		&CommunityTag{},
		&CommunityPostTag{},
		&CommunityMention{},
		&CommunityReport{},
		&CommunityModerationLog{},
		&CommunityPoll{},
		&CommunityPollOption{},
		&CommunityPollVote{},
		&CommunityPostView{},
	}
}

func EnsureCommunityFullTextIndex(db *gorm.DB) error {
	if db.Dialector.Name() != "mysql" {
		return nil
	}
	var count int64
	if err := db.Raw(`SELECT COUNT(*) FROM information_schema.statistics
		WHERE table_schema = DATABASE() AND table_name = 'community_posts'
		AND index_name = 'ft_community_posts_title_content'`).Scan(&count).Error; err != nil {
		return err
	}
	if count > 0 {
		return nil
	}
	return db.Exec("ALTER TABLE community_posts ADD FULLTEXT INDEX ft_community_posts_title_content (title, content, body)").Error
}

func SeedCommunityCategories(db *gorm.DB) error {
	if strings.ToLower(strings.TrimSpace(os.Getenv("SEED_COMMUNITY_DEV"))) != "true" {
		return nil
	}
	var tenants []Tenant
	if err := db.Set("skip_tenant_scope", true).Find(&tenants).Error; err != nil {
		return err
	}
	defaults := []CommunityCategory{
		{Name: "Diskusi Umum", Slug: "diskusi-umum", Icon: "message-circle", Color: "#2563eb", SortOrder: 10, IsVisible: true, AllowedRoles: "10,20,30,40,99,100"},
		{Name: "Pertanyaan", Slug: "pertanyaan", Icon: "help-circle", Color: "#7c3aed", SortOrder: 20, IsVisible: true, AllowedRoles: "10,20,30,40,99,100"},
		{Name: "Berbagi Materi", Slug: "berbagi-materi", Icon: "paperclip", Color: "#0891b2", SortOrder: 30, IsVisible: true, AllowedRoles: "30,40,99,100"},
		{Name: "Pengumuman", Slug: "pengumuman", Icon: "megaphone", Color: "#dc2626", SortOrder: 40, IsVisible: true, AllowedRoles: "30,40,99,100"},
		{Name: "Tips Belajar", Slug: "tips-belajar", Icon: "sparkles", Color: "#16a34a", SortOrder: 50, IsVisible: true, AllowedRoles: "10,20,30,40,99,100"},
		{Name: "Showcase", Slug: "showcase", Icon: "image", Color: "#ea580c", SortOrder: 60, IsVisible: true, AllowedRoles: "20,30,40,99,100"},
	}
	for _, tenant := range tenants {
		ctx := context.WithValue(context.Background(), common.CtxTenantKey, tenant)
		for _, item := range defaults {
			category := item
			category.ID = uuid.Nil
			category.TenantID = &tenant.ID
			if err := db.WithContext(ctx).Where("tenant_id = ? AND slug = ?", tenant.ID, category.Slug).FirstOrCreate(&category).Error; err != nil {
				return err
			}
		}
	}
	return nil
}
