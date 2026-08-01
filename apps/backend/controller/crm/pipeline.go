package crm

import (
	"fmt"
	"net/http"
	"sort"
	"strings"
	"time"

	coremodel "gin-template/model"
	crmmodel "gin-template/model/crm"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

var defaultPipelineStages = []crmmodel.PipelineStage{
	{Name: "Prospecting", StageType: "open", SortOrder: 10, DefaultProbability: 10},
	{Name: "Qualification", StageType: "open", SortOrder: 20, DefaultProbability: 25},
	{Name: "Proposal", StageType: "open", SortOrder: 30, DefaultProbability: 50},
	{Name: "Negotiation", StageType: "open", SortOrder: 40, DefaultProbability: 75},
	{Name: "Closed Won", StageType: "won", SortOrder: 50, DefaultProbability: 100},
	{Name: "Closed Lost", StageType: "lost", SortOrder: 60, DefaultProbability: 0},
}

type stagePayload struct {
	Name               string  `json:"name" binding:"required,max=50"`
	StageType          string  `json:"stage_type" binding:"required,oneof=open won lost"`
	SortOrder          int     `json:"sort_order" binding:"min=0"`
	DefaultProbability float64 `json:"default_probability" binding:"min=0,max=100"`
}

type opportunityPayload struct {
	Name              string     `json:"name" binding:"required,max=150"`
	AccountID         *uuid.UUID `json:"account_id"`
	ContactID         *uuid.UUID `json:"contact_id"`
	StageID           *uuid.UUID `json:"stage_id"`
	Amount            float64    `json:"amount" binding:"min=0"`
	Probability       *float64   `json:"probability" binding:"omitempty,min=0,max=100"`
	ExpectedCloseDate *time.Time `json:"expected_close_date"`
	OwnerID           *uuid.UUID `json:"owner_id"`
	Source            string     `json:"source" binding:"max=50"`
	LostReason        string     `json:"lost_reason" binding:"max=255"`
}

type moveOpportunityPayload struct {
	StageID    uuid.UUID `json:"stage_id" binding:"required"`
	LostReason string    `json:"lost_reason" binding:"max=255"`
}

type opportunityView struct {
	crmmodel.Opportunity
	StageName   string  `json:"stage_name"`
	AccountName string  `json:"account_name"`
	ContactName string  `json:"contact_name"`
	OwnerName   string  `json:"owner_name"`
	Weighted    float64 `json:"weighted_amount"`
}

type salesRepOption struct {
	ID   uuid.UUID `json:"id"`
	Name string    `json:"name"`
}

func (h *Controller) GetPipeline(c *gin.Context) {
	db := coremodel.GetDB(c).WithContext(c.Request.Context())
	stages, err := ensurePipelineStages(db)
	if err != nil {
		writeDBError(c, err)
		return
	}
	query := db.Model(&crmmodel.Opportunity{})
	if owner := strings.TrimSpace(c.Query("owner_id")); owner != "" {
		query = query.Where("owner_id = ?", owner)
	}
	if search := strings.TrimSpace(c.Query("q")); search != "" {
		query = query.Where("name LIKE ?", "%"+search+"%")
	}
	opportunities := make([]crmmodel.Opportunity, 0)
	if err := query.Order("expected_close_date ASC, created_at DESC").Find(&opportunities).Error; err != nil {
		writeDBError(c, err)
		return
	}
	views, err := enrichOpportunities(db, opportunities, stages)
	if err != nil {
		writeDBError(c, err)
		return
	}
	accounts := make([]crmmodel.Account, 0)
	contacts := make([]crmmodel.Contact, 0)
	if err := db.Order("name ASC").Find(&accounts).Error; err != nil {
		writeDBError(c, err)
		return
	}
	if err := db.Order("first_name ASC, last_name ASC").Find(&contacts).Error; err != nil {
		writeDBError(c, err)
		return
	}
	reps, err := pipelineSalesReps(db)
	if err != nil {
		writeDBError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"stages": stages, "opportunities": views, "accounts": accounts, "contacts": contacts, "sales_reps": reps})
}

func (h *Controller) CreatePipelineStage(c *gin.Context) {
	var payload stagePayload
	if err := c.ShouldBindJSON(&payload); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	stage := crmmodel.PipelineStage{Name: strings.TrimSpace(payload.Name), StageType: payload.StageType, SortOrder: payload.SortOrder, DefaultProbability: payload.DefaultProbability}
	if err := coremodel.GetDB(c).WithContext(c.Request.Context()).Create(&stage).Error; err != nil {
		writeDBError(c, err)
		return
	}
	c.JSON(http.StatusCreated, stage)
}

