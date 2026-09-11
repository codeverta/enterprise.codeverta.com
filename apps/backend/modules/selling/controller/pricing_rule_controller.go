package controller

import (
	"errors"
	"fmt"
	"net/http"
	"strings"

	"gin-template/model"
	sellingmodel "gin-template/modules/selling/model"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

type PricingRuleController struct{}

func NewPricingRuleController() *PricingRuleController {
	return &PricingRuleController{}
}

func pricingRuleDB(ctx *gin.Context) *gorm.DB {
	return model.GetDB(ctx).WithContext(ctx.Request.Context())
}

func pricingRuleTenant(ctx *gin.Context) string {
	return strings.TrimSpace(ctx.GetString("tenant_id"))
}

type PricingRuleItemInput struct {
	ItemCode  string `json:"item_code"`
	ItemGroup string `json:"item_group"`
	Brand     string `json:"brand"`
	UOM       string `json:"uom"`
}

type PricingRuleInput struct {
	NamingSeries              string                 `json:"naming_series"`
	Title                     string                 `json:"title"`
	Disable                   bool                   `json:"disable"`
	ApplyOn                   string                 `json:"apply_on"`
	PriceOrProductDiscount    string                 `json:"price_or_product_discount"`
	Warehouse                 string                 `json:"warehouse"`
	MixedConditions           bool                   `json:"mixed_conditions"`
	IsCumulative              bool                   `json:"is_cumulative"`
	CouponCodeBased           bool                   `json:"coupon_code_based"`
	Selling                   bool                   `json:"selling"`
	Buying                    bool                   `json:"buying"`
	ApplicableFor             string                 `json:"applicable_for"`
	Party                     string                 `json:"party"`
	MinQty                    float64                `json:"min_qty"`
	MaxQty                    float64                `json:"max_qty"`
	MinAmt                    float64                `json:"min_amt"`
	MaxAmt                    float64                `json:"max_amt"`
	ValidFrom                 interface{}            `json:"valid_from"`
	ValidUpto                 interface{}            `json:"valid_upto"`
	Company                   string                 `json:"company"`
	Currency                  string                 `json:"currency"`
	MarginType                string                 `json:"margin_type"`
	MarginRateOrAmount        float64                `json:"margin_rate_or_amount"`
	RateOrDiscount            string                 `json:"rate_or_discount"`
	Rate                      float64                `json:"rate"`
	DiscountPercentage        float64                `json:"discount_percentage"`
	DiscountAmount            float64                `json:"discount_amount"`
	ForPriceList              string                 `json:"for_price_list"`
	Condition                 string                 `json:"condition"`
	ApplyMultiplePricingRules bool                   `json:"apply_multiple_pricing_rules"`
	ThresholdPercentage       float64                `json:"threshold_percentage"`
	ValidateAppliedRule       bool                   `json:"validate_applied_rule"`
	HasPriority               bool                   `json:"has_priority"`
	Priority                  int                    `json:"priority"`
	Items                     []PricingRuleItemInput `json:"items"`
}

func (ctrl *PricingRuleController) ListPricingRules(ctx *gin.Context) {
	db, tenant := pricingRuleDB(ctx), pricingRuleTenant(ctx)
	query := db.Where("tenant_id = ? OR tenant_id = '' OR tenant_id IS NULL", tenant)

	if search := strings.TrimSpace(ctx.Query("q")); search != "" {
		like := "%" + search + "%"
		query = query.Where("title LIKE ? OR id LIKE ? OR party LIKE ? OR apply_on LIKE ?", like, like, like, like)
	}
	if applyOn := strings.TrimSpace(ctx.Query("apply_on")); applyOn != "" && applyOn != "ALL" {
		query = query.Where("apply_on = ?", applyOn)
	}
	if disableStr := strings.TrimSpace(ctx.Query("disable")); disableStr != "" {
		if disableStr == "true" || disableStr == "1" {
			query = query.Where("disable = ?", true)
		} else if disableStr == "false" || disableStr == "0" {
			query = query.Where("disable = ?", false)
		}
	}

	var rules []sellingmodel.PricingRule
	if err := query.Preload("Items").Order("priority desc, created_at desc").Find(&rules).Error; err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal mengambil Pricing Rule"})
		return
	}
	ctx.JSON(http.StatusOK, gin.H{"data": rules})
}

