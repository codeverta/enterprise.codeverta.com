package model

import (
	"fmt"
	"gin-template/common"
	"strings"
	"time"

	"github.com/google/uuid"
	"gorm.io/datatypes"
	"gorm.io/gorm"
)

var validQuizQuestionTypes = map[QuizQuestionType]bool{
	QuizQuestionSingle:       true,
	QuizQuestionMultiple:     true,
	QuizQuestionTrueFalse:    true,
	QuizQuestionShortAnswer:  true,
	QuizQuestionArrangeWords: true,
}

type QuizQuestionImportRow struct {
	RowNumber    int
	QuestionText string
	QuestionType QuizQuestionType
	Points       float64
	Explanation  string
	IsRequired   bool
	OptionTexts  []string
	Correct      []int
	ShortAnswer  string
}

func (row QuizQuestionImportRow) Build(quizID uuid.UUID, sortOrder int) (QuizQuestion, []QuizOption, error) {
	questionText := strings.TrimSpace(row.QuestionText)
	if questionText == "" {
		return QuizQuestion{}, nil, fmt.Errorf("baris %d: question_text wajib diisi", row.RowNumber)
	}
	if !validQuizQuestionTypes[row.QuestionType] {
		return QuizQuestion{}, nil, fmt.Errorf("baris %d: question_type tidak didukung", row.RowNumber)
	}
	if row.Points <= 0 {
		return QuizQuestion{}, nil, fmt.Errorf("baris %d: points harus lebih dari 0", row.RowNumber)
	}

	question := QuizQuestion{
		QuizID:       quizID,
		QuestionText: questionText,
		QuestionType: row.QuestionType,
		Points:       row.Points,
		Explanation:  strings.TrimSpace(row.Explanation),
		SortOrder:    sortOrder,
		IsRequired:   row.IsRequired,
	}

	if row.QuestionType == QuizQuestionShortAnswer {
		answer := strings.TrimSpace(row.ShortAnswer)
		if answer == "" {
			return QuizQuestion{}, nil, fmt.Errorf("baris %d: correct_answer wajib diisi untuk short_answer", row.RowNumber)
		}
		return question, []QuizOption{{OptionText: answer, IsCorrect: true, SortOrder: 1}}, nil
	}

	options := make([]QuizOption, 0, len(row.OptionTexts))
	foundBlank := false
	for _, text := range row.OptionTexts {
		value := strings.TrimSpace(text)
		if value == "" {
			foundBlank = true
			continue
		}
		if foundBlank {
			return QuizQuestion{}, nil, fmt.Errorf("baris %d: pilihan jawaban harus diisi berurutan tanpa kolom kosong", row.RowNumber)
		}
		options = append(options, QuizOption{OptionText: value, SortOrder: len(options) + 1})
	}
	if len(options) < 2 {
		return QuizQuestion{}, nil, fmt.Errorf("baris %d: minimal 2 pilihan jawaban wajib diisi", row.RowNumber)
	}
	if row.QuestionType == QuizQuestionTrueFalse && len(options) != 2 {
		return QuizQuestion{}, nil, fmt.Errorf("baris %d: true_false harus memiliki tepat 2 pilihan", row.RowNumber)
	}

	correctCount := 0
	seen := map[int]bool{}
	for _, index := range row.Correct {
		if index < 1 || index > len(options) {
			return QuizQuestion{}, nil, fmt.Errorf("baris %d: correct_answer merujuk pilihan yang tidak tersedia", row.RowNumber)
		}
		if !seen[index] {
			options[index-1].IsCorrect = true
			seen[index] = true
			correctCount++
		}
	}
	if correctCount == 0 {
		return QuizQuestion{}, nil, fmt.Errorf("baris %d: correct_answer wajib diisi", row.RowNumber)
	}
	if row.QuestionType != QuizQuestionMultiple && correctCount != 1 {
		return QuizQuestion{}, nil, fmt.Errorf("baris %d: tipe %s hanya boleh memiliki 1 jawaban benar", row.RowNumber, row.QuestionType)
	}

	return question, options, nil
}