func (h *Controller) UpdatePipelineStage(c *gin.Context) {
	id, ok := parseID(c)
	if !ok {
		return
	}
	var payload stagePayload
	if err := c.ShouldBindJSON(&payload); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	db := coremodel.GetDB(c).WithContext(c.Request.Context())
	var stage crmmodel.PipelineStage
	if err := db.First(&stage, "id = ?", id).Error; err != nil {
		writeLookupError(c, err)
		return
	}
	err := db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Model(&stage).Updates(map[string]interface{}{"name": strings.TrimSpace(payload.Name), "stage_type": payload.StageType, "sort_order": payload.SortOrder, "default_probability": payload.DefaultProbability}).Error; err != nil {
			return err
		}
		status := statusForStageType(payload.StageType)
		updates := map[string]interface{}{"status": status}
		if status != "lost" {
			updates["lost_reason"] = ""
		}
		return tx.Model(&crmmodel.Opportunity{}).Where("stage_id = ?", id).Updates(updates).Error
	})
	if err != nil {
		writeDBError(c, err)
		return
	}
	if err := db.First(&stage, "id = ?", id).Error; err != nil {
		writeDBError(c, err)
		return
	}
	c.JSON(http.StatusOK, stage)
}

func (h *Controller) DeletePipelineStage(c *gin.Context) {
	id, ok := parseID(c)
	if !ok {
		return
	}
	db := coremodel.GetDB(c).WithContext(c.Request.Context())
	var count int64
	if err := db.Model(&crmmodel.Opportunity{}).Where("stage_id = ?", id).Count(&count).Error; err != nil {
		writeDBError(c, err)
		return
	}
	if count > 0 {
		c.JSON(http.StatusConflict, gin.H{"error": "Pindahkan deal dari stage ini sebelum menghapusnya"})
		return
	}
	result := db.Delete(&crmmodel.PipelineStage{}, "id = ?", id)
	if result.Error != nil {
		writeDBError(c, result.Error)
		return
	}
	if result.RowsAffected == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "Pipeline stage not found"})
		return
	}
	c.Status(http.StatusNoContent)
}

func (h *Controller) CreateOpportunity(c *gin.Context) { h.saveOpportunity(c, uuid.Nil) }
func (h *Controller) UpdateOpportunity(c *gin.Context) {
	id, ok := parseID(c)
	if ok {
		h.saveOpportunity(c, id)
	}
}

func (h *Controller) saveOpportunity(c *gin.Context, id uuid.UUID) {
	var payload opportunityPayload
	if err := c.ShouldBindJSON(&payload); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	db := coremodel.GetDB(c).WithContext(c.Request.Context())
	stages, err := ensurePipelineStages(db)
	if err != nil {
		writeDBError(c, err)
		return
	}
	stageID := payload.StageID
	if stageID == nil && len(stages) > 0 {
		stageID = &stages[0].ID
	}
	stage, err := findPipelineStage(stages, stageID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if err := validateOpportunityRelations(db, payload.AccountID, payload.ContactID, payload.OwnerID); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	probability := stage.DefaultProbability
	if payload.Probability != nil {
		probability = *payload.Probability
	}
	status := statusForStageType(stage.StageType)
	lostReason := strings.TrimSpace(payload.LostReason)
	if status == "lost" && lostReason == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Alasan kalah wajib diisi untuk Closed Lost"})
		return
	}
	if status != "lost" {
		lostReason = ""
	}
	now := time.Now()
	var closedAt *time.Time
	if status != "open" {
		closedAt = &now
	}
	values := map[string]interface{}{"name": strings.TrimSpace(payload.Name), "account_id": payload.AccountID, "contact_id": payload.ContactID, "stage_id": stage.ID, "amount": payload.Amount, "probability": probability, "expected_close_date": payload.ExpectedCloseDate, "owner_id": payload.OwnerID, "source": strings.TrimSpace(payload.Source), "status": status, "lost_reason": lostReason, "closed_at": closedAt}
	var opportunity crmmodel.Opportunity
	responseStatus := http.StatusCreated
	if id == uuid.Nil {
		opportunity = crmmodel.Opportunity{Name: strings.TrimSpace(payload.Name), AccountID: payload.AccountID, ContactID: payload.ContactID, StageID: &stage.ID, Amount: payload.Amount, Probability: probability, ExpectedCloseDate: payload.ExpectedCloseDate, OwnerID: payload.OwnerID, Source: strings.TrimSpace(payload.Source), Status: status, LostReason: lostReason, ClosedAt: closedAt}
		if opportunity.OwnerID == nil {
			opportunity.OwnerID = actorPointer(c)
		}
		if err := db.Create(&opportunity).Error; err != nil {
			writeDBError(c, err)
			return
		}
	} else {
		if err := db.First(&opportunity, "id = ?", id).Error; err != nil {
			writeLookupError(c, err)
			return
		}
		if err := db.Model(&opportunity).Updates(values).Error; err != nil {
			writeDBError(c, err)
			return
		}
		responseStatus = http.StatusOK
		if err := db.First(&opportunity, "id = ?", id).Error; err != nil {
			writeDBError(c, err)
			return
		}
	}
	views, _ := enrichOpportunities(db, []crmmodel.Opportunity{opportunity}, stages)
	c.JSON(responseStatus, views[0])
}

