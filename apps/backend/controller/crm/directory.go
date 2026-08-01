package crm

import (
	"net/http"
	"sort"
	"strings"
	"time"

	"gin-template/model"
	crmmodel "gin-template/model/crm"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

type accountPayload struct {
	Name            string     `json:"name" binding:"required,max=150"`
	Industry        string     `json:"industry" binding:"max=100"`
	CompanySize     string     `json:"company_size" binding:"omitempty,oneof=micro small medium large enterprise"`
	Region          string     `json:"region" binding:"max=100"`
	Website         string     `json:"website" binding:"omitempty,url,max=255"`
	Phone           string     `json:"phone" binding:"max=30"`
	Address         string     `json:"address"`
	ParentAccountID *uuid.UUID `json:"parent_account_id"`
	Status          string     `json:"status" binding:"omitempty,oneof=prospect customer churned"`
	Tags            []string   `json:"tags" binding:"max=30,dive,max=50"`
}

type contactPayload struct {
	AccountID *uuid.UUID `json:"account_id"`
	FirstName string     `json:"first_name" binding:"required,max=100"`
	LastName  string     `json:"last_name" binding:"max=100"`
	Email     string     `json:"email" binding:"omitempty,email,max=150"`
	Phone     string     `json:"phone" binding:"max=30"`
	Position  string     `json:"position" binding:"max=100"`
	Tags      []string   `json:"tags" binding:"max=30,dive,max=50"`
}

type interactionPayload struct {
	Type        string     `json:"type" binding:"required,oneof=call email meeting task"`
	Subject     string     `json:"subject" binding:"required,max=150"`
	Description string     `json:"description"`
	DueDate     *time.Time `json:"due_date"`
	Status      string     `json:"status" binding:"omitempty,oneof=pending completed cancelled"`
}

type accountView struct {
	crmmodel.Account
	ParentName   string   `json:"parent_name"`
	ContactCount int64    `json:"contact_count"`
	Tags         []string `json:"tags"`
}

type contactView struct {
	crmmodel.Contact
	AccountName string   `json:"account_name"`
	Tags        []string `json:"tags"`
}

func (h *Controller) ListAccounts(c *gin.Context) {
	db := model.GetDB(c).WithContext(c.Request.Context())
	page, pageSize := directoryPage(c)
	query := db.Model(&crmmodel.Account{})
	for _, filter := range []string{"status", "industry", "company_size", "region", "parent_account_id"} {
		if value := strings.TrimSpace(c.Query(filter)); value != "" {
			query = query.Where(filter+" = ?", value)
		}
	}
	if value := strings.TrimSpace(c.Query("q")); value != "" {
		like := "%" + value + "%"
		query = query.Where("name LIKE ? OR industry LIKE ? OR region LIKE ? OR phone LIKE ?", like, like, like, like)
	}
	if tag := strings.TrimSpace(c.Query("tag")); tag != "" {
		query = query.Where("id IN (?)", db.Model(&crmmodel.Taggable{}).
			Select("related_to_id").Joins("JOIN crm_tags ON crm_tags.id = crm_taggables.tag_id").
			Where("related_to_type = ? AND crm_tags.name = ?", "account", tag))
	}
	var total int64
	if err := query.Count(&total).Error; err != nil {
		writeDBError(c, err)
		return
	}
	accounts := make([]crmmodel.Account, 0)
	if err := query.Order("name ASC").Limit(pageSize).Offset((page - 1) * pageSize).Find(&accounts).Error; err != nil {
		writeDBError(c, err)
		return
	}
	views, err := enrichAccounts(db, accounts)
	if err != nil {
		writeDBError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": views, "meta": gin.H{"page": page, "page_size": pageSize, "total": total}})
}

func (h *Controller) CreateAccount(c *gin.Context) {
	var payload accountPayload
	if err := c.ShouldBindJSON(&payload); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	db := model.GetDB(c).WithContext(c.Request.Context())
	if err := validateAccountParent(db, uuid.Nil, payload.ParentAccountID); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	account := accountFromPayload(payload)
	account.OwnerID = actorPointer(c)
	err := db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Create(&account).Error; err != nil {
			return err
		}
		return syncDirectoryTags(tx, "account", account.ID, payload.Tags)
	})
	if err != nil {
		writeDBError(c, err)
		return
	}
	views, _ := enrichAccounts(db, []crmmodel.Account{account})
	c.JSON(http.StatusCreated, views[0])
}

