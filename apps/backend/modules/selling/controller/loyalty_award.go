package controller

import (
	"math"
	"strings"
	"time"

	sellingmodel "gin-template/modules/selling/model"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type LoyaltyAwardInput struct {
	TenantID       string
	Customer       string
	Company        string
	Reference      string
	ReferenceType  string
	PurchaseAmount float64
	PostingDate    time.Time
	Program        string
}

// AwardLoyaltyPoints creates one earned entry for a successful sale. It is
// intentionally idempotent so retries from POS and document submission cannot
// award the same transaction twice.
func AwardLoyaltyPoints(db *gorm.DB, input LoyaltyAwardInput) (*sellingmodel.LoyaltyPointEntry, error) {
	input.TenantID = strings.TrimSpace(input.TenantID)
	input.Customer = strings.TrimSpace(input.Customer)
	input.Company = strings.TrimSpace(input.Company)
	input.Reference = strings.TrimSpace(input.Reference)
	input.Program = strings.TrimSpace(input.Program)
	if input.ReferenceType == "" {
		input.ReferenceType = "Sales Invoice"
	}
	if input.Customer == "" || input.Reference == "" || input.PurchaseAmount <= 0 {
		return nil, nil
	}
	if input.PostingDate.IsZero() {
		input.PostingDate = time.Now()
	}

	var existing sellingmodel.LoyaltyPointEntry
	err := db.Where(
		"tenant_id = ? AND sales_invoice = ? AND type = ?",
		input.TenantID, input.Reference, "Earned",
	).First(&existing).Error
	if err == nil {
		return &existing, nil
	}
	if err != nil && err != gorm.ErrRecordNotFound {
		return nil, err
	}

	var customer sellingmodel.Customer
	if err := db.Where("tenant_id = ? AND customer_name = ? AND disabled = ?", input.TenantID, input.Customer, false).
		First(&customer).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, nil
		}
		return nil, err
	}

	var programs []sellingmodel.LoyaltyProgram
	query := db.Preload("CollectionRules").Where("tenant_id = ?", input.TenantID)
	if input.Program != "" {
		query = query.Where("loyalty_program_name = ?", input.Program)
	} else {
		query = query.Where("auto_opt_in = ?", true)
	}
	if err := query.Order("created_at asc").Find(&programs).Error; err != nil {
		return nil, err
	}

	var selected *sellingmodel.LoyaltyProgram
	bestScore := -1
	for index := range programs {
		program := &programs[index]
		if !programActiveOn(program, input.PostingDate) ||
			!scopeMatches(program.CustomerGroup, customer.CustomerGroup, "All Customer Groups") ||
			!scopeMatches(program.CustomerTerritory, customer.Territory, "All Territories") ||
			(input.Company != "" && program.Company != "" && !strings.EqualFold(program.Company, input.Company)) {
			continue
		}
		score := scopeSpecificity(program.CustomerGroup, "All Customer Groups") +
			scopeSpecificity(program.CustomerTerritory, "All Territories")
		if program.Company != "" {
			score++
		}
		if score > bestScore {
			selected, bestScore = program, score
		}
	}
	if selected == nil || len(selected.CollectionRules) == 0 {
		return nil, nil
	}

	var priorSpent float64
	if err := db.Model(&sellingmodel.LoyaltyPointEntry{}).
		Where("tenant_id = ? AND customer = ? AND loyalty_program = ? AND type = ?", input.TenantID, input.Customer, selected.LoyaltyProgramName, "Earned").
		Select("COALESCE(SUM(purchase_amount), 0)").Scan(&priorSpent).Error; err != nil {
		return nil, err
	}
	totalSpent := priorSpent + input.PurchaseAmount
	collectionFactor := 0.0
	selectedMinimum := -1.0
	for _, rule := range selected.CollectionRules {
		if rule.CollectionFactor > 0 && rule.MinSpent <= totalSpent && rule.MinSpent >= selectedMinimum {
			collectionFactor = rule.CollectionFactor
			selectedMinimum = rule.MinSpent
		}
	}
	if collectionFactor <= 0 {
		return nil, nil
	}
	points := math.Floor(input.PurchaseAmount / collectionFactor)
	if points <= 0 {
		return nil, nil
	}

	var expiryDate *time.Time
	if selected.ExpiryDuration > 0 {
		expires := input.PostingDate.AddDate(0, 0, selected.ExpiryDuration)
		expiryDate = &expires
	}
	entry := sellingmodel.LoyaltyPointEntry{
		ID:             "LPE-" + input.PostingDate.Format("2006") + "-" + strings.ToUpper(uuid.NewString()[:8]),
		TenantID:       input.TenantID,
		LoyaltyProgram: selected.LoyaltyProgramName,
		Customer:       input.Customer,
		SalesInvoice:   input.Reference,
		ReferenceType:  input.ReferenceType,
		LoyaltyPoints:  points,
		PurchaseAmount: input.PurchaseAmount,
		ExpiryDate:     expiryDate,
		PostingDate:    input.PostingDate,
		Type:           "Earned",
		CreatedAt:      time.Now(),
	}
	if err := db.Create(&entry).Error; err != nil {
		return nil, err
	}
	return &entry, nil
}

func programActiveOn(program *sellingmodel.LoyaltyProgram, date time.Time) bool {
	if program.FromDate != nil && date.Before(startOfDay(*program.FromDate)) {
		return false
	}
	if program.ToDate != nil && date.After(endOfDay(*program.ToDate)) {
		return false
	}
	return true
}

func scopeMatches(programValue, customerValue, allValue string) bool {
	programValue = strings.TrimSpace(programValue)
	return programValue == "" || strings.EqualFold(programValue, allValue) || strings.EqualFold(programValue, strings.TrimSpace(customerValue))
}

func scopeSpecificity(value, allValue string) int {
	value = strings.TrimSpace(value)
	if value == "" || strings.EqualFold(value, allValue) {
		return 0
	}
	return 1
}

func startOfDay(value time.Time) time.Time {
	year, month, day := value.Date()
	return time.Date(year, month, day, 0, 0, 0, 0, value.Location())
}

func endOfDay(value time.Time) time.Time {
	return startOfDay(value).Add(24*time.Hour - time.Nanosecond)
}