func (h *Controller) MoveOpportunity(c *gin.Context) {
	id, ok := parseID(c)
	if !ok {
		return
	}
	var payload moveOpportunityPayload
	if err := c.ShouldBindJSON(&payload); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	db := coremodel.GetDB(c).WithContext(c.Request.Context())
	var opportunity crmmodel.Opportunity
	if err := db.First(&opportunity, "id = ?", id).Error; err != nil {
		writeLookupError(c, err)
		return
	}
	var stage crmmodel.PipelineStage
	if err := db.First(&stage, "id = ?", payload.StageID).Error; err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Stage tujuan tidak ditemukan"})
		return
	}
	status := statusForStageType(stage.StageType)
	reason := strings.TrimSpace(payload.LostReason)
	if status == "lost" && reason == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Alasan kalah wajib diisi"})
		return
	}
	updates := map[string]interface{}{"stage_id": stage.ID, "status": status, "probability": stage.DefaultProbability, "lost_reason": "", "closed_at": nil}
	if status == "lost" {
		updates["lost_reason"] = reason
	}
	if status != "open" {
		now := time.Now()
		updates["closed_at"] = &now
	}
	if err := db.Model(&opportunity).Updates(updates).Error; err != nil {
		writeDBError(c, err)
		return
	}
	if err := db.First(&opportunity, "id = ?", id).Error; err != nil {
		writeDBError(c, err)
		return
	}
	views, _ := enrichOpportunities(db, []crmmodel.Opportunity{opportunity}, []crmmodel.PipelineStage{stage})
	c.JSON(http.StatusOK, views[0])
}

func (h *Controller) DeleteOpportunity(c *gin.Context) {
	id, ok := parseID(c)
	if !ok {
		return
	}
	result := coremodel.GetDB(c).WithContext(c.Request.Context()).Delete(&crmmodel.Opportunity{}, "id = ?", id)
	if result.Error != nil {
		writeDBError(c, result.Error)
		return
	}
	if result.RowsAffected == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "Deal not found"})
		return
	}
	c.Status(http.StatusNoContent)
}

type forecastBucket struct {
	Period   string  `json:"period"`
	Pipeline float64 `json:"pipeline"`
	Weighted float64 `json:"weighted"`
	Won      float64 `json:"won"`
	Deals    int     `json:"deals"`
}
type forecastRep struct {
	OwnerID   string  `json:"owner_id"`
	OwnerName string  `json:"owner_name"`
	Pipeline  float64 `json:"pipeline"`
	Weighted  float64 `json:"weighted"`
	Won       float64 `json:"won"`
	Deals     int     `json:"deals"`
}
type lostReasonSummary struct {
	Reason string  `json:"reason"`
	Deals  int     `json:"deals"`
	Amount float64 `json:"amount"`
}