func (h *Controller) UpdateAccount(c *gin.Context) {
	id, ok := parseID(c)
	if !ok {
		return
	}
	var payload accountPayload
	if err := c.ShouldBindJSON(&payload); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	db := model.GetDB(c).WithContext(c.Request.Context())
	var account crmmodel.Account
	if err := db.First(&account, "id = ?", id).Error; err != nil {
		writeLookupError(c, err)
		return
	}
	if err := validateAccountParent(db, id, payload.ParentAccountID); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	updated := accountFromPayload(payload)
	err := db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Model(&account).Updates(map[string]interface{}{
			"name": updated.Name, "industry": updated.Industry, "company_size": updated.CompanySize,
			"region": updated.Region, "website": updated.Website, "phone": updated.Phone,
			"address": updated.Address, "parent_account_id": updated.ParentAccountID, "status": updated.Status,
		}).Error; err != nil {
			return err
		}
		return syncDirectoryTags(tx, "account", id, payload.Tags)
	})
	if err != nil {
		writeDBError(c, err)
		return
	}
	if err := db.First(&account, "id = ?", id).Error; err != nil {
		writeDBError(c, err)
		return
	}
	views, _ := enrichAccounts(db, []crmmodel.Account{account})
	c.JSON(http.StatusOK, views[0])
}

func (h *Controller) DeleteAccount(c *gin.Context) {
	id, ok := parseID(c)
	if !ok {
		return
	}
	db := model.GetDB(c).WithContext(c.Request.Context())
	err := db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Model(&crmmodel.Account{}).Where("parent_account_id = ?", id).Update("parent_account_id", nil).Error; err != nil {
			return err
		}
		if err := tx.Model(&crmmodel.Contact{}).Where("account_id = ?", id).Update("account_id", nil).Error; err != nil {
			return err
		}
		if err := tx.Unscoped().Where("related_to_type = ? AND related_to_id = ?", "account", id).Delete(&crmmodel.Taggable{}).Error; err != nil {
			return err
		}
		return tx.Delete(&crmmodel.Account{}, "id = ?", id).Error
	})
	if err != nil {
		writeDBError(c, err)
		return
	}
	c.Status(http.StatusNoContent)
}

