package controller

import (
	"gin-template/common"
	"gin-template/model"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

type GlobalDefaultsController struct {
	DB *gorm.DB
}

func NewGlobalDefaultsController(db *gorm.DB) *GlobalDefaultsController {
	return &GlobalDefaultsController{DB: db}
}

func (ctrl *GlobalDefaultsController) getDB(c *gin.Context) *gorm.DB {
	if dbVal, exists := c.Get("db"); exists {
		if db, ok := dbVal.(*gorm.DB); ok {
			return db
		}
	}
	return ctrl.DB.WithContext(c.Request.Context())
}

func (ctrl *GlobalDefaultsController) Get(c *gin.Context) {
	db := ctrl.getDB(c)
	var gd model.GlobalDefaults
	err := db.First(&gd).Error
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			// Lazy initialize with sensible defaults
			var defaultComp model.Company
			_ = db.Where("is_active = ?", true).First(&defaultComp).Error

			var tenantID *uuid.UUID
			if tenant, ok := c.Get(common.CtxTenantKey); ok {
				if t, ok := tenant.(model.Tenant); ok && t.ID != uuid.Nil {
					tenantID = &t.ID
				}
			}

			gd = model.GlobalDefaults{
				ID:                                    uuid.New(),
				TenantID:                              tenantID,
				DefaultCompany:                        defaultComp.Name,
				Country:                               "Indonesia",
				DefaultDistanceUnit:                   "Kilometer",
				DefaultCurrency:                       "IDR",
				HideCurrencySymbol:                    "No",
				DisableRoundedTotal:                   false,
				DisableInWords:                        false,
				UsePostingDatetimeForNamingDocuments: false,
			}
			_ = db.Create(&gd).Error
		} else {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
	}
	c.JSON(http.StatusOK, gin.H{"data": gd})
}

func (ctrl *GlobalDefaultsController) Update(c *gin.Context) {
	db := ctrl.getDB(c)
	var gd model.GlobalDefaults
	if err := db.First(&gd).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			gd = model.GlobalDefaults{
				ID: uuid.New(),
			}
			if tenant, ok := c.Get(common.CtxTenantKey); ok {
				if t, ok := tenant.(model.Tenant); ok && t.ID != uuid.Nil {
					gd.TenantID = &t.ID
				}
			}
		} else {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
	}

	var input model.GlobalDefaults
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	gd.DefaultCompany = strings.TrimSpace(input.DefaultCompany)
	gd.Country = strings.TrimSpace(input.Country)
	gd.DefaultDistanceUnit = strings.TrimSpace(input.DefaultDistanceUnit)
	gd.DefaultCurrency = strings.TrimSpace(input.DefaultCurrency)
	gd.HideCurrencySymbol = strings.TrimSpace(input.HideCurrencySymbol)
	if gd.HideCurrencySymbol == "" {
		gd.HideCurrencySymbol = "No"
	}
	gd.DisableRoundedTotal = input.DisableRoundedTotal
	gd.DisableInWords = input.DisableInWords
	gd.UsePostingDatetimeForNamingDocuments = input.UsePostingDatetimeForNamingDocuments

	if err := db.Save(&gd).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": gd})
}