func (h *Controller) SalesForecast(c *gin.Context) {
	db := coremodel.GetDB(c).WithContext(c.Request.Context())
	from, to, err := forecastRange(c)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	rows := make([]crmmodel.Opportunity, 0)
	query := db.Where("expected_close_date >= ? AND expected_close_date <= ? AND status <> ?", from, to, "lost")
	if owner := strings.TrimSpace(c.Query("owner_id")); owner != "" {
		query = query.Where("owner_id = ?", owner)
	}
	if err := query.Find(&rows).Error; err != nil {
		writeDBError(c, err)
		return
	}
	lostRows := make([]crmmodel.Opportunity, 0)
	lostQuery := db.Where("expected_close_date >= ? AND expected_close_date <= ? AND status = ?", from, to, "lost")
	if owner := strings.TrimSpace(c.Query("owner_id")); owner != "" {
		lostQuery = lostQuery.Where("owner_id = ?", owner)
	}
	if err := lostQuery.Find(&lostRows).Error; err != nil {
		writeDBError(c, err)
		return
	}
	reps, _ := pipelineSalesReps(db)
	names := make(map[uuid.UUID]string)
	for _, rep := range reps {
		names[rep.ID] = rep.Name
	}
	buckets := make(map[string]*forecastBucket)
	repBuckets := make(map[string]*forecastRep)
	for _, deal := range rows {
		if deal.ExpectedCloseDate == nil {
			continue
		}
		period := deal.ExpectedCloseDate.Format("2006-01")
		bucket := buckets[period]
		if bucket == nil {
			bucket = &forecastBucket{Period: period}
			buckets[period] = bucket
		}
		ownerKey, ownerName := "unassigned", "Unassigned"
		if deal.OwnerID != nil {
			ownerKey = deal.OwnerID.String()
			if names[*deal.OwnerID] != "" {
				ownerName = names[*deal.OwnerID]
			} else {
				ownerName = ownerKey[:8]
			}
		}
		rep := repBuckets[ownerKey]
		if rep == nil {
			rep = &forecastRep{OwnerID: ownerKey, OwnerName: ownerName}
			repBuckets[ownerKey] = rep
		}
		weighted := deal.Amount * deal.Probability / 100
		bucket.Deals++
		rep.Deals++
		if deal.Status == "won" {
			bucket.Won += deal.Amount
			rep.Won += deal.Amount
		} else {
			bucket.Pipeline += deal.Amount
			bucket.Weighted += weighted
			rep.Pipeline += deal.Amount
			rep.Weighted += weighted
		}
	}
	periods := make([]forecastBucket, 0, len(buckets))
	for _, value := range buckets {
		periods = append(periods, *value)
	}
	sort.Slice(periods, func(i, j int) bool { return periods[i].Period < periods[j].Period })
	byRep := make([]forecastRep, 0, len(repBuckets))
	for _, value := range repBuckets {
		byRep = append(byRep, *value)
	}
	sort.Slice(byRep, func(i, j int) bool { return byRep[i].Weighted > byRep[j].Weighted })
	lostMap := make(map[string]*lostReasonSummary)
	for _, deal := range lostRows {
		reason := strings.TrimSpace(deal.LostReason)
		if reason == "" {
			reason = "Tidak disebutkan"
		}
		row := lostMap[reason]
		if row == nil {
			row = &lostReasonSummary{Reason: reason}
			lostMap[reason] = row
		}
		row.Deals++
		row.Amount += deal.Amount
	}
	lostReasons := make([]lostReasonSummary, 0, len(lostMap))
	for _, value := range lostMap {
		lostReasons = append(lostReasons, *value)
	}
	sort.Slice(lostReasons, func(i, j int) bool { return lostReasons[i].Amount > lostReasons[j].Amount })
	c.JSON(http.StatusOK, gin.H{"from": from.Format("2006-01-02"), "to": to.Format("2006-01-02"), "periods": periods, "by_rep": byRep, "lost_reasons": lostReasons})
}

func ensurePipelineStages(db *gorm.DB) ([]crmmodel.PipelineStage, error) {
	stages := make([]crmmodel.PipelineStage, 0)
	if err := db.Order("sort_order ASC").Find(&stages).Error; err != nil {
		return nil, err
	}
	if len(stages) == 0 {
		for i := range defaultPipelineStages {
			stage := defaultPipelineStages[i]
			if err := db.Create(&stage).Error; err != nil {
				return nil, err
			}
		}
		return ensurePipelineStages(db)
	}
	for i := range stages {
		inferred := inferStageType(stages[i].Name)
		if stages[i].StageType == "" || (stages[i].StageType == "open" && inferred != "open") {
			if err := db.Model(&stages[i]).Update("stage_type", inferred).Error; err != nil {
				return nil, err
			}
			stages[i].StageType = inferred
		}
	}
	return stages, nil
}

func inferStageType(name string) string {
	lower := strings.ToLower(name)
	if strings.Contains(lower, "won") {
		return "won"
	}
	if strings.Contains(lower, "lost") {
		return "lost"
	}
	return "open"
}
func statusForStageType(stageType string) string {
	if stageType == "won" {
		return "won"
	}
	if stageType == "lost" {
		return "lost"
	}
	return "open"
}
func findPipelineStage(stages []crmmodel.PipelineStage, id *uuid.UUID) (crmmodel.PipelineStage, error) {
	if id != nil {
		for _, stage := range stages {
			if stage.ID == *id {
				return stage, nil
			}
		}
	}
	return crmmodel.PipelineStage{}, fmt.Errorf("pipeline stage tidak ditemukan")
}

