package controller

import (
	"net/http"
	"strings"
	"time"

	"gin-template/model"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

type scheduleTemplateRequest struct {
	Title       string `json:"title" binding:"required,min=1,max=180"`
	Description string `json:"description"`
}

type scheduleItemRequest struct {
	Title        string     `json:"title" binding:"required,min=1,max=180"`
	Description  string     `json:"description"`
	StartTime    time.Time  `json:"start_time" binding:"required"`
	EndTime      time.Time  `json:"end_time" binding:"required"`
	AllDay       bool       `json:"all_day"`
	Color        string     `json:"color"`
	ResourceType string     `json:"resource_type"`
	ResourceID   *uuid.UUID `json:"resource_id"`
}

type assignScheduleRequest struct {
	StudentIDs []uuid.UUID `json:"student_ids" binding:"required,min=1"`
}

type scheduleResourceOption struct {
	ID       uuid.UUID `json:"id"`
	Title    string    `json:"title"`
	Subtitle string    `json:"subtitle"`
}

func ScheduleSearchResourceOptions(c *gin.Context) {
	if !requireScheduleStaff(c) {
		return
	}

	resourceType, ok := normalizeScheduleResourceType(c.Query("resource_type"))
	if !ok || resourceType == "" {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "Resource type tidak valid"})
		return
	}

	q := strings.TrimSpace(c.Query("q"))
	like := "%" + q + "%"
	db := scopedCleanDB(c)
	limit := parseLimit(c)
	if limit <= 0 || limit > 100 {
		limit = 50
	}

	switch resourceType {
	case model.ScheduleResourceCourse:
		var rows []model.Course
		query := db.Order("title asc").Limit(limit)
		if q != "" {
			query = query.Where("title LIKE ? OR short_description LIKE ?", like, like)
		}
		if err := query.Find(&rows).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "Gagal memuat course"})
			return
		}
		out := make([]scheduleResourceOption, 0, len(rows))
		for _, row := range rows {
			out = append(out, scheduleResourceOption{ID: row.ID, Title: row.Title, Subtitle: string(row.Status)})
		}
		c.JSON(http.StatusOK, gin.H{"success": true, "data": out})
		return

	case model.ScheduleResourceModule:
		var rows []model.Module
		query := db.Preload("Course").Order("title asc").Limit(limit)
		if q != "" {
			query = query.Where("title LIKE ? OR description LIKE ?", like, like)
		}
		if err := query.Find(&rows).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "Gagal memuat module"})
			return
		}
		out := make([]scheduleResourceOption, 0, len(rows))
		for _, row := range rows {
			out = append(out, scheduleResourceOption{ID: row.ID, Title: row.Title, Subtitle: row.Course.Title})
		}
		c.JSON(http.StatusOK, gin.H{"success": true, "data": out})
		return

	case model.ScheduleResourceLesson:
		var rows []model.Lesson
		query := db.Preload("Module").Order("title asc").Limit(limit)
		if q != "" {
			query = query.Where("title LIKE ? OR summary LIKE ?", like, like)
		}
		if err := query.Find(&rows).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "Gagal memuat lesson"})
			return
		}
		out := make([]scheduleResourceOption, 0, len(rows))
		for _, row := range rows {
			out = append(out, scheduleResourceOption{ID: row.ID, Title: row.Title, Subtitle: row.Module.Title})
		}
		c.JSON(http.StatusOK, gin.H{"success": true, "data": out})
		return

	case model.ScheduleResourceQuiz:
		var rows []model.Quiz
		query := db.Preload("Course").Order("title asc").Limit(limit)
		if q != "" {
			query = query.Where("title LIKE ? OR description LIKE ?", like, like)
		}
		if err := query.Find(&rows).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "Gagal memuat quiz"})
			return
		}
		out := make([]scheduleResourceOption, 0, len(rows))
		for _, row := range rows {
			out = append(out, scheduleResourceOption{ID: row.ID, Title: row.Title, Subtitle: row.Course.Title})
		}
		c.JSON(http.StatusOK, gin.H{"success": true, "data": out})
		return
	}

	c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "Resource type tidak valid"})
}

