package main

import (
	"bufio"
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"flag"
	"fmt"
	"net/url"
	"os"
	"path/filepath"
	"strings"
	"time"

	_ "github.com/go-sql-driver/mysql"
	"github.com/google/uuid"
)

const (
	tenantID = "550e8400-e29b-41d4-a716-446655440000"
	adminID  = "bff77934-9e4d-4e7b-a9b6-de36eb5689a1"
)

var importNamespace = uuid.MustParse("6f664709-282d-4fc5-bdd9-3e5a07d915cd")

type Payload struct {
	SourcePDF         string        `json:"source_pdf"`
	Volume            string        `json:"volume"`
	CourseSlugPattern string        `json:"course_slug_pattern"`
	Categories        []Category    `json:"categories"`
	Stats             PayloadStats  `json:"stats"`
	Errors            []ParseError  `json:"errors"`
	Courses           []CourseInput `json:"courses"`
}

type PayloadStats struct {
	Courses    int `json:"courses"`
	Errors     int `json:"errors"`
	Lessons    int `json:"lessons"`
	Quizzes    int `json:"quizzes"`
	Questions  int `json:"questions"`
	Options    int `json:"options"`
	Videos     int `json:"videos"`
	UniqueSlug int `json:"unique_slugs"`
}

type ParseError struct {
	SourceID string `json:"source_id"`
	Page     int    `json:"page"`
	Error    string `json:"error"`
}

type CourseInput struct {
	SourceID            string      `json:"source_id"`
	SkillNumber         string      `json:"skill_number"`
	CourseNumber        int         `json:"course_number"`
	SkillName           string      `json:"skill_name"`
	Title               string      `json:"title"`
	Slug                string      `json:"slug"`
	Description         string      `json:"description"`
	ShortDescription    string      `json:"short_description"`
	Level               string      `json:"level"`
	AgeRange            string      `json:"age_range"`
	Quarter             string      `json:"quarter"`
	SortOrder           int         `json:"sort_order"`
	MinimumPassingGrade float64     `json:"minimum_passing_grade"`
	AllowSkip           bool        `json:"allow_skip"`
	Status              string      `json:"status"`
	PageNumber          int         `json:"page_number"`
	Module              ModuleInput `json:"module"`
	Video               VideoInput  `json:"video"`
	Quiz                QuizInput   `json:"quiz"`
}

type ModuleInput struct {
	Title       string        `json:"title"`
	Description string        `json:"description"`
	SortOrder   int           `json:"sort_order"`
	Lessons     []LessonInput `json:"lessons"`
}

type LessonInput struct {
	Title                  string  `json:"title"`
	Summary                string  `json:"summary"`
	SortOrder              int     `json:"sort_order"`
	DurationSec            int     `json:"duration_sec"`
	RequireAttachment      bool    `json:"require_attachment"`
	AttachmentPassingScore float64 `json:"attachment_passing_score"`
}

type VideoInput struct {
	Title     string `json:"title"`
	URL       string `json:"url"`
	SortOrder int    `json:"sort_order"`
}

type QuizInput struct {
	Title                             string          `json:"title"`
	Description                       string          `json:"description"`
	Instructions                      string          `json:"instructions"`
	PassingScore                      float64         `json:"passing_score"`
	MaxAttempts                       int             `json:"max_attempts"`
	RandomizeQuestions                bool            `json:"randomize_questions"`
	RandomizeAnswers                  bool            `json:"randomize_answers"`
	ShowResultAfterSubmit             bool            `json:"show_result_after_submit"`
	ShowCorrectAnswers                bool            `json:"show_correct_answers"`
	RequirePassingScoreBeforeContinue bool            `json:"require_passing_score_before_continue"`
	SortOrder                         int             `json:"sort_order"`
	Questions                         []QuestionInput `json:"questions"`
}

type QuestionInput struct {
	Text        string        `json:"text"`
	Type        string        `json:"type"`
	Points      float64       `json:"points"`
	Explanation string        `json:"explanation"`
	SortOrder   int           `json:"sort_order"`
	IsRequired  bool          `json:"is_required"`
	Options     []OptionInput `json:"options"`
}

