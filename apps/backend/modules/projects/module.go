package projects

import (
	"gin-template/middleware"
	"gin-template/modules/projects/controller"

	"github.com/gin-gonic/gin"
)

// RegisterRoutes sets up the HTTP endpoints for the projects and tasks module.
func RegisterRoutes(router *gin.RouterGroup) {
	projCtrl := controller.NewProjectController()

	projectsGroup := router.Group("/projects")
	projectsGroup.Use(middleware.AdminAuth())
	{
		projectsGroup.GET("", projCtrl.ListProjects)
		projectsGroup.GET("/options", projCtrl.ProjectOptions)
		projectsGroup.GET("/:id", projCtrl.GetProject)
		projectsGroup.POST("", projCtrl.CreateProject)
		projectsGroup.PUT("/:id", projCtrl.UpdateProject)
		projectsGroup.DELETE("/:id", projCtrl.DeleteProject)
	}

	tasksGroup := router.Group("/tasks")
	tasksGroup.Use(middleware.AdminAuth())
	{
		tasksGroup.GET("", projCtrl.ListTasks)
		tasksGroup.GET("/options", projCtrl.TaskOptions)
		tasksGroup.GET("/:id", projCtrl.GetTask)
		tasksGroup.POST("", projCtrl.CreateTask)
		tasksGroup.PUT("/:id", projCtrl.UpdateTask)
		tasksGroup.DELETE("/:id", projCtrl.DeleteTask)
	}

	tsCtrl := controller.NewTimesheetController()
	timesheetsGroup := router.Group("/timesheets")
	timesheetsGroup.Use(middleware.AdminAuth())
	{
		timesheetsGroup.GET("", tsCtrl.List)
		timesheetsGroup.GET("/options", tsCtrl.Options)
		timesheetsGroup.GET("/:id", tsCtrl.Get)
		timesheetsGroup.POST("", tsCtrl.Create)
		timesheetsGroup.PUT("/:id", tsCtrl.Update)
		timesheetsGroup.POST("/:id/submit", tsCtrl.Submit)
		timesheetsGroup.POST("/:id/cancel", tsCtrl.Cancel)
		timesheetsGroup.DELETE("/:id", tsCtrl.Delete)
	}
}