type Quiz struct {
	ID                                uuid.UUID      `json:"id" gorm:"type:char(36);primaryKey"`
	CourseID                          uuid.UUID      `json:"course_id" gorm:"type:char(36);not null;index"`
	Course                            Course         `json:"course,omitempty" gorm:"foreignKey:CourseID;constraint:OnUpdate:CASCADE,OnDelete:CASCADE;"`
	ModuleID                          *uuid.UUID     `json:"module_id" gorm:"type:char(36);index"`
	Module                            *Module        `json:"module,omitempty" gorm:"foreignKey:ModuleID;constraint:OnUpdate:CASCADE,OnDelete:CASCADE;"`
	LessonID                          *uuid.UUID     `json:"lesson_id" gorm:"type:char(36);index"`
	Lesson                            *Lesson        `json:"lesson,omitempty" gorm:"foreignKey:LessonID;constraint:OnUpdate:CASCADE,OnDelete:CASCADE;"`
	Title                             string         `json:"title" gorm:"type:varchar(180);not null;index"`
	Description                       string         `json:"description" gorm:"type:text"`
	Instructions                      string         `json:"instructions" gorm:"type:text"`
	PassingScore                      float64        `json:"passing_score" gorm:"type:decimal(5,2);default:70"`
	TimeLimitMin                      int            `json:"time_limit_min" gorm:"default:0"`
	MaxAttempts                       int            `json:"max_attempts" gorm:"default:1"`
	RandomizeQuestions                bool           `json:"randomize_questions" gorm:"default:false"`
	RandomizeAnswers                  bool           `json:"randomize_answers" gorm:"default:false"`
	ShowResultAfterSubmit             bool           `json:"show_result_after_submit" gorm:"default:true"`
	ShowCorrectAnswers                bool           `json:"show_correct_answers" gorm:"default:false"`
	RequirePassingScoreBeforeContinue bool           `json:"require_passing_score_before_continue" gorm:"default:false"`
	IsPublished                       bool           `json:"is_published" gorm:"default:false;index"`
	AvailableFrom                     *time.Time     `json:"available_from"`
	AvailableUntil                    *time.Time     `json:"available_until"`
	SortOrder                         int            `json:"sort_order" gorm:"default:0;index"`
	Questions                         []QuizQuestion `json:"questions,omitempty" gorm:"foreignKey:QuizID"`
	CreatedAt                         time.Time      `json:"created_at" gorm:"autoCreateTime"`
	UpdatedAt                         time.Time      `json:"updated_at" gorm:"autoUpdateTime"`
	DeletedAt                         gorm.DeletedAt `json:"deleted_at" gorm:"index"`

	TenantID *uuid.UUID `json:"tenant_id" gorm:"type:char(36);index"`
	Tenant   Tenant     `json:"-" gorm:"foreignKey:TenantID;constraint:OnUpdate:CASCADE,OnDelete:SET NULL;"`
}

func (m *Quiz) BeforeCreate(tx *gorm.DB) error {
	if m.ID == uuid.Nil {
		m.ID = uuid.New()
	}
	if m.MaxAttempts <= 0 {
		m.MaxAttempts = 1
	}
	if m.PassingScore <= 0 {
		m.PassingScore = 70
	}
	if tenant, ok := tx.Statement.Context.Value(common.CtxTenantKey).(Tenant); ok {
		m.TenantID = &tenant.ID
	} else {
		return fmt.Errorf("tenant_id is required for security isolation")
	}
	return nil
}

type QuizQuestion struct {
	ID            uuid.UUID        `json:"id" gorm:"type:char(36);primaryKey"`
	QuizID        uuid.UUID        `json:"quiz_id" gorm:"type:char(36);not null;index"`
	Quiz          Quiz             `json:"-" gorm:"foreignKey:QuizID;constraint:OnUpdate:CASCADE,OnDelete:CASCADE;"`
	QuestionText  string           `json:"question_text" gorm:"type:text;not null"`
	QuestionType  QuizQuestionType `json:"question_type" gorm:"type:varchar(32);not null;index"`
	Points        float64          `json:"points" gorm:"type:decimal(10,2);default:1"`
	Explanation   string           `json:"explanation" gorm:"type:text"`
	SortOrder     int              `json:"sort_order" gorm:"default:0;index"`
	IsRequired    bool             `json:"is_required" gorm:"default:true"`
	AlwaysCorrect bool             `json:"always_correct" gorm:"default:false"`
	Options       []QuizOption     `json:"options,omitempty" gorm:"foreignKey:QuestionID"`
	CreatedAt     time.Time        `json:"created_at" gorm:"autoCreateTime"`
	UpdatedAt     time.Time        `json:"updated_at" gorm:"autoUpdateTime"`
	DeletedAt     gorm.DeletedAt   `json:"deleted_at" gorm:"index"`

	TenantID *uuid.UUID `json:"tenant_id" gorm:"type:char(36);index"`
	Tenant   Tenant     `json:"-" gorm:"foreignKey:TenantID;constraint:OnUpdate:CASCADE,OnDelete:SET NULL;"`
}