type OptionInput struct {
	Letter    string `json:"letter"`
	Text      string `json:"text"`
	IsCorrect bool   `json:"is_correct"`
	SortOrder int    `json:"sort_order"`
}

type ProgressEvent struct {
	Timestamp  string         `json:"timestamp"`
	Index      int            `json:"index,omitempty"`
	Total      int            `json:"total,omitempty"`
	SourceID   string         `json:"source_id,omitempty"`
	Slug       string         `json:"slug,omitempty"`
	Status     string         `json:"status"`
	DurationMS int64          `json:"duration_ms,omitempty"`
	Inserted   map[string]int `json:"inserted,omitempty"`
	Error      string         `json:"error,omitempty"`
}

type Category struct {
	SkillNumber string `json:"skill_number"`
	Name        string `json:"name"`
	Slug        string `json:"slug"`
	SortOrder   int    `json:"sort_order"`
}

func deterministicID(key string) string {
	return uuid.NewSHA1(importNamespace, []byte(key)).String()
}

func boolInt(value bool) int {
	if value {
		return 1
	}
	return 0
}

func placeholders(rowCount, columnCount int) string {
	row := "(" + strings.TrimSuffix(strings.Repeat("?,", columnCount), ",") + ")"
	return strings.TrimSuffix(strings.Repeat(row+",", rowCount), ",")
}

func readPayload(path string) (Payload, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return Payload{}, err
	}
	var payload Payload
	if err := json.Unmarshal(data, &payload); err != nil {
		return Payload{}, err
	}
	if len(payload.Errors) > 0 {
		return Payload{}, fmt.Errorf("parser reported %d errors", len(payload.Errors))
	}
	if payload.Stats.Courses != 300 || payload.Stats.Lessons != 1200 || payload.Stats.Quizzes != 300 ||
		payload.Stats.Questions != 1500 || payload.Stats.Options != 6000 || payload.Stats.Videos != 300 ||
		payload.Stats.UniqueSlug != 300 || len(payload.Courses) != 300 {
		return Payload{}, fmt.Errorf("unexpected parser stats: %+v", payload.Stats)
	}
	if payload.Volume == "" || payload.CourseSlugPattern == "" || len(payload.Categories) != 6 {
		return Payload{}, fmt.Errorf("missing or invalid import profile: volume=%q slug_pattern=%q categories=%d", payload.Volume, payload.CourseSlugPattern, len(payload.Categories))
	}
	return payload, nil
}

func openProgress(path string) (*os.File, *bufio.Writer, error) {
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		return nil, nil, err
	}
	file, err := os.OpenFile(path, os.O_CREATE|os.O_WRONLY|os.O_TRUNC, 0o644)
	if err != nil {
		return nil, nil, err
	}
	return file, bufio.NewWriter(file), nil
}

func writeEvent(writer *bufio.Writer, event ProgressEvent) {
	event.Timestamp = time.Now().UTC().Format(time.RFC3339Nano)
	data, _ := json.Marshal(event)
	_, _ = writer.Write(append(data, '\n'))
	_ = writer.Flush()
}

func preflight(ctx context.Context, db *sql.DB, payload Payload) error {
	var tenantCount, adminCount, existingCourseCount int
	if err := db.QueryRowContext(ctx, "SELECT COUNT(*) FROM tenants WHERE id=? AND deleted_at IS NULL AND is_active=1", tenantID).Scan(&tenantCount); err != nil {
		return err
	}
	if tenantCount != 1 {
		return fmt.Errorf("target tenant is missing or inactive")
	}
	if err := db.QueryRowContext(ctx, "SELECT COUNT(*) FROM users WHERE id=? AND tenant_id=? AND deleted_at IS NULL AND role=99", adminID, tenantID).Scan(&adminCount); err != nil {
		return err
	}
	if adminCount != 1 {
		return fmt.Errorf("target Super Admin is missing")
	}
	if err := db.QueryRowContext(ctx, "SELECT COUNT(*) FROM courses WHERE tenant_id=? AND deleted_at IS NULL AND slug LIKE ?", tenantID, payload.CourseSlugPattern).Scan(&existingCourseCount); err != nil {
		return err
	}
	if existingCourseCount != 0 {
		return fmt.Errorf("preflight found %d existing courses matching %q; refusing a non-idempotent duplicate import", existingCourseCount, payload.CourseSlugPattern)
	}
	seen := make(map[string]bool, len(payload.Courses))
	for _, course := range payload.Courses {
		if seen[course.Slug] {
			return fmt.Errorf("duplicate slug in payload: %s", course.Slug)
		}
		seen[course.Slug] = true
		if len(course.Module.Lessons) != 4 || len(course.Quiz.Questions) != 5 || course.Video.URL == "" {
			return fmt.Errorf("invalid structure for %s", course.SourceID)
		}
		for _, question := range course.Quiz.Questions {
			if len(question.Options) != 4 {
				return fmt.Errorf("invalid options for %s", course.SourceID)
			}
		}
	}
	return nil
}