func ScheduleListTemplates(c *gin.Context) {
	userID, ok := currentUserID(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"success": false, "message": "Unauthorized"})
		return
	}
	if !requireScheduleStaff(c) {
		return
	}

	var rows []model.ScheduleTemplate
	if err := scopedCleanDB(c).
		Preload("CreatedBy").
		Preload("Items", func(db *gorm.DB) *gorm.DB {
			return db.Order("start_time asc")
		}).
		Where("created_by_id = ?", userID).
		Order("created_at desc").
		Find(&rows).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "Gagal memuat template jadwal"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "data": rows})
}

func ScheduleGetTemplate(c *gin.Context) {
	if !requireScheduleStaff(c) {
		return
	}

	template, ok := findScheduleTemplate(c)
	if !ok {
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "data": template})
}

func ScheduleCreateTemplate(c *gin.Context) {
	userID, ok := currentUserID(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"success": false, "message": "Unauthorized"})
		return
	}
	if !requireScheduleStaff(c) {
		return
	}

	var req scheduleTemplateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": err.Error()})
		return
	}

	row := model.ScheduleTemplate{
		Title:       strings.TrimSpace(req.Title),
		Description: strings.TrimSpace(req.Description),
		CreatedByID: userID,
	}
	if err := scopedCleanDB(c).Create(&row).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "Gagal membuat template jadwal"})
		return
	}

	c.JSON(http.StatusCreated, gin.H{"success": true, "data": row})
}

func ScheduleUpdateTemplate(c *gin.Context) {
	if !requireScheduleStaff(c) {
		return
	}

	template, ok := findScheduleTemplate(c)
	if !ok {
		return
	}

	var req scheduleTemplateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": err.Error()})
		return
	}

	if err := scopedCleanDB(c).Model(&template).Updates(map[string]interface{}{
		"title":       strings.TrimSpace(req.Title),
		"description": strings.TrimSpace(req.Description),
	}).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "Gagal mengubah template jadwal"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "data": template})
}

func ScheduleDeleteTemplate(c *gin.Context) {
	if !requireScheduleStaff(c) {
		return
	}

	template, ok := findScheduleTemplate(c)
	if !ok {
		return
	}

	if err := scopedCleanDB(c).Delete(&template).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "Gagal menghapus template jadwal"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "message": "Template jadwal dihapus"})
}

func ScheduleCreateTemplateItem(c *gin.Context) {
	if !requireScheduleStaff(c) {
		return
	}

	template, ok := findScheduleTemplate(c)
	if !ok {
		return
	}

	item, valid := bindScheduleItem(c)
	if !valid {
		return
	}

	row := model.ScheduleTemplateItem{
		ScheduleTemplateID: template.ID,
		Title:              item.Title,
		Description:        item.Description,
		StartTime:          item.StartTime,
		EndTime:            item.EndTime,
		AllDay:             item.AllDay,
		Color:              item.Color,
		ResourceType:       item.ResourceType,
		ResourceID:         item.ResourceID,
	}
	if err := scopedCleanDB(c).Create(&row).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "Gagal menambah item jadwal"})
		return
	}
	c.JSON(http.StatusCreated, gin.H{"success": true, "data": row})
}

func ScheduleUpdateTemplateItem(c *gin.Context) {
	if !requireScheduleStaff(c) {
		return
	}

	itemID, err := uuid.Parse(c.Param("itemId"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "ID item tidak valid"})
		return
	}

	var existing model.ScheduleTemplateItem
	if err := scopedCleanDB(c).First(&existing, "id = ?", itemID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"success": false, "message": "Item template tidak ditemukan"})
		return
	}

	item, valid := bindScheduleItem(c)
	if !valid {
		return
	}

	if err := scopedCleanDB(c).Model(&existing).Updates(scheduleItemUpdateMap(item)).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "Gagal mengubah item jadwal"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "data": existing})
}