func validateOpportunityRelations(db *gorm.DB, accountID, contactID, ownerID *uuid.UUID) error {
	if accountID != nil {
		var count int64
		if err := db.Model(&crmmodel.Account{}).Where("id = ?", *accountID).Count(&count).Error; err != nil || count == 0 {
			return fmt.Errorf("account_id tidak ditemukan")
		}
	}
	if contactID != nil {
		var contact crmmodel.Contact
		if err := db.First(&contact, "id = ?", *contactID).Error; err != nil {
			return fmt.Errorf("contact_id tidak ditemukan")
		}
		if accountID != nil && contact.AccountID != nil && *contact.AccountID != *accountID {
			return fmt.Errorf("kontak tidak terhubung dengan account yang dipilih")
		}
	}
	if ownerID != nil {
		var count int64
		if err := db.Model(&coremodel.User{}).Where("id = ?", *ownerID).Count(&count).Error; err != nil || count == 0 {
			return fmt.Errorf("sales rep tidak ditemukan")
		}
	}
	return nil
}

func enrichOpportunities(db *gorm.DB, opportunities []crmmodel.Opportunity, stages []crmmodel.PipelineStage) ([]opportunityView, error) {
	stageNames := make(map[uuid.UUID]string)
	for _, stage := range stages {
		stageNames[stage.ID] = stage.Name
	}
	accounts := make([]crmmodel.Account, 0)
	contacts := make([]crmmodel.Contact, 0)
	if err := db.Select("id", "name").Find(&accounts).Error; err != nil {
		return nil, err
	}
	if err := db.Select("id", "first_name", "last_name").Find(&contacts).Error; err != nil {
		return nil, err
	}
	accountNames := make(map[uuid.UUID]string)
	for _, account := range accounts {
		accountNames[account.ID] = account.Name
	}
	contactNames := make(map[uuid.UUID]string)
	for _, contact := range contacts {
		contactNames[contact.ID] = strings.TrimSpace(contact.FirstName + " " + contact.LastName)
	}
	reps, err := pipelineSalesReps(db)
	if err != nil {
		return nil, err
	}
	repNames := make(map[uuid.UUID]string)
	for _, rep := range reps {
		repNames[rep.ID] = rep.Name
	}
	views := make([]opportunityView, 0, len(opportunities))
	for _, opportunity := range opportunities {
		view := opportunityView{Opportunity: opportunity, Weighted: opportunity.Amount * opportunity.Probability / 100}
		if opportunity.StageID != nil {
			view.StageName = stageNames[*opportunity.StageID]
		}
		if opportunity.AccountID != nil {
			view.AccountName = accountNames[*opportunity.AccountID]
		}
		if opportunity.ContactID != nil {
			view.ContactName = contactNames[*opportunity.ContactID]
		}
		if opportunity.OwnerID != nil {
			view.OwnerName = repNames[*opportunity.OwnerID]
		}
		views = append(views, view)
	}
	return views, nil
}

func pipelineSalesReps(db *gorm.DB) ([]salesRepOption, error) {
	users := make([]coremodel.User, 0)
	if err := db.Select("id", "display_name", "first_name", "last_name", "email").Where("status = ?", 1).Order("display_name ASC").Find(&users).Error; err != nil {
		return nil, err
	}
	result := make([]salesRepOption, 0, len(users))
	for _, user := range users {
		name := strings.TrimSpace(user.DisplayName)
		if name == "" {
			name = strings.TrimSpace(user.FirstName + " " + user.LastName)
		}
		if name == "" {
			name = user.Email
		}
		result = append(result, salesRepOption{ID: user.ID, Name: name})
	}
	return result, nil
}

func forecastRange(c *gin.Context) (time.Time, time.Time, error) {
	now := time.Now()
	from := time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, now.Location())
	to := from.AddDate(0, 6, 0).Add(-time.Nanosecond)
	var err error
	if value := c.Query("from"); value != "" {
		from, err = time.Parse("2006-01-02", value)
		if err != nil {
			return from, to, fmt.Errorf("format from harus YYYY-MM-DD")
		}
	}
	if value := c.Query("to"); value != "" {
		to, err = time.Parse("2006-01-02", value)
		if err != nil {
			return from, to, fmt.Errorf("format to harus YYYY-MM-DD")
		}
	}
	if to.Before(from) {
		return from, to, fmt.Errorf("to harus setelah from")
	}
	return from, to, nil
}