func ensureCategories(ctx context.Context, db *sql.DB, payload Payload) (map[string]string, int, error) {
	result := make(map[string]string, len(payload.Categories))
	inserted := 0
	for _, category := range payload.Categories {
		var existingID string
		err := db.QueryRowContext(
			ctx,
			"SELECT id FROM course_categories WHERE tenant_id=? AND slug=? AND deleted_at IS NULL LIMIT 1",
			tenantID,
			category.Slug,
		).Scan(&existingID)
		if err == nil {
			result[category.SkillNumber] = existingID
			continue
		}
		if !errors.Is(err, sql.ErrNoRows) {
			return nil, inserted, err
		}
		categoryID := deterministicID("category:" + payload.Volume + ":" + category.SkillNumber)
		_, err = db.ExecContext(
			ctx,
			`INSERT INTO course_categories
			(id,name,slug,description,sort_order,is_active,created_at,updated_at,tenant_id)
			VALUES (?,?,?,?,?,1,NOW(3),NOW(3),?)`,
			categoryID,
			category.Name,
			category.Slug,
			"KITA Future Volume "+payload.Volume+" — "+category.Name,
			category.SortOrder,
			tenantID,
		)
		if err != nil {
			return nil, inserted, err
		}
		result[category.SkillNumber] = categoryID
		inserted++
	}
	return result, inserted, nil
}

func youtubeThumbnail(rawURL string) string {
	parsed, err := url.Parse(rawURL)
	if err != nil {
		return ""
	}
	videoID := parsed.Query().Get("v")
	if videoID == "" && parsed.Host == "youtu.be" {
		videoID = strings.Trim(parsed.Path, "/")
	}
	if videoID == "" {
		return ""
	}
	return "https://img.youtube.com/vi/" + videoID + "/hqdefault.jpg"
}

