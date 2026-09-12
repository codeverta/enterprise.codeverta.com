package framework

import (
	"gin-template/middleware"
	"gin-template/modules/framework/doctype"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

var Documents = doctype.NewRegistry()

func Register(definition doctype.Definition) error { return Documents.Register(definition) }

func MustRegister(definition doctype.Definition) { Documents.MustRegister(definition) }

// RegisterDocument is the shortest path for a module to expose a lifecycle-aware
// DocType. The table is migrated and its standard routes are mounted automatically.
func RegisterDocument[T any](name string, configure func(*doctype.Definition)) {
	MustRegister(doctype.DefinitionFor[T](name, configure))
}

func RegisterRoutes(parent *gin.RouterGroup, db *gorm.DB) error {
	if err := Documents.Migrate(db); err != nil {
		return err
	}
	controller := doctype.NewController(Documents, db)
	group := parent.Group("/doctype")
	group.Use(middleware.AdminAuth())
	{
		group.GET("/definitions", controller.Definitions)
		group.GET("/schema", controller.Schema)
		group.GET("/:doctype", controller.List)
		group.POST("/:doctype", controller.Create)
		group.GET("/:doctype/:id", controller.Get)
		group.PUT("/:doctype/:id", controller.Save)
		group.POST("/:doctype/:id/submit", controller.Submit)
		group.POST("/:doctype/:id/cancel", controller.Cancel)
		group.POST("/:doctype/:id/amend", controller.Amend)
		group.GET("/:doctype/:id/revisions", controller.Revisions)
	}
	return nil
}
