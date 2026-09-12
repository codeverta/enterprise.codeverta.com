package manufacturing

import (
	"gin-template/middleware"
	"gin-template/modules/manufacturing/controller"

	"github.com/gin-gonic/gin"
)

func RegisterRoutes(parent *gin.RouterGroup) {
	c := controller.New()
	g := parent.Group("/manufacturing")
	g.Use(middleware.AdminAuth())
	{
		g.GET("/options", c.Options)
		g.GET("/operations", c.ListOperations)
		g.POST("/operations", c.CreateOperation)
		g.PUT("/operations/:id", c.UpdateOperation)
		g.DELETE("/operations/:id", c.DeleteOperation)
		g.GET("/workstation-types", c.ListWorkstationTypes)
		g.POST("/workstation-types", c.CreateWorkstationType)
		g.PUT("/workstation-types/:id", c.UpdateWorkstationType)
		g.DELETE("/workstation-types/:id", c.DeleteWorkstationType)
		g.GET("/workstations", c.ListWorkstations)
		g.POST("/workstations", c.CreateWorkstation)
		g.PUT("/workstations/:id", c.UpdateWorkstation)
		g.DELETE("/workstations/:id", c.DeleteWorkstation)
		g.GET("/boms", c.ListBOM)
		g.GET("/boms/:id", c.GetBOM)
		g.POST("/boms", c.CreateBOM)
		g.PUT("/boms/:id", c.UpdateBOM)
		g.DELETE("/boms/:id", c.DeleteBOM)
		g.GET("/work-orders", c.ListWorkOrders)
		g.GET("/work-orders/:id", c.GetWorkOrder)
		g.POST("/work-orders", c.CreateWorkOrder)
		g.PUT("/work-orders/:id", c.UpdateWorkOrder)
		g.POST("/work-orders/:id/submit", c.SubmitWorkOrder)
		g.DELETE("/work-orders/:id", c.DeleteWorkOrder)
	}
}
