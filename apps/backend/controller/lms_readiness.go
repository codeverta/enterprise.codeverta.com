package controller

import (
	"encoding/json"
	"errors"
	"fmt"
	"gin-template/common"
	"gin-template/model"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"gorm.io/datatypes"
	"gorm.io/gorm"
)

type readinessResponsePayload struct {
	SessionID       string                 `json:"session_id"`
	TestType        string                 `json:"test_type" binding:"required"`
	RespondentType  string                 `json:"respondent_type"`
	RespondentName  string                 `json:"respondent_name"`
	RespondentEmail string                 `json:"respondent_email"`
	Language        string                 `json:"language"`
	Score           int                    `json:"score"`
	ResultLabel     string                 `json:"result_label"`
	Profile         map[string]interface{} `json:"profile" binding:"required"`
	Answers         interface{}            `json:"answers" binding:"required"`
	Result          map[string]interface{} `json:"result" binding:"required"`
	Status          string                 `json:"status"`
	CurrentQuestion int                    `json:"current_question"`
}

func marshalReadinessJSON(value interface{}) (datatypes.JSON, error) {
	raw, err := json.Marshal(value)
	if err != nil {
		return nil, err
	}
	return datatypes.JSON(raw), nil
}

func (ctrl *LMSController) CreateReadinessResponse(c *gin.Context) {
	var payload readinessResponsePayload
	if err := c.ShouldBindJSON(&payload); err != nil {
		sendBadRequest(c, ErrInvalidParameters, nil)
		return
	}

	payload.TestType = strings.ToLower(strings.TrimSpace(payload.TestType))
	if payload.TestType != model.ReadinessTestParent && payload.TestType != model.ReadinessTestStudent {
		sendError(c, http.StatusUnprocessableEntity, "Tipe tes kesiapan tidak valid", map[string]string{
			"test_type": "Gunakan parent atau student",
		})
		return
	}
	if payload.Score < 0 || payload.Score > 100 {
		sendError(c, http.StatusUnprocessableEntity, "Skor harus berada di antara 0 dan 100", nil)
		return
	}
	status := strings.ToLower(strings.TrimSpace(payload.Status))
	if status == "" {
		status = "completed"
	}
	if status != "draft" && status != "completed" {
		sendError(c, http.StatusUnprocessableEntity, "Status tes kesiapan tidak valid", nil)
		return
	}
	if payload.CurrentQuestion < 0 {
		sendError(c, http.StatusUnprocessableEntity, "Progress pertanyaan tidak valid", nil)
		return
	}

	var sessionID *string
	if rawSessionID := strings.TrimSpace(payload.SessionID); rawSessionID != "" {
		parsedSessionID, parseErr := uuid.Parse(rawSessionID)
		if parseErr != nil {
			sendError(c, http.StatusUnprocessableEntity, "Session tes kesiapan tidak valid", nil)
			return
		}
		canonicalSessionID := parsedSessionID.String()
		sessionID = &canonicalSessionID
	}

	profile, err := marshalReadinessJSON(payload.Profile)
	if err != nil {
		sendBadRequest(c, ErrInvalidParameters, nil)
		return
	}
	answers, err := marshalReadinessJSON(payload.Answers)
	if err != nil {
		sendBadRequest(c, ErrInvalidParameters, nil)
		return
	}
	result, err := marshalReadinessJSON(payload.Result)
	if err != nil {
		sendBadRequest(c, ErrInvalidParameters, nil)
		return
	}

	language := strings.ToLower(strings.TrimSpace(payload.Language))
	if language != "en" {
		language = "id"
	}

	tenantValue, exists := c.Get(common.CtxTenantKey)
	tenant, validTenant := tenantValue.(model.Tenant)
	if !exists || !validTenant {
		sendInternalError(c, fmt.Errorf("tenant context is required"))
		return
	}
	tenantID := tenant.ID
	var completedAt *time.Time
	if status == "completed" {
		now := time.Now()
		completedAt = &now
	}

	response := model.ReadinessResponse{
		SessionID:       sessionID,
		TestType:        payload.TestType,
		RespondentType:  strings.ToLower(strings.TrimSpace(payload.RespondentType)),
		RespondentName:  strings.TrimSpace(payload.RespondentName),
		RespondentEmail: strings.ToLower(strings.TrimSpace(payload.RespondentEmail)),
		Language:        language,
		Score:           payload.Score,
		ResultLabel:     strings.TrimSpace(payload.ResultLabel),
		Profile:         profile,
		Answers:         answers,
		Result:          result,
		Status:          status,
		CurrentQuestion: payload.CurrentQuestion,
		CompletedAt:     completedAt,
		TenantID:        &tenantID,
	}
	db := lmsDB(c, ctrl.DB).WithContext(c.Request.Context())
	if sessionID != nil {
		var existing model.ReadinessResponse
		err = db.Where("session_id = ?", *sessionID).First(&existing).Error
		if err == nil {
			// A delayed autosave must never turn a finished response back into a draft.
			if existing.Status == "completed" && status == "draft" {
				sendSuccess(c, gin.H{
					"id":               existing.ID,
					"status":           existing.Status,
					"current_question": existing.CurrentQuestion,
					"updated_at":       existing.UpdatedAt,
				}, "Progress tes kesiapan sudah selesai")
				return
			}
			updates := map[string]interface{}{
				"respondent_type":  response.RespondentType,
				"respondent_name":  response.RespondentName,
				"respondent_email": response.RespondentEmail,
				"language":         response.Language,
				"score":            response.Score,
				"result_label":     response.ResultLabel,
				"profile":          response.Profile,
				"answers":          response.Answers,
				"result":           response.Result,
				"status":           response.Status,
				"current_question": response.CurrentQuestion,
				"completed_at":     response.CompletedAt,
			}
			if err = db.Model(&existing).Updates(updates).Error; err == nil {
				response.ID = existing.ID
				response.CreatedAt = existing.CreatedAt
				response.UpdatedAt = time.Now()
			}
		} else if errors.Is(err, gorm.ErrRecordNotFound) {
			err = db.Create(&response).Error
		}
	} else {
		err = db.Create(&response).Error
	}
	if err != nil {
		sendInternalError(c, err)
		return
	}

	sendSuccess(c, gin.H{
		"id":               response.ID,
		"status":           response.Status,
		"current_question": response.CurrentQuestion,
		"created_at":       response.CreatedAt,
		"updated_at":       response.UpdatedAt,
	}, "Progress tes kesiapan berhasil disimpan")
}

