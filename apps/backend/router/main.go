package router

import (
	"embed"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

func SetRouter(router *gin.Engine, buildFS embed.FS, indexPage []byte, db *gorm.DB) {
	SetApiRouter(router, db)
}