func ScheduleDeleteTemplateItem(c *gin.Context) {
	if !requireScheduleStaff(c) {
		return
	}

	itemID, err := uuid.Parse(c.Param("itemId"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "ID item tidak valid"})
		return
	}

	if err := scopedCleanDB(c).Delete(&model.ScheduleTemplateItem{}, "id = ?", itemID).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "Gagal menghapus item jadwal"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "message": "Item jadwal dihapus"})
}

func ScheduleAssignTemplate(c *gin.Context) {
	if !requireScheduleStaff(c) {
		return
	}

	template, ok := findScheduleTemplate(c)
	if !ok {
		return
	}

	var req assignScheduleRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": err.Error()})
		return
	}

	db := scopedCleanDB(c)
	var items []model.ScheduleTemplateItem
	if err := db.Where("schedule_template_id = ?", template.ID).Order("start_time asc").Find(&items).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "Gagal memuat item template"})
		return
	}

	err := db.Transaction(func(tx *gorm.DB) error {
		for _, studentID := range req.StudentIDs {
			var student model.User
			if err := tx.First(&student, "id = ?", studentID).Error; err != nil {
				return err
			}

			var schedule model.StudentSchedule
			err := tx.Where("student_id = ? AND schedule_template_id = ?", studentID, template.ID).
				First(&schedule).Error
			if err == gorm.ErrRecordNotFound {
				schedule = model.StudentSchedule{
					StudentID:          studentID,
					ScheduleTemplateID: &template.ID,
					Title:              template.Title,
				}
				if err := tx.Create(&schedule).Error; err != nil {
					return err
				}
			} else if err != nil {
				return err
			} else {
				if err := tx.Where("student_schedule_id = ? AND student_id = ?", schedule.ID, studentID).
					Delete(&model.StudentScheduleItem{}).Error; err != nil {
					return err
				}
				if err := tx.Model(&schedule).Update("title", template.Title).Error; err != nil {
					return err
				}
			}

			for _, tplItem := range items {
				copyItem := model.StudentScheduleItem{
					StudentScheduleID: schedule.ID,
					StudentID:         studentID,
					Title:             tplItem.Title,
					Description:       tplItem.Description,
					StartTime:         tplItem.StartTime,
					EndTime:           tplItem.EndTime,
					AllDay:            tplItem.AllDay,
					Color:             tplItem.Color,
					ResourceType:      tplItem.ResourceType,
					ResourceID:        tplItem.ResourceID,
				}
				if err := tx.Create(&copyItem).Error; err != nil {
					return err
				}
			}
		}
		return nil
	})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "Gagal assign template ke siswa"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "message": "Template jadwal berhasil di-assign"})
}

func ScheduleListStudents(c *gin.Context) {
	if !requireScheduleStaff(c) {
		return
	}

	userID, ok := currentUserID(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"success": false, "message": "Unauthorized"})
		return
	}

	role := currentUserRole(c)

	query := scopedCleanDB(c).
		Select("id, email, username, display_name, first_name, last_name, role").
		Where("role = ?", 20)

	if role == model.LMSRoleMentor || role == model.LMSRoleMentorEksternal {
		query = query.Where("id IN ("+
			"SELECT DISTINCT student_id FROM student_progresses WHERE course_id IN (SELECT course_id FROM course_mentors WHERE mentor_id = ?) UNION "+
			"SELECT DISTINCT student_id FROM course_purchases WHERE status = ? AND course_id IN (SELECT course_id FROM course_mentors WHERE mentor_id = ?) UNION "+
			"SELECT DISTINCT student_id FROM lms_payments WHERE status = ? AND course_id IN (SELECT course_id FROM course_mentors WHERE mentor_id = ?)"+
			")", userID, model.PurchasePaid, userID, model.LMSPaymentPaid, userID)
	}

	var users []model.User
	if err := query.
		Order("created_at desc").
		Limit(500).
		Find(&users).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "Gagal memuat siswa"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "data": users})
}