func (h *Controller) ListContacts(c *gin.Context) {
	db := model.GetDB(c).WithContext(c.Request.Context())
	page, pageSize := directoryPage(c)
	query := db.Model(&crmmodel.Contact{})
	if value := strings.TrimSpace(c.Query("account_id")); value != "" {
		query = query.Where("account_id = ?", value)
	}
	if value := strings.TrimSpace(c.Query("q")); value != "" {
		like := "%" + value + "%"
		query = query.Where("first_name LIKE ? OR last_name LIKE ? OR email LIKE ? OR phone LIKE ? OR position LIKE ?", like, like, like, like, like)
	}
	if tag := strings.TrimSpace(c.Query("tag")); tag != "" {
		query = query.Where("id IN (?)", db.Model(&crmmodel.Taggable{}).Select("related_to_id").
			Joins("JOIN crm_tags ON crm_tags.id = crm_taggables.tag_id").Where("related_to_type = ? AND crm_tags.name = ?", "contact", tag))
	}
	var total int64
	if err := query.Count(&total).Error; err != nil {
		writeDBError(c, err)
		return
	}
	contacts := make([]crmmodel.Contact, 0)
	if err := query.Order("first_name ASC, last_name ASC").Limit(pageSize).Offset((page - 1) * pageSize).Find(&contacts).Error; err != nil {
		writeDBError(c, err)
		return
	}
	views, err := enrichContacts(db, contacts)
	if err != nil {
		writeDBError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": views, "meta": gin.H{"page": page, "page_size": pageSize, "total": total}})
}

func (h *Controller) CreateContact(c *gin.Context) { h.saveContact(c, uuid.Nil) }
func (h *Controller) UpdateContact(c *gin.Context) {
	id, ok := parseID(c)
	if !ok {
		return
	}
	h.saveContact(c, id)
}

func (h *Controller) saveContact(c *gin.Context, id uuid.UUID) {
	var payload contactPayload
	if err := c.ShouldBindJSON(&payload); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	db := model.GetDB(c).WithContext(c.Request.Context())
	if err := validateContactAccount(db, payload.AccountID); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	contact := contactFromPayload(payload)
	status := http.StatusCreated
	err := db.Transaction(func(tx *gorm.DB) error {
		if id == uuid.Nil {
			contact.OwnerID = actorPointer(c)
			if err := tx.Create(&contact).Error; err != nil {
				return err
			}
			id = contact.ID
		} else {
			if err := tx.First(&contact, "id = ?", id).Error; err != nil {
				return err
			}
			status = http.StatusOK
			if err := tx.Model(&contact).Updates(map[string]interface{}{
				"account_id": payload.AccountID, "first_name": strings.TrimSpace(payload.FirstName),
				"last_name": strings.TrimSpace(payload.LastName), "email": strings.TrimSpace(payload.Email),
				"phone": strings.TrimSpace(payload.Phone), "position": strings.TrimSpace(payload.Position),
			}).Error; err != nil {
				return err
			}
		}
		return syncDirectoryTags(tx, "contact", id, payload.Tags)
	})
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			writeLookupError(c, err)
		} else {
			writeDBError(c, err)
		}
		return
	}
	if err := db.First(&contact, "id = ?", id).Error; err != nil {
		writeDBError(c, err)
		return
	}
	views, _ := enrichContacts(db, []crmmodel.Contact{contact})
	c.JSON(status, views[0])
}

func (h *Controller) DeleteContact(c *gin.Context) {
	id, ok := parseID(c)
	if !ok {
		return
	}
	db := model.GetDB(c).WithContext(c.Request.Context())
	err := db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Unscoped().Where("related_to_type = ? AND related_to_id = ?", "contact", id).Delete(&crmmodel.Taggable{}).Error; err != nil {
			return err
		}
		return tx.Delete(&crmmodel.Contact{}, "id = ?", id).Error
	})
	if err != nil {
		writeDBError(c, err)
		return
	}
	c.Status(http.StatusNoContent)
}

func (h *Controller) ListInteractions(c *gin.Context) {
	id, relatedType, ok := directoryTarget(c)
	if !ok {
		return
	}
	rows := make([]crmmodel.Activity, 0)
	if err := model.GetDB(c).WithContext(c.Request.Context()).Where("related_to_type = ? AND related_to_id = ?", relatedType, id).Order("created_at DESC").Find(&rows).Error; err != nil {
		writeDBError(c, err)
		return
	}
	c.JSON(http.StatusOK, rows)
}

func (h *Controller) CreateInteraction(c *gin.Context) {
	id, relatedType, ok := directoryTarget(c)
	if !ok {
		return
	}
	var payload interactionPayload
	if err := c.ShouldBindJSON(&payload); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	activity := crmmodel.Activity{Type: payload.Type, Subject: strings.TrimSpace(payload.Subject), Description: payload.Description, RelatedToType: relatedType, RelatedToID: id, OwnerID: actorPointer(c), DueDate: payload.DueDate, Status: payload.Status}
	if activity.Status == "" {
		activity.Status = "completed"
	}
	if activity.Status == "completed" {
		now := time.Now()
		activity.CompletedAt = &now
	}
	if err := model.GetDB(c).WithContext(c.Request.Context()).Create(&activity).Error; err != nil {
		writeDBError(c, err)
		return
	}
	c.JSON(http.StatusCreated, activity)
}