func (ctrl *PricingRuleController) GetPricingRule(ctx *gin.Context) {
	db, tenant, id := pricingRuleDB(ctx), pricingRuleTenant(ctx), ctx.Param("id")
	var rule sellingmodel.PricingRule
	if err := db.Where("(tenant_id = ? OR tenant_id = '' OR tenant_id IS NULL) AND id = ?", tenant, id).
		Preload("Items").First(&rule).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			ctx.JSON(http.StatusNotFound, gin.H{"error": "Pricing Rule tidak ditemukan"})
			return
		}
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal mengambil Pricing Rule"})
		return
	}
	ctx.JSON(http.StatusOK, rule)
}

func (ctrl *PricingRuleController) CreatePricingRule(ctx *gin.Context) {
	var input PricingRuleInput
	if err := ctx.ShouldBindJSON(&input); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "Data Pricing Rule tidak valid: " + err.Error()})
		return
	}
	if strings.TrimSpace(input.Title) == "" {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "Title wajib diisi"})
		return
	}

	db, tenant := pricingRuleDB(ctx), pricingRuleTenant(ctx)

	// Generate Naming Series ID e.g. PRLE-0001
	var count int64
	db.Model(&sellingmodel.PricingRule{}).Where("tenant_id = ? OR tenant_id = '' OR tenant_id IS NULL", tenant).Count(&count)
	generatedID := fmt.Sprintf("PRLE-%04d", count+1)

	// Ensure uniqueness if existing
	var existing sellingmodel.PricingRule
	if err := db.Where("(tenant_id = ? OR tenant_id = '' OR tenant_id IS NULL) AND id = ?", tenant, generatedID).First(&existing).Error; err == nil {
		generatedID = fmt.Sprintf("PRLE-%s", uuid.NewString()[:8])
	}

	if input.NamingSeries == "" {
		input.NamingSeries = "PRLE-.####"
	}
	if input.ApplyOn == "" {
		input.ApplyOn = "Item Code"
	}
	if input.PriceOrProductDiscount == "" {
		input.PriceOrProductDiscount = "Price"
	}
	if input.RateOrDiscount == "" {
		input.RateOrDiscount = "Discount Percentage"
	}
	if input.Currency == "" {
		input.Currency = "IDR"
	}

	rule := sellingmodel.PricingRule{
		ID:                        generatedID,
		TenantID:                  tenant,
		NamingSeries:              input.NamingSeries,
		Title:                     strings.TrimSpace(input.Title),
		Disable:                   input.Disable,
		ApplyOn:                   input.ApplyOn,
		PriceOrProductDiscount:    input.PriceOrProductDiscount,
		Warehouse:                 strings.TrimSpace(input.Warehouse),
		MixedConditions:           input.MixedConditions,
		IsCumulative:              input.IsCumulative,
		CouponCodeBased:           input.CouponCodeBased,
		Selling:                   input.Selling,
		Buying:                    input.Buying,
		ApplicableFor:             input.ApplicableFor,
		Party:                     strings.TrimSpace(input.Party),
		MinQty:                    input.MinQty,
		MaxQty:                    input.MaxQty,
		MinAmt:                    input.MinAmt,
		MaxAmt:                    input.MaxAmt,
		ValidFrom:                 parseFlexibleDate(input.ValidFrom),
		ValidUpto:                 parseFlexibleDate(input.ValidUpto),
		Company:                   strings.TrimSpace(input.Company),
		Currency:                  strings.TrimSpace(input.Currency),
		MarginType:                strings.TrimSpace(input.MarginType),
		MarginRateOrAmount:        input.MarginRateOrAmount,
		RateOrDiscount:            input.RateOrDiscount,
		Rate:                      input.Rate,
		DiscountPercentage:        input.DiscountPercentage,
		DiscountAmount:            input.DiscountAmount,
		ForPriceList:              strings.TrimSpace(input.ForPriceList),
		Condition:                 strings.TrimSpace(input.Condition),
		ApplyMultiplePricingRules: input.ApplyMultiplePricingRules,
		ThresholdPercentage:       input.ThresholdPercentage,
		ValidateAppliedRule:       input.ValidateAppliedRule,
		HasPriority:               input.HasPriority,
		Priority:                  input.Priority,
	}

	for _, itm := range input.Items {
		if strings.TrimSpace(itm.ItemCode) != "" || strings.TrimSpace(itm.ItemGroup) != "" || strings.TrimSpace(itm.Brand) != "" {
			rule.Items = append(rule.Items, sellingmodel.PricingRuleItem{
				ID:            "pri-" + uuid.NewString()[:8],
				PricingRuleID: rule.ID,
				ItemCode:      strings.TrimSpace(itm.ItemCode),
				ItemGroup:     strings.TrimSpace(itm.ItemGroup),
				Brand:         strings.TrimSpace(itm.Brand),
				UOM:           strings.TrimSpace(itm.UOM),
			})
		}
	}

	if err := db.Create(&rule).Error; err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal membuat Pricing Rule: " + err.Error()})
		return
	}

	ctx.JSON(http.StatusCreated, rule)
}