func insertCourse(ctx context.Context, db *sql.DB, course CourseInput, categoryID string) (map[string]int, error) {
	tx, err := db.BeginTx(ctx, &sql.TxOptions{Isolation: sql.LevelReadCommitted})
	if err != nil {
		return nil, err
	}
	defer func() { _ = tx.Rollback() }()

	courseID := deterministicID("course:" + course.SourceID)
	moduleID := deterministicID("module:" + course.SourceID)
	quizID := deterministicID("quiz:" + course.SourceID)

	_, err = tx.ExecContext(ctx, `INSERT INTO courses
		(id,title,slug,description,short_description,cover_image_url,course_category_id,level,age_range,status,
		 view_count,sort_order,created_at,updated_at,tenant_id,minimum_passing_grade,allow_skip,price,sell_individual,
		 discount_percent,owner_type)
		VALUES (?,?,?,?,?,'',?,?,?,?,0,?,NOW(3),NOW(3),?,?,?,0,0,0,'internal')`,
		courseID,
		course.Title,
		course.Slug,
		course.Description,
		course.ShortDescription,
		categoryID,
		course.Level,
		course.AgeRange,
		course.Status,
		course.SortOrder,
		tenantID,
		course.MinimumPassingGrade,
		boolInt(course.AllowSkip),
	)
	if err != nil {
		return nil, fmt.Errorf("course: %w", err)
	}

	if _, err = tx.ExecContext(ctx, "INSERT INTO course_mentors (course_id,mentor_id) VALUES (?,?)", courseID, adminID); err != nil {
		return nil, fmt.Errorf("course mentor: %w", err)
	}

	_, err = tx.ExecContext(ctx, `INSERT INTO modules
		(id,course_id,title,description,sort_order,is_published,created_at,updated_at,tenant_id)
		VALUES (?,?,?,?,?,0,NOW(3),NOW(3),?)`,
		moduleID,
		courseID,
		course.Module.Title,
		course.Module.Description,
		course.Module.SortOrder,
		tenantID,
	)
	if err != nil {
		return nil, fmt.Errorf("module: %w", err)
	}

	lessonIDs := make([]string, len(course.Module.Lessons))
	lessonArgs := make([]any, 0, len(course.Module.Lessons)*13)
	for index, lesson := range course.Module.Lessons {
		lessonID := deterministicID(fmt.Sprintf("lesson:%s:%d", course.SourceID, index+1))
		lessonIDs[index] = lessonID
		now := time.Now().UTC()
		lessonArgs = append(lessonArgs,
			lessonID,
			moduleID,
			lesson.Title,
			lesson.Summary,
			lesson.DurationSec,
			lesson.SortOrder,
			0,
			0,
			boolInt(lesson.RequireAttachment),
			lesson.AttachmentPassingScore,
			now,
			now,
			tenantID,
		)
	}
	lessonSQL := `INSERT INTO lessons
		(id,module_id,title,summary,duration_sec,sort_order,is_preview,is_published,require_attachment,
		 attachment_passing_score,created_at,updated_at,tenant_id) VALUES ` + placeholders(len(course.Module.Lessons), 13)
	if _, err = tx.ExecContext(ctx, lessonSQL, lessonArgs...); err != nil {
		return nil, fmt.Errorf("lessons: %w", err)
	}

	assetID := deterministicID("asset:" + course.SourceID)
	_, err = tx.ExecContext(ctx, `INSERT INTO learning_assets
		(id,lesson_id,type,title,description,file_url,thumbnail_url,duration_sec,file_size,is_downloadable,
		 sort_order,created_at,updated_at,tenant_id)
		VALUES (?,?,'video',?,?,?, ?,0,0,0,?,NOW(3),NOW(3),?)`,
		assetID,
		lessonIDs[0],
		course.Video.Title,
		"Video pembuka untuk "+course.SourceID,
		course.Video.URL,
		youtubeThumbnail(course.Video.URL),
		course.Video.SortOrder,
		tenantID,
	)
	if err != nil {
		return nil, fmt.Errorf("video asset: %w", err)
	}

	_, err = tx.ExecContext(ctx, `INSERT INTO quizzes
		(id,course_id,module_id,lesson_id,title,description,instructions,passing_score,time_limit_min,max_attempts,
		 randomize_questions,randomize_answers,show_result_after_submit,show_correct_answers,
		 require_passing_score_before_continue,is_published,sort_order,created_at,updated_at,tenant_id)
		VALUES (?,?,?,NULL,?,?,?,?,0,?,?,?,?,?,?,0,?,NOW(3),NOW(3),?)`,
		quizID,
		courseID,
		moduleID,
		course.Quiz.Title,
		course.Quiz.Description,
		course.Quiz.Instructions,
		course.Quiz.PassingScore,
		course.Quiz.MaxAttempts,
		boolInt(course.Quiz.RandomizeQuestions),
		boolInt(course.Quiz.RandomizeAnswers),
		boolInt(course.Quiz.ShowResultAfterSubmit),
		boolInt(course.Quiz.ShowCorrectAnswers),
		boolInt(course.Quiz.RequirePassingScoreBeforeContinue),
		course.Quiz.SortOrder,
		tenantID,
	)
	if err != nil {
		return nil, fmt.Errorf("quiz: %w", err)
	}

	questionArgs := make([]any, 0, len(course.Quiz.Questions)*11)
	optionArgs := make([]any, 0, len(course.Quiz.Questions)*4*8)
	optionCount := 0
	for questionIndex, question := range course.Quiz.Questions {
		questionID := deterministicID(fmt.Sprintf("question:%s:%d", course.SourceID, questionIndex+1))
		now := time.Now().UTC()
		questionArgs = append(questionArgs,
			questionID,
			quizID,
			question.Text,
			question.Type,
			question.Points,
			question.Explanation,
			question.SortOrder,
			boolInt(question.IsRequired),
			now,
			now,
			tenantID,
		)
		for optionIndex, option := range question.Options {
			optionID := deterministicID(fmt.Sprintf("option:%s:%d:%d", course.SourceID, questionIndex+1, optionIndex+1))
			optionArgs = append(optionArgs,
				optionID,
				questionID,
				option.Text,
				boolInt(option.IsCorrect),
				option.SortOrder,
				now,
				now,
				tenantID,
			)
			optionCount++
		}
	}
	questionSQL := `INSERT INTO quiz_questions
		(id,quiz_id,question_text,question_type,points,explanation,sort_order,is_required,created_at,updated_at,tenant_id) VALUES ` +
		placeholders(len(course.Quiz.Questions), 11)
	if _, err = tx.ExecContext(ctx, questionSQL, questionArgs...); err != nil {
		return nil, fmt.Errorf("quiz questions: %w", err)
	}
	optionSQL := `INSERT INTO quiz_options
		(id,question_id,option_text,is_correct,sort_order,created_at,updated_at,tenant_id) VALUES ` + placeholders(optionCount, 8)
	if _, err = tx.ExecContext(ctx, optionSQL, optionArgs...); err != nil {
		return nil, fmt.Errorf("quiz options: %w", err)
	}

	if err = tx.Commit(); err != nil {
		return nil, fmt.Errorf("commit: %w", err)
	}
	return map[string]int{
		"courses": 1, "course_mentors": 1, "modules": 1, "lessons": 4,
		"learning_assets": 1, "quizzes": 1, "quiz_questions": 5, "quiz_options": 20,
	}, nil
}