func (ctrl *LMSController) GetReadinessResponseProgress(c *gin.Context) {
	sessionID, err := uuid.Parse(strings.TrimSpace(c.Param("session_id")))
	if err != nil {
		sendBadRequest(c, ErrInvalidParameters, nil)
		return
	}

	var response model.ReadinessResponse
	if err := lmsDB(c, ctrl.DB).
		Where("session_id = ?", sessionID.String()).
		First(&response).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			sendError(c, http.StatusNotFound, "Progress tes kesiapan tidak ditemukan", nil)
			return
		}
		sendInternalError(c, err)
		return
	}

	sendSuccess(c, response, "Progress tes kesiapan berhasil dimuat")
}

func (ctrl *LMSController) ListReadinessResponses(c *gin.Context) {
	db := lmsDB(c, ctrl.DB).Model(&model.ReadinessResponse{})
	if testType := strings.TrimSpace(c.Query("test_type")); testType != "" {
		db = db.Where("test_type = ?", testType)
	}
	if respondentType := strings.TrimSpace(c.Query("respondent_type")); respondentType != "" {
		db = db.Where("respondent_type = ?", respondentType)
	}
	if search := strings.TrimSpace(c.Query("search")); search != "" {
		like := "%" + search + "%"
		db = db.Where("(respondent_name LIKE ? OR respondent_email LIKE ? OR result_label LIKE ?)", like, like, like)
	}

	var total int64
	if err := db.Count(&total).Error; err != nil {
		sendInternalError(c, err)
		return
	}
	limit := parseLimit(c)
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	if page < 1 {
		page = 1
	}
	var rows []model.ReadinessResponse
	if err := db.Order("created_at desc").
		Limit(limit).
		Offset((page - 1) * limit).
		Find(&rows).Error; err != nil {
		sendInternalError(c, err)
		return
	}

	totalPages := int((total + int64(limit) - 1) / int64(limit))
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "Readiness responses retrieved successfully",
		"data":    rows,
		"pagination": gin.H{
			"page":        page,
			"limit":       limit,
			"total":       total,
			"total_pages": totalPages,
		},
	})
}