func ScheduleGetMySchedule(c *gin.Context) {
	userID, ok := currentUserID(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"success": false, "message": "Unauthorized"})
		return
	}

	var schedules []model.StudentSchedule
	if err := scopedCleanDB(c).
		Preload("Items", func(db *gorm.DB) *gorm.DB {
			return db.Order("start_time asc")
		}).
		Where("student_id = ?", userID).
		Order("created_at desc").
		Find(&schedules).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "Gagal memuat jadwal"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "data": schedules})
}

func ScheduleCreateMyItem(c *gin.Context) {
	userID, ok := currentUserID(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"success": false, "message": "Unauthorized"})
		return
	}

	item, valid := bindScheduleItem(c)
	if !valid {
		return
	}

	db := scopedCleanDB(c)
	schedule, err := ensureStudentSchedule(db, userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "Gagal menyiapkan jadwal siswa"})
		return
	}

	row := model.StudentScheduleItem{
		StudentScheduleID: schedule.ID,
		StudentID:         userID,
		Title:             item.Title,
		Description:       item.Description,
		StartTime:         item.StartTime,
		EndTime:           item.EndTime,
		AllDay:            item.AllDay,
		Color:             item.Color,
		ResourceType:      item.ResourceType,
		ResourceID:        item.ResourceID,
	}
	if err := db.Create(&row).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "Gagal menambah jadwal"})
		return
	}
	c.JSON(http.StatusCreated, gin.H{"success": true, "data": row})
}

func ScheduleUpdateMyItem(c *gin.Context) {
	userID, ok := currentUserID(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"success": false, "message": "Unauthorized"})
		return
	}

	itemID, err := uuid.Parse(c.Param("itemId"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "ID item tidak valid"})
		return
	}

	var existing model.StudentScheduleItem
	if err := scopedCleanDB(c).First(&existing, "id = ? AND student_id = ?", itemID, userID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"success": false, "message": "Item jadwal tidak ditemukan"})
		return
	}

	item, valid := bindScheduleItem(c)
	if !valid {
		return
	}

	if err := scopedCleanDB(c).Model(&existing).Updates(scheduleItemUpdateMap(item)).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "Gagal mengubah jadwal"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "data": existing})
}

func ScheduleDeleteMyItem(c *gin.Context) {
	userID, ok := currentUserID(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"success": false, "message": "Unauthorized"})
		return
	}

	itemID, err := uuid.Parse(c.Param("itemId"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "ID item tidak valid"})
		return
	}

	if err := scopedCleanDB(c).Delete(&model.StudentScheduleItem{}, "id = ? AND student_id = ?", itemID, userID).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "Gagal menghapus jadwal"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "message": "Jadwal dihapus"})
}

type normalizedScheduleItem struct {
	Title        string
	Description  string
	StartTime    time.Time
	EndTime      time.Time
	AllDay       bool
	Color        string
	ResourceType model.ScheduleResourceType
	ResourceID   *uuid.UUID
}

func bindScheduleItem(c *gin.Context) (normalizedScheduleItem, bool) {
	var req scheduleItemRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": err.Error()})
		return normalizedScheduleItem{}, false
	}
	if !req.EndTime.After(req.StartTime) {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "End time harus setelah start time"})
		return normalizedScheduleItem{}, false
	}

	resourceType, ok := normalizeScheduleResourceType(req.ResourceType)
	if !ok {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "Resource type tidak valid"})
		return normalizedScheduleItem{}, false
	}
	if resourceType != "" && req.ResourceID == nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "Resource ID wajib diisi"})
		return normalizedScheduleItem{}, false
	}
	if resourceType == "" {
		req.ResourceID = nil
	}
	if resourceType != "" && !scheduleResourceExists(scopedCleanDB(c), resourceType, *req.ResourceID) {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "Resource tidak ditemukan"})
		return normalizedScheduleItem{}, false
	}

	color := strings.TrimSpace(req.Color)
	if color == "" {
		color = "#2563eb"
	}

	return normalizedScheduleItem{
		Title:        strings.TrimSpace(req.Title),
		Description:  strings.TrimSpace(req.Description),
		StartTime:    req.StartTime,
		EndTime:      req.EndTime,
		AllDay:       req.AllDay,
		Color:        color,
		ResourceType: resourceType,
		ResourceID:   req.ResourceID,
	}, true
}

