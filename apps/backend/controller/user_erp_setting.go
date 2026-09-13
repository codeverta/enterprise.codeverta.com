package controller

import (
	"encoding/json"
	"net/http"
	"strings"

	"gin-template/model"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"gorm.io/datatypes"
)

func erpTenantID(c *gin.Context) (uuid.UUID, bool) {
	id, err := uuid.Parse(strings.TrimSpace(c.GetString("tenant_id")))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "tenant tidak valid"})
		return uuid.Nil, false
	}
	return id, true
}

func (ctrl *UserController) ListModuleProfiles(c *gin.Context) {
	tenantID, ok := erpTenantID(c)
	if !ok {
		return
	}
	var rows []model.ModuleProfile
	if err := model.GetDB(c).Where("tenant_id = ?", tenantID).Order("name asc").Find(&rows).Error; err != nil {
		sendInternalError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": rows})
}

func (ctrl *UserController) CreateModuleProfile(c *gin.Context) {
	tenantID, ok := erpTenantID(c)
	if !ok {
		return
	}
	var input struct {
		Name           string   `json:"name"`
		Description    string   `json:"description"`
		BlockedModules []string `json:"blocked_modules"`
	}
	if c.ShouldBindJSON(&input) != nil || strings.TrimSpace(input.Name) == "" {
		c.JSON(400, gin.H{"error": "Nama Module Profile wajib diisi"})
		return
	}
	modules, _ := json.Marshal(input.BlockedModules)
	row := model.ModuleProfile{ID: uuid.New(), TenantID: tenantID, Name: strings.TrimSpace(input.Name), Description: input.Description, BlockedModules: datatypes.JSON(modules)}
	if err := model.GetDB(c).Create(&row).Error; err != nil {
		sendInternalError(c, err)
		return
	}
	c.JSON(http.StatusCreated, row)
}

func (ctrl *UserController) UpdateModuleProfile(c *gin.Context) {
	tenantID, ok := erpTenantID(c)
	if !ok {
		return
	}
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(400, gin.H{"error": "ID tidak valid"})
		return
	}
	var row model.ModuleProfile
	if err := model.GetDB(c).Where("tenant_id = ? AND id = ?", tenantID, id).First(&row).Error; err != nil {
		c.JSON(404, gin.H{"error": "Module Profile tidak ditemukan"})
		return
	}
	var input struct {
		Name           string   `json:"name"`
		Description    string   `json:"description"`
		BlockedModules []string `json:"blocked_modules"`
	}
	if c.ShouldBindJSON(&input) != nil {
		c.JSON(400, gin.H{"error": "Data tidak valid"})
		return
	}
	modules, _ := json.Marshal(input.BlockedModules)
	row.Name, row.Description, row.BlockedModules = strings.TrimSpace(input.Name), input.Description, datatypes.JSON(modules)
	if err := model.GetDB(c).Save(&row).Error; err != nil {
		sendInternalError(c, err)
		return
	}
	c.JSON(200, row)
}

func (ctrl *UserController) DeleteModuleProfile(c *gin.Context) {
	tenantID, ok := erpTenantID(c)
	if !ok {
		return
	}
	if err := model.GetDB(c).Where("tenant_id = ? AND id = ?", tenantID, c.Param("id")).Delete(&model.ModuleProfile{}).Error; err != nil {
		sendInternalError(c, err)
		return
	}
	c.Status(http.StatusNoContent)
}

func (ctrl *UserController) GetERPUserSetting(c *gin.Context) {
	tenantID, ok := erpTenantID(c)
	if !ok {
		return
	}
	userID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(400, gin.H{"error": "ID user tidak valid"})
		return
	}
	var row model.UserERPSetting
	if err := model.GetDB(c).Where("tenant_id = ? AND user_id = ?", tenantID, userID).First(&row).Error; err != nil {
		c.JSON(200, gin.H{"user_id": userID, "settings": gin.H{}})
		return
	}
	c.JSON(200, row)
}

func (ctrl *UserController) SaveERPUserSetting(c *gin.Context) {
	tenantID, ok := erpTenantID(c)
	if !ok {
		return
	}
	userID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(400, gin.H{"error": "ID user tidak valid"})
		return
	}
	var input struct {
		ModuleProfileID *uuid.UUID             `json:"module_profile_id"`
		Settings        map[string]interface{} `json:"settings"`
	}
	if c.ShouldBindJSON(&input) != nil {
		c.JSON(400, gin.H{"error": "Data tidak valid"})
		return
	}
	payload, _ := json.Marshal(input.Settings)
	row := model.UserERPSetting{UserID: userID, TenantID: tenantID, ModuleProfileID: input.ModuleProfileID, Settings: datatypes.JSON(payload)}
	if err := model.GetDB(c).Where("user_id = ?", userID).Assign(row).FirstOrCreate(&row).Error; err != nil {
		sendInternalError(c, err)
		return
	}
	c.JSON(200, row)
}
