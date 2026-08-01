package dto

import (
	"time"

	"github.com/google/uuid"
)

type UpgradeDowngradeReq struct {
	ParticipantID uuid.UUID `json:"participant_id" binding:"required"`
	NewCategoryID uuid.UUID `json:"new_category_id" binding:"required"`
	NewPriceID    uuid.UUID `json:"new_price_id" binding:"required"`
	IsUpgrade     bool      `json:"is_upgrade"`
}

type TransferBibReq struct {
	ParticipantID     uuid.UUID `json:"participant_id" binding:"required"`
	FirstName         string    `json:"first_name" binding:"required"`
	LastName          string    `json:"last_name" binding:"required"`
	Email             string    `json:"email" binding:"required,email"`
	PhoneNumber       string    `json:"phone_number" binding:"required"`
	IdType            string    `json:"id_type" binding:"required"`
	IdNumber          string    `json:"id_number" binding:"required"`
	DateOfBirth       time.Time `json:"date_of_birth" binding:"required"`
	Gender            string    `json:"gender" binding:"required"`
	Address           string    `json:"address" binding:"required"`
	JerseySize        string    `json:"jersey_size" binding:"required"`
	EmergencyName     string    `json:"emergency_name" binding:"required"`
	EmergencyNumber   string    `json:"emergency_number" binding:"required"`
	EmergencyRelation string    `json:"emergency_relation" binding:"required"`
}

type ScanRacepackReq struct {
	Code string `json:"code" binding:"required"`
}
