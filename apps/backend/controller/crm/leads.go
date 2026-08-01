package crm

import (
	"encoding/csv"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strings"

	"gin-template/model"
	crmmodel "gin-template/model/crm"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"gorm.io/datatypes"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

var defaultScoreRules = map[string]int{
	"email": 20, "phone": 15, "company": 10, "product": 10,
	"tracking": 10, "source:referral": 25, "source:event": 20,
	"source:meta_ads": 15, "source:tiktok_ads": 15, "source:google_ads": 15,
	"source:organic": 10, "source:website": 10, "source:cold_call": 5,
}

func prepareLead(db *gorm.DB, lead *crmmodel.Lead) error {
	var configuredRules map[string]int
	var config crmmodel.LeadAutomationConfig
	if err := db.First(&config).Error; err == nil {
		_ = json.Unmarshal(config.ScoringRules, &configuredRules)
	} else if !errors.Is(err, gorm.ErrRecordNotFound) {
		return err
	}
	lead.Score = calculateLeadScore(lead, configuredRules)
	if lead.Status == "" {
		lead.Status = "new"
	}
	if lead.AssignedTo != nil {
		return nil
	}
	return assignLead(db, lead)
}

func calculateLeadScore(lead *crmmodel.Lead, configured map[string]int) int {
	rules := make(map[string]int, len(defaultScoreRules)+len(configured))
	for key, value := range defaultScoreRules {
		rules[key] = value
	}
	for key, value := range configured {
		rules[key] = value
	}
	score := 0
	if lead.Email != "" {
		score += rules["email"]
	}
	if lead.Phone != "" {
		score += rules["phone"]
	}
	if lead.CompanyName != "" {
		score += rules["company"]
	}
	if lead.ProductInterest != "" {
		score += rules["product"]
	}
	if lead.UTMSource != "" || lead.GCLID != "" || lead.FBCLID != "" || lead.TTCLID != "" {
		score += rules["tracking"]
	}
	score += rules["source:"+strings.ToLower(strings.TrimSpace(lead.Source))]
	if score > 100 {
		return 100
	}
	if score < 0 {
		return 0
	}
	return score
}

func assignLead(db *gorm.DB, lead *crmmodel.Lead) error {
	return db.Transaction(func(tx *gorm.DB) error {
		var config crmmodel.LeadAutomationConfig
		err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).First(&config).Error
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil
		}
		if err != nil {
			return err
		}
		var reps []uuid.UUID
		_ = json.Unmarshal(config.SalesRepIDs, &reps)
		if len(reps) == 0 || config.AssignmentMethod == "manual" {
			return nil
		}
		var mapped map[string]uuid.UUID
		switch config.AssignmentMethod {
		case "territory":
			_ = json.Unmarshal(config.TerritoryRules, &mapped)
			if rep := mapped[strings.ToLower(strings.TrimSpace(lead.Region))]; rep != uuid.Nil {
				lead.AssignedTo = &rep
				return nil
			}
		case "product":
			_ = json.Unmarshal(config.ProductRules, &mapped)
			if rep := mapped[strings.ToLower(strings.TrimSpace(lead.ProductInterest))]; rep != uuid.Nil {
				lead.AssignedTo = &rep
				return nil
			}
		}
		next := (config.LastAssigned + 1) % len(reps)
		lead.AssignedTo = &reps[next]
		return tx.Model(&config).Update("last_assigned", next).Error
	})
}

func (h *Controller) Dashboard(c *gin.Context) {
	db := model.GetDB(c).WithContext(c.Request.Context())
	type statusCount struct {
		Status string `json:"status"`
		Count  int64  `json:"count"`
	}
	statuses := make([]statusCount, 0)
	if err := db.Model(&crmmodel.Lead{}).Select("status, COUNT(*) AS count").Group("status").Scan(&statuses).Error; err != nil {
		writeDBError(c, err)
		return
	}
	var total, unassigned, highScore int64
	if err := db.Model(&crmmodel.Lead{}).Count(&total).Error; err != nil {
		writeDBError(c, err)
		return
	}
	_ = db.Model(&crmmodel.Lead{}).Where("assigned_to IS NULL").Count(&unassigned).Error
	_ = db.Model(&crmmodel.Lead{}).Where("score >= ?", 70).Count(&highScore).Error
	c.JSON(http.StatusOK, gin.H{"total": total, "unassigned": unassigned, "high_score": highScore, "by_status": statuses})
}

func (h *Controller) CaptureLead(c *gin.Context) {
	db := model.GetDB(c).WithContext(c.Request.Context())
	var automation crmmodel.LeadAutomationConfig
	if err := db.First(&automation).Error; err == nil && !automation.CaptureEnabled {
		c.JSON(http.StatusForbidden, gin.H{"error": "public CRM lead capture is disabled"})
		return
	} else if err != nil && !errors.Is(err, gorm.ErrRecordNotFound) {
		writeDBError(c, err)
		return
	}
	var lead crmmodel.Lead
	if err := c.ShouldBindJSON(&lead); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	lead.ResetForCreate()
	if lead.Source == "" {
		lead.Source = "website"
	}
	if err := prepareLead(db, &lead); err != nil {
		writeDBError(c, err)
		return
	}
	if err := db.Create(&lead).Error; err != nil {
		writeDBError(c, err)
		return
	}
	dispatchLeadCreated(db, &lead)
	c.JSON(http.StatusCreated, gin.H{"id": lead.ID, "status": lead.Status, "message": "Lead captured"})
}