func (ctrl *PricingRuleController) UpdatePricingRule(ctx *gin.Context) {
	id := ctx.Param("id")
	var input PricingRuleInput
	if err := ctx.ShouldBindJSON(&input); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "Data Pricing Rule tidak valid: " + err.Error()})
		return
	}
	if strings.TrimSpace(input.Title) == "" {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "Title wajib diisi"})
		return
	}

	db, tenant := pricingRuleDB(ctx), pricingRuleTenant(ctx)
	var existing sellingmodel.PricingRule
	if err := db.Where("(tenant_id = ? OR tenant_id = '' OR tenant_id IS NULL) AND id = ?", tenant, id).First(&existing).Error; err != nil {
		ctx.JSON(http.StatusNotFound, gin.H{"error": "Pricing Rule tidak ditemukan"})
		return
	}

	existing.Title = strings.TrimSpace(input.Title)
	existing.Disable = input.Disable
	existing.ApplyOn = input.ApplyOn
	existing.PriceOrProductDiscount = input.PriceOrProductDiscount
	existing.Warehouse = strings.TrimSpace(input.Warehouse)
	existing.MixedConditions = input.MixedConditions
	existing.IsCumulative = input.IsCumulative
	existing.CouponCodeBased = input.CouponCodeBased
	existing.Selling = input.Selling
	existing.Buying = input.Buying
	existing.ApplicableFor = input.ApplicableFor
	existing.Party = strings.TrimSpace(input.Party)
	existing.MinQty = input.MinQty
	existing.MaxQty = input.MaxQty
	existing.MinAmt = input.MinAmt
	existing.MaxAmt = input.MaxAmt
	existing.ValidFrom = parseFlexibleDate(input.ValidFrom)
	existing.ValidUpto = parseFlexibleDate(input.ValidUpto)
	existing.Company = strings.TrimSpace(input.Company)
	existing.Currency = strings.TrimSpace(input.Currency)
	existing.MarginType = strings.TrimSpace(input.MarginType)
	existing.MarginRateOrAmount = input.MarginRateOrAmount
	existing.RateOrDiscount = input.RateOrDiscount
	existing.Rate = input.Rate
	existing.DiscountPercentage = input.DiscountPercentage
	existing.DiscountAmount = input.DiscountAmount
	existing.ForPriceList = strings.TrimSpace(input.ForPriceList)
	existing.Condition = strings.TrimSpace(input.Condition)
	existing.ApplyMultiplePricingRules = input.ApplyMultiplePricingRules
	existing.ThresholdPercentage = input.ThresholdPercentage
	existing.ValidateAppliedRule = input.ValidateAppliedRule
	existing.HasPriority = input.HasPriority
	existing.Priority = input.Priority

	// Replace child items
	_ = db.Where("pricing_rule_id = ?", existing.ID).Delete(&sellingmodel.PricingRuleItem{})
	var newItems []sellingmodel.PricingRuleItem
	for _, itm := range input.Items {
		if strings.TrimSpace(itm.ItemCode) != "" || strings.TrimSpace(itm.ItemGroup) != "" || strings.TrimSpace(itm.Brand) != "" {
			newItems = append(newItems, sellingmodel.PricingRuleItem{
				ID:            "pri-" + uuid.NewString()[:8],
				PricingRuleID: existing.ID,
				ItemCode:      strings.TrimSpace(itm.ItemCode),
				ItemGroup:     strings.TrimSpace(itm.ItemGroup),
				Brand:         strings.TrimSpace(itm.Brand),
				UOM:           strings.TrimSpace(itm.UOM),
			})
		}
	}
	existing.Items = newItems

	if err := db.Save(&existing).Error; err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal memperbarui Pricing Rule: " + err.Error()})
		return
	}
	ctx.JSON(http.StatusOK, existing)
}

func (ctrl *PricingRuleController) DeletePricingRule(ctx *gin.Context) {
	db, tenant, id := pricingRuleDB(ctx), pricingRuleTenant(ctx), ctx.Param("id")
	_ = db.Where("pricing_rule_id = ?", id).Delete(&sellingmodel.PricingRuleItem{})
	if err := db.Where("(tenant_id = ? OR tenant_id = '' OR tenant_id IS NULL) AND id = ?", tenant, id).Delete(&sellingmodel.PricingRule{}).Error; err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal menghapus Pricing Rule"})
		return
	}
	ctx.JSON(http.StatusOK, gin.H{"message": "Pricing Rule terhapus"})
}
