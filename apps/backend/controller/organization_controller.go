package controller

import (
	"gin-template/common"
	"gin-template/model"
	accountingmodel "gin-template/modules/accounting/model"
	sellingmodel "gin-template/modules/selling/model"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

type OrganizationController struct {
	DB *gorm.DB
}

func NewOrganizationController(db *gorm.DB) *OrganizationController {
	return &OrganizationController{DB: db}
}

func (oc *OrganizationController) getDB(c *gin.Context) *gorm.DB {
	if dbVal, exists := c.Get("db"); exists {
		if db, ok := dbVal.(*gorm.DB); ok {
			return db
		}
	}
	return oc.DB.WithContext(c.Request.Context())
}

// Seed trigger endpoint
func (oc *OrganizationController) Seed(c *gin.Context) {
	tenant, _ := c.Get(common.CtxTenantKey)
	tenantObj, _ := tenant.(model.Tenant)
	db := oc.getDB(c)

	if err := model.SeedOrganizationData(db, tenantObj.ID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Organization data (Companies, Branches, Departments, LetterHeads) successfully seeded!"})
}

// ========== COMPANY HANDLERS ==========

type companyContextItem struct {
	ID           uuid.UUID `json:"id"`
	Name         string    `json:"name"`
	Abbreviation string    `json:"abbreviation"`
	Currency     string    `json:"currency"`
}

func activeCompanyItems(db *gorm.DB) ([]companyContextItem, error) {
	var companies []companyContextItem
	err := db.Model(&model.Company{}).
		Select("id", "name", "abbreviation", "currency").
		Where("is_active = ?", true).
		Order("name asc").Scan(&companies).Error
	return companies, err
}

func containsCompany(companies []companyContextItem, id *uuid.UUID) bool {
	if id == nil {
		return false
	}
	for _, company := range companies {
		if company.ID == *id {
			return true
		}
	}
	return false
}

func companyContextPayload(companies []companyContextItem, activeID *uuid.UUID) gin.H {
	var active *companyContextItem
	for index := range companies {
		if activeID != nil && companies[index].ID == *activeID {
			item := companies[index]
			active = &item
			break
		}
	}
	return gin.H{"companies": companies, "active_company": active}
}

// GetCompanyContext returns the tenant's companies and the current user's
// active company. If the previous preference is no longer valid, the most-used
// active company is selected, falling back to the first available company.
func (oc *OrganizationController) GetCompanyContext(c *gin.Context) {
	userID, ok := currentUserID(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}
	db := oc.getDB(c)
	companies, err := activeCompanyItems(db)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal memuat company"})
		return
	}

	preference := model.UserAppPreference{UserID: userID, Language: "id"}
	if err := db.Where("user_id = ?", userID).FirstOrCreate(&preference).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal memuat preferensi company"})
		return
	}
	if !containsCompany(companies, preference.ActiveCompanyID) {
		var usage model.UserCompanyUsage
		err := db.Model(&model.UserCompanyUsage{}).
			Joins("JOIN companies ON companies.id = user_company_usages.company_id AND companies.deleted_at IS NULL AND companies.is_active = ?", true).
			Where("user_company_usages.user_id = ?", userID).
			Order("user_company_usages.selection_count DESC, user_company_usages.last_selected_at DESC").
			First(&usage).Error
		if err == nil {
			preference.ActiveCompanyID = &usage.CompanyID
		} else if len(companies) > 0 {
			preference.ActiveCompanyID = &companies[0].ID
		} else {
			preference.ActiveCompanyID = nil
		}
		if err := db.Model(&preference).Update("active_company_id", preference.ActiveCompanyID).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal menyimpan company aktif"})
			return
		}
	}
	c.JSON(http.StatusOK, gin.H{"data": companyContextPayload(companies, preference.ActiveCompanyID)})
}