func (h *Controller) ImportLeads(c *gin.Context) {
	file, err := c.FormFile("file")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "CSV file is required"})
		return
	}
	opened, err := file.Open()
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "cannot open CSV file"})
		return
	}
	defer opened.Close()
	reader := csv.NewReader(io.LimitReader(opened, 10*1024*1024))
	reader.TrimLeadingSpace = true
	headers, err := reader.Read()
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "CSV header is invalid"})
		return
	}
	indexes := make(map[string]int, len(headers))
	for index, header := range headers {
		indexes[strings.ToLower(strings.TrimSpace(header))] = index
	}
	if _, ok := indexes["name"]; !ok {
		c.JSON(http.StatusBadRequest, gin.H{"error": "CSV must contain a name column"})
		return
	}
	db := model.GetDB(c).WithContext(c.Request.Context())
	created, failed := 0, 0
	errorsList := make([]string, 0)
	for rowNumber := 2; ; rowNumber++ {
		row, readErr := reader.Read()
		if readErr == io.EOF {
			break
		}
		if readErr != nil {
			failed++
			errorsList = append(errorsList, fmt.Sprintf("row %d: %v", rowNumber, readErr))
			continue
		}
		value := func(name string) string {
			index, exists := indexes[name]
			if !exists || index >= len(row) {
				return ""
			}
			return strings.TrimSpace(row[index])
		}
		lead := crmmodel.Lead{
			Name: value("name"), Email: value("email"), Phone: value("phone"),
			CompanyName: value("company_name"), Source: value("source"), SourceDetail: value("source_detail"),
			Region: value("region"), ProductInterest: value("product_interest"),
			UTMSource: value("utm_source"), UTMMedium: value("utm_medium"), UTMCampaign: value("utm_campaign"),
			GCLID: value("gclid"), FBCLID: value("fbclid"), TTCLID: value("ttclid"), Notes: value("notes"),
		}
		if lead.Name == "" {
			failed++
			errorsList = append(errorsList, fmt.Sprintf("row %d: name is required", rowNumber))
			continue
		}
		if lead.Source == "" {
			lead.Source = "csv_import"
		}
		if err := prepareLead(db, &lead); err != nil {
			failed++
			errorsList = append(errorsList, fmt.Sprintf("row %d: %v", rowNumber, err))
			continue
		}
		if err := db.Create(&lead).Error; err != nil {
			failed++
			errorsList = append(errorsList, fmt.Sprintf("row %d: %v", rowNumber, err))
			continue
		}
		created++
	}
	if len(errorsList) > 20 {
		errorsList = errorsList[:20]
	}
	c.JSON(http.StatusOK, gin.H{"created": created, "failed": failed, "errors": errorsList})
}

func (h *Controller) GetAutomation(c *gin.Context) {
	db := model.GetDB(c).WithContext(c.Request.Context())
	var config crmmodel.LeadAutomationConfig
	err := db.First(&config).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		config = crmmodel.LeadAutomationConfig{
			AssignmentMethod: "round_robin", CaptureEnabled: true,
			SalesRepIDs: datatypes.JSON([]byte("[]")), TerritoryRules: datatypes.JSON([]byte("{}")),
			ProductRules: datatypes.JSON([]byte("{}")), ScoringRules: datatypes.JSON([]byte("{}")),
		}
		c.JSON(http.StatusOK, config)
		return
	}
	if err != nil {
		writeDBError(c, err)
		return
	}
	c.JSON(http.StatusOK, config)
}

func (h *Controller) UpdateAutomation(c *gin.Context) {
	var input struct {
		AssignmentMethod string               `json:"assignment_method" binding:"required,oneof=round_robin territory product manual"`
		SalesRepIDs      []uuid.UUID          `json:"sales_rep_ids"`
		TerritoryRules   map[string]uuid.UUID `json:"territory_rules"`
		ProductRules     map[string]uuid.UUID `json:"product_rules"`
		ScoringRules     map[string]int       `json:"scoring_rules"`
		CaptureEnabled   bool                 `json:"capture_enabled"`
	}
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	db := model.GetDB(c).WithContext(c.Request.Context())
	var config crmmodel.LeadAutomationConfig
	err := db.First(&config).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		config.AssignmentMethod = input.AssignmentMethod
		config.CaptureEnabled = input.CaptureEnabled
		config.SalesRepIDs, _ = json.Marshal(input.SalesRepIDs)
		config.TerritoryRules, _ = json.Marshal(normalizeRuleKeys(input.TerritoryRules))
		config.ProductRules, _ = json.Marshal(normalizeRuleKeys(input.ProductRules))
		config.ScoringRules, _ = json.Marshal(input.ScoringRules)
		if err := db.Create(&config).Error; err != nil {
			writeDBError(c, err)
			return
		}
	} else if err != nil {
		writeDBError(c, err)
		return
	} else {
		updates := map[string]interface{}{"assignment_method": input.AssignmentMethod, "capture_enabled": input.CaptureEnabled}
		updates["sales_rep_ids"], _ = json.Marshal(input.SalesRepIDs)
		updates["territory_rules"], _ = json.Marshal(normalizeRuleKeys(input.TerritoryRules))
		updates["product_rules"], _ = json.Marshal(normalizeRuleKeys(input.ProductRules))
		updates["scoring_rules"], _ = json.Marshal(input.ScoringRules)
		if err := db.Model(&config).Updates(updates).Error; err != nil {
			writeDBError(c, err)
			return
		}
	}
	c.JSON(http.StatusOK, config)
}

func normalizeRuleKeys(input map[string]uuid.UUID) map[string]uuid.UUID {
	result := make(map[string]uuid.UUID, len(input))
	for key, value := range input {
		result[strings.ToLower(strings.TrimSpace(key))] = value
	}
	return result
}