func normalizeScheduleResourceType(value string) (model.ScheduleResourceType, bool) {
	switch model.ScheduleResourceType(strings.ToLower(strings.TrimSpace(value))) {
	case "":
		return "", true
	case model.ScheduleResourceCourse:
		return model.ScheduleResourceCourse, true
	case model.ScheduleResourceModule:
		return model.ScheduleResourceModule, true
	case model.ScheduleResourceLesson:
		return model.ScheduleResourceLesson, true
	case model.ScheduleResourceQuiz:
		return model.ScheduleResourceQuiz, true
	default:
		return "", false
	}
}

func scheduleResourceExists(db *gorm.DB, resourceType model.ScheduleResourceType, resourceID uuid.UUID) bool {
	var count int64
	switch resourceType {
	case model.ScheduleResourceCourse:
		db.Model(&model.Course{}).Where("id = ?", resourceID).Count(&count)
	case model.ScheduleResourceModule:
		db.Model(&model.Module{}).Where("id = ?", resourceID).Count(&count)
	case model.ScheduleResourceLesson:
		db.Model(&model.Lesson{}).Where("id = ?", resourceID).Count(&count)
	case model.ScheduleResourceQuiz:
		db.Model(&model.Quiz{}).Where("id = ?", resourceID).Count(&count)
	}
	return count > 0
}

func scheduleItemUpdateMap(item normalizedScheduleItem) map[string]interface{} {
	return map[string]interface{}{
		"title":         item.Title,
		"description":   item.Description,
		"start_time":    item.StartTime,
		"end_time":      item.EndTime,
		"all_day":       item.AllDay,
		"color":         item.Color,
		"resource_type": item.ResourceType,
		"resource_id":   item.ResourceID,
	}
}

func requireScheduleStaff(c *gin.Context) bool {
	role := currentUserRole(c)
	if role == model.LMSRoleAdmin || role == model.LMSRoleMentor || role == model.LMSRoleMentorEksternal {
		return true
	}
	c.JSON(http.StatusForbidden, gin.H{"success": false, "message": "Hanya admin atau mentor yang dapat mengelola template jadwal"})
	return false
}

func findScheduleTemplate(c *gin.Context) (model.ScheduleTemplate, bool) {
	userID, ok := currentUserID(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"success": false, "message": "Unauthorized"})
		return model.ScheduleTemplate{}, false
	}
	templateID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "ID template tidak valid"})
		return model.ScheduleTemplate{}, false
	}

	var template model.ScheduleTemplate
	if err := scopedCleanDB(c).
		Preload("Items", func(db *gorm.DB) *gorm.DB {
			return db.Order("start_time asc")
		}).
		Where("created_by_id = ?", userID).
		First(&template, "id = ?", templateID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"success": false, "message": "Template jadwal tidak ditemukan"})
		return model.ScheduleTemplate{}, false
	}
	return template, true
}

func ensureStudentSchedule(db *gorm.DB, studentID uuid.UUID) (model.StudentSchedule, error) {
	var schedule model.StudentSchedule
	err := db.Where("student_id = ? AND schedule_template_id IS NULL", studentID).
		Order("created_at asc").
		First(&schedule).Error
	if err == nil {
		return schedule, nil
	}
	if err != gorm.ErrRecordNotFound {
		return schedule, err
	}
	schedule = model.StudentSchedule{
		StudentID: studentID,
		Title:     "Jadwal Pribadi",
	}
	return schedule, db.Create(&schedule).Error
}