// SelectCompany records actual usage. The most frequently selected company is
// promoted to active for this user only.
func (oc *OrganizationController) SelectCompany(c *gin.Context) {
	userID, ok := currentUserID(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}
	var req struct {
		CompanyID uuid.UUID `json:"company_id" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Company wajib dipilih"})
		return
	}
	db := oc.getDB(c)
	var selected model.Company
	if err := db.Where("id = ? AND is_active = ?", req.CompanyID, true).First(&selected).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Company aktif tidak ditemukan"})
		return
	}

	var activeID uuid.UUID
	err := db.Transaction(func(tx *gorm.DB) error {
		now := time.Now()
		usage := model.UserCompanyUsage{UserID: userID, CompanyID: req.CompanyID, LastSelectedAt: now}
		result := tx.Clauses(clause.OnConflict{
			Columns: []clause.Column{{Name: "user_id"}, {Name: "company_id"}},
			DoUpdates: clause.Assignments(map[string]interface{}{
				"selection_count":  gorm.Expr("selection_count + ?", 1),
				"last_selected_at": now,
			}),
		}).Create(&usage)
		if result.Error != nil {
			return result.Error
		}
		// A newly inserted row starts at one selection as well.
		if result.RowsAffected > 0 {
			tx.Model(&model.UserCompanyUsage{}).
				Where("user_id = ? AND company_id = ? AND selection_count = 0", userID, req.CompanyID).
				Update("selection_count", 1)
		}
		var favorite model.UserCompanyUsage
		if err := tx.Model(&model.UserCompanyUsage{}).
			Joins("JOIN companies ON companies.id = user_company_usages.company_id AND companies.deleted_at IS NULL AND companies.is_active = ?", true).
			Where("user_id = ?", userID).
			Order("selection_count DESC, last_selected_at DESC").First(&favorite).Error; err != nil {
			return err
		}
		activeID = favorite.CompanyID
		preference := model.UserAppPreference{UserID: userID, Language: "id"}
		if err := tx.Where("user_id = ?", userID).FirstOrCreate(&preference).Error; err != nil {
			return err
		}
		return tx.Model(&preference).Update("active_company_id", activeID).Error
	})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal menyimpan pemakaian company"})
		return
	}
	companies, err := activeCompanyItems(db)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal memuat company"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": companyContextPayload(companies, &activeID)})
}

func (oc *OrganizationController) ListCompanies(c *gin.Context) {
	db := oc.getDB(c)
	var companies []model.Company
	if err := db.Order("created_at desc").Find(&companies).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": companies})
}

func (oc *OrganizationController) CreateCompany(c *gin.Context) {
	db := oc.getDB(c)
	var req model.Company
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if err := db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Create(&req).Error; err != nil {
			return err
		}
		return accountingmodel.SeedDefaultAccountsForCompany(tx, accountingmodel.CompanySeedInput{
			ID: req.ID.String(), TenantID: req.TenantID.String(), Name: req.Name,
			Abbreviation: req.Abbreviation, Currency: req.Currency,
		})
	}); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, gin.H{"data": req})
}

func (oc *OrganizationController) GetCompany(c *gin.Context) {
	db := oc.getDB(c)
	id := c.Param("id")
	var comp model.Company
	if err := db.First(&comp, "id = ?", id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Company not found"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": comp})
}

func (oc *OrganizationController) UpdateCompany(c *gin.Context) {
	db := oc.getDB(c)
	id := c.Param("id")
	var comp model.Company
	if err := db.First(&comp, "id = ?", id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Company not found"})
		return
	}
	if err := c.ShouldBindJSON(&comp); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if err := db.Save(&comp).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": comp})
}

func (oc *OrganizationController) DeleteCompany(c *gin.Context) {
	db := oc.getDB(c)
	id := c.Param("id")
	if err := db.Delete(&model.Company{}, "id = ?", id).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Company deleted"})
}

func (oc *OrganizationController) ListCompanyAddresses(c *gin.Context) {
	db := oc.getDB(c)
	id := c.Param("id")
	var comp model.Company
	if err := db.Where("id = ? OR name = ?", id, id).First(&comp).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Company tidak ditemukan"})
		return
	}

	type AddressResult struct {
		ID           string `json:"id"`
		AddressTitle string `json:"address_title"`
		AddressLine1 string `json:"address_line1"`
		AddressLine2 string `json:"address_line2"`
		City         string `json:"city"`
		State        string `json:"state"`
		Country      string `json:"country"`
		PostalCode   string `json:"postal_code"`
	}

	var results []AddressResult
	var addresses []sellingmodel.Address
	_ = db.Where("(linked_doctype = 'Company' AND linked_name = ?) OR linked_name = ?", comp.Name, comp.Name).Find(&addresses)
	for _, a := range addresses {
		results = append(results, AddressResult{
			ID:           a.ID,
			AddressTitle: a.AddressTitle,
			AddressLine1: a.AddressLine1,
			AddressLine2: a.AddressLine2,
			City:         a.City,
			State:        a.State,
			Country:      a.Country,
			PostalCode:   a.PostalCode,
		})
	}

	if strings.TrimSpace(comp.Address) != "" {
		results = append(results, AddressResult{
			ID:           "comp-addr-" + comp.ID.String()[:8],
			AddressTitle: comp.Name + " - Head Office",
			AddressLine1: comp.Address,
			Country:      "Indonesia",
		})
	}

	c.JSON(http.StatusOK, gin.H{"data": results})
}

// ========== BRANCH HANDLERS ==========

func (oc *OrganizationController) ListBranches(c *gin.Context) {
	db := oc.getDB(c)
	var branches []model.Branch
	query := db.Preload("Company")
	if companyID := c.Query("company_id"); companyID != "" {
		query = query.Where("company_id = ?", companyID)
	}
	if err := query.Order("created_at desc").Find(&branches).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": branches})
}

func (oc *OrganizationController) CreateBranch(c *gin.Context) {
	db := oc.getDB(c)
	var req model.Branch
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if err := db.Create(&req).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, gin.H{"data": req})
}

func (oc *OrganizationController) GetBranch(c *gin.Context) {
	db := oc.getDB(c)
	id := c.Param("id")
	var branch model.Branch
	if err := db.Preload("Company").First(&branch, "id = ?", id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Branch not found"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": branch})
}

func (oc *OrganizationController) UpdateBranch(c *gin.Context) {
	db := oc.getDB(c)
	id := c.Param("id")
	var branch model.Branch
	if err := db.First(&branch, "id = ?", id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Branch not found"})
		return
	}
	if err := c.ShouldBindJSON(&branch); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if err := db.Save(&branch).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": branch})
}

func (oc *OrganizationController) DeleteBranch(c *gin.Context) {
	db := oc.getDB(c)
	id := c.Param("id")
	if err := db.Delete(&model.Branch{}, "id = ?", id).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Branch deleted"})
}

// ========== DEPARTMENT HANDLERS ==========

func (oc *OrganizationController) ListDepartments(c *gin.Context) {
	db := oc.getDB(c)
	var depts []model.Department
	query := db.Preload("Company").Preload("Branch").Preload("ParentDepartment")

	if companyID := c.Query("company_id"); companyID != "" {
		query = query.Where("company_id = ?", companyID)
	}

	if err := query.Order("name asc").Find(&depts).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": depts})
}

func (oc *OrganizationController) CreateDepartment(c *gin.Context) {
	db := oc.getDB(c)
	var req model.Department
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if err := db.Create(&req).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, gin.H{"data": req})
}

func (oc *OrganizationController) GetDepartment(c *gin.Context) {
	db := oc.getDB(c)
	id := c.Param("id")
	var dept model.Department
	if err := db.Preload("Company").Preload("Branch").Preload("ParentDepartment").First(&dept, "id = ?", id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Department not found"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": dept})
}

func (oc *OrganizationController) UpdateDepartment(c *gin.Context) {
	db := oc.getDB(c)
	id := c.Param("id")
	var dept model.Department
	if err := db.First(&dept, "id = ?", id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Department not found"})
		return
	}
	if err := c.ShouldBindJSON(&dept); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if err := db.Save(&dept).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": dept})
}

func (oc *OrganizationController) DeleteDepartment(c *gin.Context) {
	db := oc.getDB(c)
	id := c.Param("id")
	if err := db.Delete(&model.Department{}, "id = ?", id).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Department deleted"})
}

// ========== LETTER HEAD HANDLERS ==========

func (oc *OrganizationController) ListLetterHeads(c *gin.Context) {
	db := oc.getDB(c)
	var letterHeads []model.LetterHead
	query := db.Preload("Company")
	if companyID := c.Query("company_id"); companyID != "" {
		query = query.Where("company_id = ?", companyID)
	}
	if err := query.Order("is_default desc, created_at desc").Find(&letterHeads).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": letterHeads})
}

func (oc *OrganizationController) CreateLetterHead(c *gin.Context) {
	db := oc.getDB(c)
	var req model.LetterHead
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if req.IsDefault && req.CompanyID != nil {
		db.Model(&model.LetterHead{}).Where("company_id = ?", req.CompanyID).Update("is_default", false)
	}
	if err := db.Create(&req).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, gin.H{"data": req})
}

func (oc *OrganizationController) GetLetterHead(c *gin.Context) {
	db := oc.getDB(c)
	id := c.Param("id")
	var lh model.LetterHead
	if err := db.Preload("Company").First(&lh, "id = ?", id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "LetterHead not found"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": lh})
}

func (oc *OrganizationController) UpdateLetterHead(c *gin.Context) {
	db := oc.getDB(c)
	id := c.Param("id")
	var lh model.LetterHead
	if err := db.First(&lh, "id = ?", id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "LetterHead not found"})
		return
	}
	if err := c.ShouldBindJSON(&lh); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if lh.IsDefault && lh.CompanyID != nil {
		db.Model(&model.LetterHead{}).Where("company_id = ? AND id != ?", lh.CompanyID, lh.ID).Update("is_default", false)
	}
	if err := db.Save(&lh).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": lh})
}

func (oc *OrganizationController) DeleteLetterHead(c *gin.Context) {
	db := oc.getDB(c)
	id := c.Param("id")
	if err := db.Delete(&model.LetterHead{}, "id = ?", id).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "LetterHead deleted"})
}
