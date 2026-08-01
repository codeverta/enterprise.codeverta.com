package controller

import (
	"gin-template/model"
	"strings"

	"github.com/gin-gonic/gin"
)

// GET /lms/guides — public (authenticated) guides listing
func (ctrl *LMSController) ListGuides(c *gin.Context) {
	db := lmsDB(c, ctrl.DB)
	query := db.Model(&model.Guide{}).Order("sort_order asc, created_at desc")

	if s := strings.TrimSpace(c.Query("search")); s != "" {
		like := "%" + s + "%"
		query = query.Where("title LIKE ? OR description LIKE ?", like, like)
	}
	if cat := c.Query("category"); cat != "" {
		query = query.Where("category = ?", cat)
	}

	var guides []model.Guide
	if err := query.Find(&guides).Error; err != nil {
		sendInternalError(c, err)
		return
	}
	sendSuccess(c, guides, "Guides retrieved")
}