func (m *QuizQuestion) BeforeCreate(tx *gorm.DB) error {
	if m.ID == uuid.Nil {
		m.ID = uuid.New()
	}
	if m.QuestionType == "" {
		m.QuestionType = QuizQuestionSingle
	}
	if m.Points <= 0 {
		m.Points = 1
	}
	if tenant, ok := tx.Statement.Context.Value(common.CtxTenantKey).(Tenant); ok {
		m.TenantID = &tenant.ID
	} else {
		return fmt.Errorf("tenant_id is required for security isolation")
	}
	return nil
}

type QuizOption struct {
	ID         uuid.UUID      `json:"id" gorm:"type:char(36);primaryKey"`
	QuestionID uuid.UUID      `json:"question_id" gorm:"type:char(36);not null;index"`
	Question   QuizQuestion   `json:"-" gorm:"foreignKey:QuestionID;constraint:OnUpdate:CASCADE,OnDelete:CASCADE;"`
	OptionText string         `json:"option_text" gorm:"type:text;not null"`
	IsCorrect  bool           `json:"is_correct" gorm:"default:false;index"`
	SortOrder  int            `json:"sort_order" gorm:"default:0;index"`
	CreatedAt  time.Time      `json:"created_at" gorm:"autoCreateTime"`
	UpdatedAt  time.Time      `json:"updated_at" gorm:"autoUpdateTime"`
	DeletedAt  gorm.DeletedAt `json:"deleted_at" gorm:"index"`

	TenantID *uuid.UUID `json:"tenant_id" gorm:"type:char(36);index"`
	Tenant   Tenant     `json:"-" gorm:"foreignKey:TenantID;constraint:OnUpdate:CASCADE,OnDelete:SET NULL;"`
}

