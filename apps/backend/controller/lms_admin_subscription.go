package controller

import (
	"errors"
	"gin-template/model"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

type moveSubscriptionPlanRequest struct {
	PlanID uuid.UUID `json:"plan_id" binding:"required"`
}

// MoveSubscriptionPlan immediately changes the plan used to scope a student's access.
// Billing history and the current subscription period are intentionally preserved.
func (ctrl *LMSController) MoveSubscriptionPlan(c *gin.Context) {
	subscriptionID, ok := parseUUIDParam(c, "id")
	if !ok {
		return
	}

	var payload moveSubscriptionPlanRequest
	if err := c.ShouldBindJSON(&payload); err != nil || payload.PlanID == uuid.Nil {
		sendBadRequest(c, ErrInvalidParameters, nil)
		return
	}

	db := lmsDB(c, ctrl.DB).WithContext(c)
	var updated model.Subscription
	var targetPlan model.SubscriptionPlan
	err := db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).
			First(&updated, "id = ?", subscriptionID).Error; err != nil {
			return err
		}
		if err := tx.First(&targetPlan, "id = ? AND is_active = ?", payload.PlanID, true).Error; err != nil {
			return err
		}

		updates := ClearPendingSubscriptionChange()
		updates["plan_id"] = targetPlan.ID
		updates["provider_plan_id"] = targetPlan.ID.String()
		updates["course_id"] = nil
		updates["amount"] = targetPlan.Amount
		updates["currency"] = defaultCurrency(targetPlan.Currency)
		updates["interval"] = defaultInterval(targetPlan.Interval)
		updates["cancel_at_period_end"] = false
		updates["canceled_at"] = nil

		if err := tx.Model(&updated).Updates(updates).Error; err != nil {
			return err
		}
		return tx.First(&updated, "id = ?", subscriptionID).Error
	})
	if errors.Is(err, gorm.ErrRecordNotFound) {
		sendError(c, http.StatusNotFound, "Subscription atau paket tujuan tidak ditemukan", nil)
		return
	}
	if err != nil {
		sendInternalError(c, err)
		return
	}

	result := enrichSubscriptions(db, []model.Subscription{updated})
	sendSuccess(c, result[0], "Paket subscription berhasil dipindahkan")
}
