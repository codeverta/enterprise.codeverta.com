package repository

import (
	"gorm.io/gorm"
)

type DashboardRepository interface {
}

type dashboardRepository struct {
	db *gorm.DB
}

func NewDashboardRepository(db *gorm.DB) DashboardRepository {
	return &dashboardRepository{db: db}
}