func (m *QuizOption) BeforeCreate(tx *gorm.DB) error {
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

type QuizAttempt struct {
	ID            uuid.UUID         `json:"id" gorm:"type:char(36);primaryKey"`
	QuizID        uuid.UUID         `json:"quiz_id" gorm:"type:char(36);not null;index"`
	Quiz          Quiz              `json:"quiz,omitempty" gorm:"foreignKey:QuizID;constraint:OnUpdate:CASCADE,OnDelete:CASCADE;"`
	StudentID     uuid.UUID         `json:"student_id" gorm:"type:char(36);not null;index"`
	Student       User              `json:"-" gorm:"foreignKey:StudentID;constraint:OnUpdate:CASCADE,OnDelete:CASCADE;"`
	AttemptNumber int               `json:"attempt_number" gorm:"default:1;index"`
	Status        QuizAttemptStatus `json:"status" gorm:"type:varchar(24);default:'in_progress';index"`
	Score         float64           `json:"score" gorm:"type:decimal(6,2);default:0"`
	CorrectPoints float64           `json:"correct_points" gorm:"type:decimal(10,2);default:0"`
	TotalPoints   float64           `json:"total_points" gorm:"type:decimal(10,2);default:0"`
	StartedAt     time.Time         `json:"started_at" gorm:"autoCreateTime;index"`
	SubmittedAt   *time.Time        `json:"submitted_at"`
	DurationSec   int               `json:"duration_sec" gorm:"default:0"`
	Answers       []QuizAnswer      `json:"answers,omitempty" gorm:"foreignKey:AttemptID"`
	CreatedAt     time.Time         `json:"created_at" gorm:"autoCreateTime"`
	UpdatedAt     time.Time         `json:"updated_at" gorm:"autoUpdateTime"`
	DeletedAt     gorm.DeletedAt    `json:"deleted_at" gorm:"index"`

	TenantID *uuid.UUID `json:"tenant_id" gorm:"type:char(36);index"`
	Tenant   Tenant     `json:"-" gorm:"foreignKey:TenantID;constraint:OnUpdate:CASCADE,OnDelete:SET NULL;"`
}

func (m *QuizAttempt) BeforeCreate(tx *gorm.DB) error {
	if m.ID == uuid.Nil {
		m.ID = uuid.New()
	}
	if m.Status == "" {
		m.Status = QuizAttemptInProgress
	}
	if tenant, ok := tx.Statement.Context.Value(common.CtxTenantKey).(Tenant); ok {
		m.TenantID = &tenant.ID
	} else {
		return fmt.Errorf("tenant_id is required for security isolation")
	}
	return nil
}

type QuizAnswer struct {
	ID                uuid.UUID      `json:"id" gorm:"type:char(36);primaryKey"`
	AttemptID         uuid.UUID      `json:"attempt_id" gorm:"type:char(36);not null;index:idx_quiz_attempt_question,unique"`
	Attempt           QuizAttempt    `json:"-" gorm:"foreignKey:AttemptID;constraint:OnUpdate:CASCADE,OnDelete:CASCADE;"`
	QuestionID        uuid.UUID      `json:"question_id" gorm:"type:char(36);not null;index:idx_quiz_attempt_question,unique"`
	Question          QuizQuestion   `json:"question,omitempty" gorm:"foreignKey:QuestionID;constraint:OnUpdate:CASCADE,OnDelete:CASCADE;"`
	SelectedOptionIDs datatypes.JSON `json:"selected_option_ids" gorm:"type:json"`
	AnswerText        string         `json:"answer_text" gorm:"type:text"`
	IsCorrect         bool           `json:"is_correct" gorm:"default:false;index"`
	PointsAwarded     float64        `json:"points_awarded" gorm:"type:decimal(10,2);default:0"`
	CreatedAt         time.Time      `json:"created_at" gorm:"autoCreateTime"`
	UpdatedAt         time.Time      `json:"updated_at" gorm:"autoUpdateTime"`
	DeletedAt         gorm.DeletedAt `json:"deleted_at" gorm:"index"`

	TenantID *uuid.UUID `json:"tenant_id" gorm:"type:char(36);index"`
	Tenant   Tenant     `json:"-" gorm:"foreignKey:TenantID;constraint:OnUpdate:CASCADE,OnDelete:SET NULL;"`
}

func (m *QuizAnswer) BeforeCreate(tx *gorm.DB) error {
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

type QuizProgress struct {
	ID              uuid.UUID      `json:"id" gorm:"type:char(36);primaryKey"`
	StudentID       uuid.UUID      `json:"student_id" gorm:"type:char(36);not null;index:idx_student_quiz,unique"`
	CourseID        uuid.UUID      `json:"course_id" gorm:"type:char(36);not null;index"`
	ModuleID        *uuid.UUID     `json:"module_id" gorm:"type:char(36);index"`
	LessonID        *uuid.UUID     `json:"lesson_id" gorm:"type:char(36);index"`
	QuizID          uuid.UUID      `json:"quiz_id" gorm:"type:char(36);not null;index:idx_student_quiz,unique"`
	IsCompleted     bool           `json:"is_completed" gorm:"default:false;index"`
	IsPassed        bool           `json:"is_passed" gorm:"default:false;index"`
	BestScore       float64        `json:"best_score" gorm:"type:decimal(6,2);default:0"`
	BestAttemptID   *uuid.UUID     `json:"best_attempt_id" gorm:"type:char(36);index"`
	CompletedAt     *time.Time     `json:"completed_at"`
	ProgressPercent float64        `json:"progress_percent" gorm:"type:decimal(5,2);default:0"`
	CreatedAt       time.Time      `json:"created_at" gorm:"autoCreateTime"`
	UpdatedAt       time.Time      `json:"updated_at" gorm:"autoUpdateTime"`
	DeletedAt       gorm.DeletedAt `json:"deleted_at" gorm:"index"`

	TenantID *uuid.UUID `json:"tenant_id" gorm:"type:char(36);index"`
	Tenant   Tenant     `json:"-" gorm:"foreignKey:TenantID;constraint:OnUpdate:CASCADE,OnDelete:SET NULL;"`
}

func (m *QuizProgress) BeforeCreate(tx *gorm.DB) error {
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
