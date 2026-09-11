package controller

import (
	"gin-template/common"
	"gin-template/model"
	accountingmodel "gin-template/modules/accounting/model"
	"net/http"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
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