func verify(ctx context.Context, db *sql.DB, slugPattern string) (map[string]int, error) {
	queries := map[string]string{
		"courses":         "SELECT COUNT(*) FROM courses WHERE tenant_id=? AND deleted_at IS NULL AND slug LIKE ?",
		"course_mentors":  "SELECT COUNT(*) FROM course_mentors cm JOIN courses c ON c.id=cm.course_id WHERE c.tenant_id=? AND c.slug LIKE ? AND cm.mentor_id='" + adminID + "'",
		"modules":         "SELECT COUNT(*) FROM modules m JOIN courses c ON c.id=m.course_id WHERE c.tenant_id=? AND c.slug LIKE ?",
		"lessons":         "SELECT COUNT(*) FROM lessons l JOIN modules m ON m.id=l.module_id JOIN courses c ON c.id=m.course_id WHERE c.tenant_id=? AND c.slug LIKE ?",
		"learning_assets": "SELECT COUNT(*) FROM learning_assets a JOIN lessons l ON l.id=a.lesson_id JOIN modules m ON m.id=l.module_id JOIN courses c ON c.id=m.course_id WHERE c.tenant_id=? AND c.slug LIKE ?",
		"quizzes":         "SELECT COUNT(*) FROM quizzes q JOIN courses c ON c.id=q.course_id WHERE c.tenant_id=? AND c.slug LIKE ?",
		"quiz_questions":  "SELECT COUNT(*) FROM quiz_questions qq JOIN quizzes q ON q.id=qq.quiz_id JOIN courses c ON c.id=q.course_id WHERE c.tenant_id=? AND c.slug LIKE ?",
		"quiz_options":    "SELECT COUNT(*) FROM quiz_options qo JOIN quiz_questions qq ON qq.id=qo.question_id JOIN quizzes q ON q.id=qq.quiz_id JOIN courses c ON c.id=q.course_id WHERE c.tenant_id=? AND c.slug LIKE ?",
	}
	counts := make(map[string]int, len(queries))
	for name, query := range queries {
		var count int
		if err := db.QueryRowContext(ctx, query, tenantID, slugPattern).Scan(&count); err != nil {
			return nil, err
		}
		counts[name] = count
	}
	return counts, nil
}