func directoryPage(c *gin.Context) (int, int) {
	page, size := positiveInt(c.DefaultQuery("page", "1"), 1), positiveInt(c.DefaultQuery("page_size", "50"), 50)
	if size > 100 {
		size = 100
	}
	return page, size
}

func accountFromPayload(value accountPayload) crmmodel.Account {
	status := value.Status
	if status == "" {
		status = "prospect"
	}
	return crmmodel.Account{Name: strings.TrimSpace(value.Name), Industry: strings.TrimSpace(value.Industry), CompanySize: value.CompanySize, Region: strings.TrimSpace(value.Region), Website: strings.TrimSpace(value.Website), Phone: strings.TrimSpace(value.Phone), Address: strings.TrimSpace(value.Address), ParentAccountID: value.ParentAccountID, Status: status}
}

func contactFromPayload(value contactPayload) crmmodel.Contact {
	return crmmodel.Contact{AccountID: value.AccountID, FirstName: strings.TrimSpace(value.FirstName), LastName: strings.TrimSpace(value.LastName), Email: strings.TrimSpace(value.Email), Phone: strings.TrimSpace(value.Phone), Position: strings.TrimSpace(value.Position)}
}

func actorPointer(c *gin.Context) *uuid.UUID {
	id := actorID(c)
	if id == uuid.Nil {
		return nil
	}
	return &id
}

func validateContactAccount(db *gorm.DB, accountID *uuid.UUID) error {
	if accountID == nil {
		return nil
	}
	return db.Select("id").First(&crmmodel.Account{}, "id = ?", *accountID).Error
}

func validateAccountParent(db *gorm.DB, accountID uuid.UUID, parentID *uuid.UUID) error {
	if parentID == nil {
		return nil
	}
	if *parentID == accountID {
		return &directoryError{"Akun tidak dapat menjadi parent dirinya sendiri"}
	}
	current := *parentID
	for depth := 0; depth < 100; depth++ {
		var parent crmmodel.Account
		if err := db.Select("id", "parent_account_id").First(&parent, "id = ?", current).Error; err != nil {
			return err
		}
		if parent.ID == accountID {
			return &directoryError{"Hierarki perusahaan tidak boleh membentuk siklus"}
		}
		if parent.ParentAccountID == nil {
			return nil
		}
		current = *parent.ParentAccountID
	}
	return &directoryError{"Hierarki perusahaan terlalu dalam"}
}

type directoryError struct{ message string }

func (e *directoryError) Error() string { return e.message }

func syncDirectoryTags(db *gorm.DB, relatedType string, relatedID uuid.UUID, names []string) error {
	if err := db.Unscoped().Where("related_to_type = ? AND related_to_id = ?", relatedType, relatedID).Delete(&crmmodel.Taggable{}).Error; err != nil {
		return err
	}
	seen := make(map[string]bool)
	for _, raw := range names {
		name := strings.TrimSpace(raw)
		key := strings.ToLower(name)
		if name == "" || seen[key] {
			continue
		}
		seen[key] = true
		var tag crmmodel.Tag
		if err := db.Where("LOWER(name) = ?", key).First(&tag).Error; err != nil {
			if err != gorm.ErrRecordNotFound {
				return err
			}
			tag = crmmodel.Tag{Name: name}
			if err := db.Create(&tag).Error; err != nil {
				return err
			}
		}
		if err := db.Create(&crmmodel.Taggable{TagID: tag.ID, RelatedToType: relatedType, RelatedToID: relatedID}).Error; err != nil {
			return err
		}
	}
	return nil
}

func tagMap(db *gorm.DB, relatedType string, ids []uuid.UUID) (map[uuid.UUID][]string, error) {
	result := make(map[uuid.UUID][]string)
	if len(ids) == 0 {
		return result, nil
	}
	type row struct {
		RelatedToID uuid.UUID
		Name        string
	}
	rows := make([]row, 0)
	err := db.Model(&crmmodel.Taggable{}).Select("crm_taggables.related_to_id, crm_tags.name").Joins("JOIN crm_tags ON crm_tags.id = crm_taggables.tag_id").Where("related_to_type = ? AND related_to_id IN ?", relatedType, ids).Scan(&rows).Error
	if err != nil {
		return nil, err
	}
	for _, row := range rows {
		result[row.RelatedToID] = append(result[row.RelatedToID], row.Name)
	}
	for id := range result {
		sort.Strings(result[id])
	}
	return result, nil
}

