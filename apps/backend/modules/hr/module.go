package hrmodule

import (
	"gin-template/modules/hr/controller"

	"github.com/gin-gonic/gin"
)

func RegisterRoutes(parent *gin.RouterGroup) {
	payrollHandler := controller.NewPayrollEntryController()
	attendanceHandler := controller.NewAttendanceController()

	hr := parent.Group("/hr")
	{
		hr.GET("/payroll-entries/options", payrollHandler.Options)
		hr.GET("/payroll-entries", payrollHandler.List)
		hr.POST("/payroll-entries", payrollHandler.Create)
		hr.GET("/payroll-entries/:id", payrollHandler.Get)
		hr.PUT("/payroll-entries/:id", payrollHandler.Update)
		hr.DELETE("/payroll-entries/:id", payrollHandler.Delete)
		hr.POST("/payroll-entries/:id/get-employees", payrollHandler.GetEmployees)
		hr.POST("/payroll-entries/:id/submit", payrollHandler.Submit)

		// Attendance & Device Checkin endpoints
		hr.GET("/attendances/options", attendanceHandler.Options)
		hr.GET("/attendances/stats", attendanceHandler.Stats)
		hr.GET("/attendances", attendanceHandler.List)
		hr.POST("/attendances", attendanceHandler.Create)
		hr.GET("/attendances/:id", attendanceHandler.Get)
		hr.PUT("/attendances/:id", attendanceHandler.Update)
		hr.DELETE("/attendances/:id", attendanceHandler.Delete)
		hr.POST("/attendances/mark-bulk", attendanceHandler.MarkBulk)
		hr.POST("/checkins/scan", attendanceHandler.ProcessScan)
		hr.GET("/checkins", attendanceHandler.Checkins)

		// Employee Onboarding endpoints
		onboardingHandler := controller.NewEmployeeOnboardingController()
		hr.GET("/employee-onboardings/options", onboardingHandler.Options)
		hr.GET("/employee-onboardings", onboardingHandler.List)
		hr.POST("/employee-onboardings", onboardingHandler.Create)
		hr.GET("/employee-onboardings/:id", onboardingHandler.Get)
		hr.PUT("/employee-onboardings/:id", onboardingHandler.Update)
		hr.DELETE("/employee-onboardings/:id", onboardingHandler.Delete)
		hr.POST("/employee-onboardings/:id/activities/:activity_id/toggle", onboardingHandler.ToggleActivity)
		hr.POST("/employee-onboardings/:id/create-employee", onboardingHandler.CreateEmployee)
	}
}