func main() {
	inputPath := flag.String("input", "", "Parsed JSON payload")
	progressPath := flag.String("progress", "", "JSONL progress log")
	dsn := flag.String("dsn", "", "MySQL DSN")
	flag.Parse()
	if *inputPath == "" || *progressPath == "" || *dsn == "" {
		fmt.Fprintln(os.Stderr, "-input, -progress, and -dsn are required")
		os.Exit(2)
	}

	payload, err := readPayload(*inputPath)
	if err != nil {
		fmt.Fprintln(os.Stderr, "payload:", err)
		os.Exit(1)
	}
	progressFile, progressWriter, err := openProgress(*progressPath)
	if err != nil {
		fmt.Fprintln(os.Stderr, "progress log:", err)
		os.Exit(1)
	}
	defer progressFile.Close()
	defer progressWriter.Flush()

	db, err := sql.Open("mysql", *dsn)
	if err != nil {
		fmt.Fprintln(os.Stderr, "database:", err)
		os.Exit(1)
	}
	defer db.Close()
	db.SetMaxOpenConns(1)
	db.SetMaxIdleConns(1)

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Minute)
	defer cancel()
	if err := db.PingContext(ctx); err != nil {
		fmt.Fprintln(os.Stderr, "database ping:", err)
		os.Exit(1)
	}
	if err := preflight(ctx, db, payload); err != nil {
		writeEvent(progressWriter, ProgressEvent{Status: "preflight_error", Error: err.Error()})
		fmt.Fprintln(os.Stderr, "preflight:", err)
		os.Exit(1)
	}
	writeEvent(progressWriter, ProgressEvent{Status: "preflight_success", Total: len(payload.Courses)})

	categoryIDs, insertedCategories, err := ensureCategories(ctx, db, payload)
	if err != nil {
		writeEvent(progressWriter, ProgressEvent{Status: "category_error", Error: err.Error()})
		fmt.Fprintln(os.Stderr, "categories:", err)
		os.Exit(1)
	}
	writeEvent(progressWriter, ProgressEvent{Status: "categories_ready", Inserted: map[string]int{"course_categories": insertedCategories}})

	successCount := 0
	errorCount := 0
	for index, course := range payload.Courses {
		started := time.Now()
		inserted, insertErr := insertCourse(ctx, db, course, categoryIDs[course.SkillNumber])
		event := ProgressEvent{
			Index:      index + 1,
			Total:      len(payload.Courses),
			SourceID:   course.SourceID,
			Slug:       course.Slug,
			DurationMS: time.Since(started).Milliseconds(),
		}
		if insertErr != nil {
			errorCount++
			event.Status = "error"
			event.Error = insertErr.Error()
			writeEvent(progressWriter, event)
			fmt.Printf("[%03d/%03d] ERROR %s: %v\n", index+1, len(payload.Courses), course.SourceID, insertErr)
			continue
		}
		successCount++
		event.Status = "success"
		event.Inserted = inserted
		writeEvent(progressWriter, event)
		fmt.Printf("[%03d/%03d] OK %s (%d ms)\n", index+1, len(payload.Courses), course.SourceID, event.DurationMS)
	}

	verification, verifyErr := verify(ctx, db, payload.CourseSlugPattern)
	finalEvent := ProgressEvent{
		Status: "complete",
		Inserted: map[string]int{
			"successful_courses": successCount,
			"failed_courses":     errorCount,
		},
	}
	if verifyErr != nil {
		finalEvent.Status = "verification_error"
		finalEvent.Error = verifyErr.Error()
	} else {
		for key, value := range verification {
			finalEvent.Inserted["verified_"+key] = value
		}
	}
	writeEvent(progressWriter, finalEvent)
	result, _ := json.MarshalIndent(finalEvent, "", "  ")
	fmt.Println(string(result))
	if errorCount > 0 || verifyErr != nil {
		os.Exit(1)
	}
}