func enrichAccounts(db *gorm.DB, accounts []crmmodel.Account) ([]accountView, error) {
	ids := make([]uuid.UUID, len(accounts))
	names := make(map[uuid.UUID]string)
	for i, account := range accounts {
		ids[i] = account.ID
		names[account.ID] = account.Name
	}
	parents := make([]crmmodel.Account, 0)
	if err := db.Select("id", "name").Find(&parents).Error; err != nil {
		return nil, err
	}
	for _, parent := range parents {
		names[parent.ID] = parent.Name
	}
	tags, err := tagMap(db, "account", ids)
	if err != nil {
		return nil, err
	}
	type countRow struct {
		AccountID uuid.UUID
		Total     int64
	}
	counts := make([]countRow, 0)
	if len(ids) > 0 {
		if err := db.Model(&crmmodel.Contact{}).Select("account_id, COUNT(*) AS total").Where("account_id IN ?", ids).Group("account_id").Scan(&counts).Error; err != nil {
			return nil, err
		}
	}
	countMap := make(map[uuid.UUID]int64)
	for _, row := range counts {
		countMap[row.AccountID] = row.Total
	}
	views := make([]accountView, 0, len(accounts))
	for _, account := range accounts {
		parentName := ""
		if account.ParentAccountID != nil {
			parentName = names[*account.ParentAccountID]
		}
		views = append(views, accountView{Account: account, ParentName: parentName, ContactCount: countMap[account.ID], Tags: tags[account.ID]})
	}
	return views, nil
}

func enrichContacts(db *gorm.DB, contacts []crmmodel.Contact) ([]contactView, error) {
	ids := make([]uuid.UUID, len(contacts))
	accountIDs := make([]uuid.UUID, 0)
	for i, contact := range contacts {
		ids[i] = contact.ID
		if contact.AccountID != nil {
			accountIDs = append(accountIDs, *contact.AccountID)
		}
	}
	accounts := make([]crmmodel.Account, 0)
	if len(accountIDs) > 0 {
		if err := db.Select("id", "name").Where("id IN ?", accountIDs).Find(&accounts).Error; err != nil {
			return nil, err
		}
	}
	names := make(map[uuid.UUID]string)
	for _, account := range accounts {
		names[account.ID] = account.Name
	}
	tags, err := tagMap(db, "contact", ids)
	if err != nil {
		return nil, err
	}
	views := make([]contactView, 0, len(contacts))
	for _, contact := range contacts {
		name := ""
		if contact.AccountID != nil {
			name = names[*contact.AccountID]
		}
		views = append(views, contactView{Contact: contact, AccountName: name, Tags: tags[contact.ID]})
	}
	return views, nil
}

func directoryTarget(c *gin.Context) (uuid.UUID, string, bool) {
	id, ok := parseID(c)
	if !ok {
		return uuid.Nil, "", false
	}
	kind := c.Param("kind")
	relatedType := ""
	switch kind {
	case "accounts":
		relatedType = "account"
	case "contacts":
		relatedType = "contact"
	default:
		c.JSON(http.StatusBadRequest, gin.H{"error": "kind harus accounts atau contacts"})
		return uuid.Nil, "", false
	}
	var count int64
	target := interface{}(&crmmodel.Account{})
	if relatedType == "contact" {
		target = &crmmodel.Contact{}
	}
	if err := model.GetDB(c).WithContext(c.Request.Context()).Model(target).Where("id = ?", id).Count(&count).Error; err != nil {
		writeDBError(c, err)
		return uuid.Nil, "", false
	}
	if count == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "CRM record not found"})
		return uuid.Nil, "", false
	}
	return id, relatedType, true
}
