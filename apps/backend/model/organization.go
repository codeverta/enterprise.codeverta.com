package model

import (
	"fmt"
	"gin-template/common"
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// ResolveActiveCompanyName resolves a company default from the current user's
// preference without relying on an installation-specific company name.
func ResolveActiveCompanyName(db *gorm.DB, rawUserID interface{}) string {
	var userID uuid.UUID
	switch value := rawUserID.(type) {
	case uuid.UUID:
		userID = value
	case string:
		userID, _ = uuid.Parse(value)
	}
	if userID != uuid.Nil {
		var preference UserAppPreference
		if db.Where("user_id = ?", userID).First(&preference).Error == nil && preference.ActiveCompanyID != nil {
			var preferred Company
			if db.Where("id = ? AND is_active = ?", *preference.ActiveCompanyID, true).First(&preferred).Error == nil {
				return preferred.Name
			}
		}
	}
	var first Company
	if db.Where("is_active = ?", true).Order("name asc").First(&first).Error == nil {
		return first.Name
	}
	return ""
}

type Organization struct {
	ID           uuid.UUID      `json:"id" gorm:"type:char(36);primaryKey"`
	Name         string         `json:"name" gorm:"type:varchar(200);not null"`
	Slug         string         `json:"slug" gorm:"type:varchar(100);not null;uniqueIndex"`
	LogoURL      string         `json:"logo_url" gorm:"type:text"`
	Description  string         `json:"description" gorm:"type:text"`
	ContactEmail string         `json:"contact_email" gorm:"type:varchar(200)"`
	ContactPhone string         `json:"contact_phone" gorm:"type:varchar(50)"`
	IsActive     bool           `json:"is_active" gorm:"default:true"`
	CreatedAt    time.Time      `json:"created_at" gorm:"autoCreateTime"`
	UpdatedAt    time.Time      `json:"updated_at" gorm:"autoUpdateTime"`
	DeletedAt    gorm.DeletedAt `json:"deleted_at" gorm:"index"`

	TenantID uuid.UUID `json:"tenant_id" gorm:"type:char(36);not null;index"`
	Tenant   Tenant    `json:"-" gorm:"foreignKey:TenantID;constraint:OnUpdate:CASCADE,OnDelete:RESTRICT;"`
}

func (o *Organization) BeforeCreate(tx *gorm.DB) error {
	if o.ID == uuid.Nil {
		o.ID = uuid.New()
	}
	if o.TenantID == uuid.Nil {
		if tenant, ok := tx.Statement.Context.Value(common.CtxTenantKey).(Tenant); ok {
			o.TenantID = tenant.ID
		} else {
			return fmt.Errorf("tenant_id is required for security isolation")
		}
	}
	return nil
}

// Company represents an enterprise corporate entity (Multi-Company)
type Company struct {
	ID              uuid.UUID      `json:"id" gorm:"type:char(36);primaryKey"`
	Name            string         `json:"name" gorm:"type:varchar(200);not null"`
	Abbreviation    string         `json:"abbreviation" gorm:"type:varchar(50);not null"`
	Abbr            string         `json:"abbr,omitempty" gorm:"-"`
	TaxID           string         `json:"tax_id" gorm:"type:varchar(100)"` // NPWP / Tax Registration
	Domain          string         `json:"domain" gorm:"type:varchar(200)"`
	Email           string         `json:"email" gorm:"type:varchar(200)"`
	Phone           string         `json:"phone" gorm:"type:varchar(50)"`
	Address         string         `json:"address" gorm:"type:text"`
	Currency        string         `json:"currency" gorm:"type:varchar(10);default:'IDR'"`
	DefaultCurrency string         `json:"default_currency,omitempty" gorm:"-"`
	IsGroup         bool           `json:"is_group" gorm:"default:false"`
	ParentCompanyID *uuid.UUID     `json:"parent_company_id" gorm:"type:char(36)"`
	IsActive        bool           `json:"is_active" gorm:"default:true"`
	CreatedAt       time.Time      `json:"created_at" gorm:"autoCreateTime"`
	UpdatedAt       time.Time      `json:"updated_at" gorm:"autoUpdateTime"`
	DeletedAt       gorm.DeletedAt `json:"deleted_at" gorm:"index"`

	TenantID uuid.UUID `json:"tenant_id" gorm:"type:char(36);not null;index"`
	Tenant   Tenant    `json:"-" gorm:"foreignKey:TenantID;constraint:OnUpdate:CASCADE,OnDelete:RESTRICT;"`

	// Details tab extra fields
	Country             string `json:"country" gorm:"type:varchar(100)"`
	DefaultHolidayList  string `json:"default_holiday_list" gorm:"type:varchar(150)"`
	DefaultLetterHead   string `json:"default_letter_head" gorm:"type:varchar(150)"`
	DateOfEstablishment string `json:"date_of_establishment" gorm:"type:varchar(50)"`
	ParentCompany       string `json:"parent_company" gorm:"type:varchar(200)"`
	ReportingCurrency   string `json:"reporting_currency" gorm:"type:varchar(10);default:'IDR'"`
	DateOfIncorporation string `json:"date_of_incorporation" gorm:"type:varchar(50)"`
	PhoneNo             string `json:"phone_no" gorm:"type:varchar(50)"`
	CompanyDescription  string `json:"company_description" gorm:"type:text"`
	Fax                 string `json:"fax" gorm:"type:varchar(50)"`
	Website             string `json:"website" gorm:"type:varchar(200)"`
	RegistrationDetails string `json:"registration_details" gorm:"type:text"`

	// Accounts tab
	CreateChartOfAccountsBasedOn              string `json:"create_chart_of_accounts_based_on" gorm:"type:varchar(100);default:'Standard Template'"`
	ChartOfAccounts                           string `json:"chart_of_accounts" gorm:"type:varchar(150)"`
	DefaultBankAccount                        string `json:"default_bank_account" gorm:"type:varchar(150)"`
	DefaultCashAccount                        string `json:"default_cash_account" gorm:"type:varchar(150)"`
	DefaultReceivableAccount                  string `json:"default_receivable_account" gorm:"type:varchar(150)"`
	DefaultPayableAccount                     string `json:"default_payable_account" gorm:"type:varchar(150)"`
	WriteOffAccount                           string `json:"write_off_account" gorm:"type:varchar(150)"`
	UnrealizedProfitLossAccount               string `json:"unrealized_profit_loss_account" gorm:"type:varchar(150)"`
	DefaultExpenseAccount                     string `json:"default_expense_account" gorm:"type:varchar(150)"`
	DefaultIncomeAccount                      string `json:"default_income_account" gorm:"type:varchar(150)"`
	DefaultDiscountAccount                    string `json:"default_discount_account" gorm:"type:varchar(150)"`
	PaymentTerms                              string `json:"payment_terms" gorm:"type:varchar(150)"`
	CostCenter                                string `json:"cost_center" gorm:"type:varchar(150)"`
	DefaultFinanceBook                        string `json:"default_finance_book" gorm:"type:varchar(150)"`
	ExchangeGainLossAccount                   string `json:"exchange_gain_loss_account" gorm:"type:varchar(150)"`
	UnrealizedExchangeGainLossAccount         string `json:"unrealized_exchange_gain_loss_account" gorm:"type:varchar(150)"`
	RoundOffAccount                           string `json:"round_off_account" gorm:"type:varchar(150)"`
	RoundOffCostCenter                        string `json:"round_off_cost_center" gorm:"type:varchar(150)"`
	RoundOffForOpening                        string `json:"round_off_for_opening" gorm:"type:varchar(150)"`
	DefaultDeferredRevenueAccount             string `json:"default_deferred_revenue_account" gorm:"type:varchar(150)"`
	DefaultDeferredExpenseAccount             string `json:"default_deferred_expense_account" gorm:"type:varchar(150)"`
	BookAdvancePaymentsInSeparatePartyAccount bool   `json:"book_advance_payments_in_separate_party_account" gorm:"default:false"`
	ReconciliationTakesEffectOn               string `json:"reconciliation_takes_effect_on" gorm:"type:varchar(100);default:'Advance Payment Date'"`
	AutoExchangeRateRevaluation               bool   `json:"auto_exchange_rate_revaluation" gorm:"default:false"`
	AutoErrFrequency                          string `json:"auto_err_frequency" gorm:"type:varchar(50);default:'Monthly'"`
	SubmitErrJv                               bool   `json:"submit_err_jv" gorm:"default:false"`
	ExceptionBudgetApproverRole               string `json:"exception_budget_approver_role" gorm:"type:varchar(100)"`
	AccumulatedDepreciationAccount            string `json:"accumulated_depreciation_account" gorm:"type:varchar(150)"`
	DepreciationExpenseAccount                string `json:"depreciation_expense_account" gorm:"type:varchar(150)"`
	SeriesForDepreciationEntry                string `json:"series_for_depreciation_entry" gorm:"type:varchar(100)"`
	DisposalAccount                           string `json:"disposal_account" gorm:"type:varchar(150)"`
	DepreciationCostCenter                    string `json:"depreciation_cost_center" gorm:"type:varchar(150)"`
	CapitalWorkInProgressAccount              string `json:"capital_work_in_progress_account" gorm:"type:varchar(150)"`
	AssetReceivedButNotBilled                 string `json:"asset_received_but_not_billed" gorm:"type:varchar(150)"`

	// Accounts Closing tab
	AccountsFrozenTillDate string `json:"accounts_frozen_till_date" gorm:"type:varchar(50)"`
	FrozenAccountsModifier string `json:"frozen_accounts_modifier" gorm:"type:varchar(100)"`

	// Buying and Selling tab
	DefaultBuyingTerms             string  `json:"default_buying_terms" gorm:"type:varchar(150)"`
	MonthlySalesTarget             float64 `json:"monthly_sales_target" gorm:"type:decimal(20,2);default:0"`
	TotalMonthlySales              float64 `json:"total_monthly_sales" gorm:"type:decimal(20,2);default:0"`
	DefaultSellingTerms            string  `json:"default_selling_terms" gorm:"type:varchar(150)"`
	DefaultSalesContact            string  `json:"default_sales_contact" gorm:"type:varchar(150)"`
	DefaultWarehouseForSalesReturn string  `json:"default_warehouse_for_sales_return" gorm:"type:varchar(150)"`
	CreditLimit                    float64 `json:"credit_limit" gorm:"type:decimal(20,2);default:0"`
	PurchaseExpenseAccount         string  `json:"purchase_expense_account" gorm:"type:varchar(150)"`
	ServiceExpenseAccount          string  `json:"service_expense_account" gorm:"type:varchar(150)"`
	PurchaseExpenseContraAccount   string  `json:"purchase_expense_contra_account" gorm:"type:varchar(150)"`

	// Stock and Manufacturing tab
	EnablePerpetualInventory                    bool   `json:"enable_perpetual_inventory" gorm:"default:true"`
	EnableItemWiseInventoryAccount              bool   `json:"enable_item_wise_inventory_account" gorm:"default:false"`
	EnableProvisionalAccountingForNonStockItems bool   `json:"enable_provisional_accounting_for_non_stock_items" gorm:"default:false"`
	DefaultInventoryAccount                     string `json:"default_inventory_account" gorm:"type:varchar(150)"`
	ValuationMethod                             string `json:"valuation_method" gorm:"type:varchar(50);default:'FIFO'"`
	StockAdjustmentAccount                      string `json:"stock_adjustment_account" gorm:"type:varchar(150)"`
	StockReceivedButNotBilled                   string `json:"stock_received_but_not_billed" gorm:"type:varchar(150)"`
	DefaultProvisionalAccount                   string `json:"default_provisional_account" gorm:"type:varchar(150)"`
	DefaultInTransitWarehouse                   string `json:"default_in_transit_warehouse" gorm:"type:varchar(150)"`
	DefaultOperatingCostAccount                 string `json:"default_operating_cost_account" gorm:"type:varchar(150)"`
	DefaultWIPWarehouse                         string `json:"default_wip_warehouse" gorm:"type:varchar(150)"`
	DefaultFGWarehouse                          string `json:"default_fg_warehouse" gorm:"type:varchar(150)"`
	DefaultScrapWarehouse                       string `json:"default_scrap_warehouse" gorm:"type:varchar(150)"`
}

func (c *Company) BeforeSave(tx *gorm.DB) error {
	if c.Abbreviation == "" && c.Abbr != "" {
		c.Abbreviation = c.Abbr
	}
	if c.Currency == "" && c.DefaultCurrency != "" {
		c.Currency = c.DefaultCurrency
	}
	return nil
}

func (c *Company) AfterFind(tx *gorm.DB) error {
	c.Abbr = c.Abbreviation
	c.DefaultCurrency = c.Currency
	return nil
}

func (c *Company) BeforeCreate(tx *gorm.DB) error {
	if c.ID == uuid.Nil {
		c.ID = uuid.New()
	}
	if c.TenantID == uuid.Nil {
		if tenant, ok := tx.Statement.Context.Value(common.CtxTenantKey).(Tenant); ok {
			c.TenantID = tenant.ID
		}
	}
	if c.Abbreviation == "" && c.Abbr != "" {
		c.Abbreviation = c.Abbr
	}
	if c.Currency == "" && c.DefaultCurrency != "" {
		c.Currency = c.DefaultCurrency
	}
	return nil
}

// Branch represents an operational office location / branch of a company (Multi-Branch)
type Branch struct {
	ID         uuid.UUID      `json:"id" gorm:"type:char(36);primaryKey"`
	CompanyID  uuid.UUID      `json:"company_id" gorm:"type:char(36);not null;index"`
	Company    *Company       `json:"company,omitempty" gorm:"foreignKey:CompanyID;constraint:OnUpdate:CASCADE,OnDelete:RESTRICT;"`
	Name       string         `json:"name" gorm:"type:varchar(200);not null"`
	BranchCode string         `json:"branch_code" gorm:"type:varchar(50)"`
	Address    string         `json:"address" gorm:"type:text"`
	Phone      string         `json:"phone" gorm:"type:varchar(50)"`
	Email      string         `json:"email" gorm:"type:varchar(200)"`
	IsActive   bool           `json:"is_active" gorm:"default:true"`
	CreatedAt  time.Time      `json:"created_at" gorm:"autoCreateTime"`
	UpdatedAt  time.Time      `json:"updated_at" gorm:"autoUpdateTime"`
	DeletedAt  gorm.DeletedAt `json:"deleted_at" gorm:"index"`

	TenantID uuid.UUID `json:"tenant_id" gorm:"type:char(36);not null;index"`
	Tenant   Tenant    `json:"-" gorm:"foreignKey:TenantID;constraint:OnUpdate:CASCADE,OnDelete:RESTRICT;"`
}

func (b *Branch) BeforeCreate(tx *gorm.DB) error {
	if b.ID == uuid.Nil {
		b.ID = uuid.New()
	}
	if b.TenantID == uuid.Nil {
		if tenant, ok := tx.Statement.Context.Value(common.CtxTenantKey).(Tenant); ok {
			b.TenantID = tenant.ID
		}
	}
	return nil
}

// Department represents a department unit within a company/branch (Multi-Department with Parent-Child Tree)
type Department struct {
	ID                 uuid.UUID      `json:"id" gorm:"type:char(36);primaryKey"`
	CompanyID          *uuid.UUID     `json:"company_id" gorm:"type:char(36);index"`
	Company            *Company       `json:"company,omitempty" gorm:"foreignKey:CompanyID;constraint:OnUpdate:CASCADE,OnDelete:SET NULL;"`
	BranchID           *uuid.UUID     `json:"branch_id" gorm:"type:char(36);index"`
	Branch             *Branch        `json:"branch,omitempty" gorm:"foreignKey:BranchID;constraint:OnUpdate:CASCADE,OnDelete:SET NULL;"`
	Name               string         `json:"name" gorm:"type:varchar(200);not null"`
	DepartmentCode     string         `json:"department_code" gorm:"type:varchar(50)"`
	ParentDepartmentID *uuid.UUID     `json:"parent_department_id" gorm:"type:char(36);index"`
	ParentDepartment   *Department    `json:"parent_department,omitempty" gorm:"foreignKey:ParentDepartmentID;constraint:OnUpdate:CASCADE,OnDelete:SET NULL;"`
	IsGroup            bool           `json:"is_group" gorm:"default:false"`
	IsActive           bool           `json:"is_active" gorm:"default:true"`
	CreatedAt          time.Time      `json:"created_at" gorm:"autoCreateTime"`
	UpdatedAt          time.Time      `json:"updated_at" gorm:"autoUpdateTime"`
	DeletedAt          gorm.DeletedAt `json:"deleted_at" gorm:"index"`

	TenantID uuid.UUID `json:"tenant_id" gorm:"type:char(36);not null;index"`
	Tenant   Tenant    `json:"-" gorm:"foreignKey:TenantID;constraint:OnUpdate:CASCADE,OnDelete:RESTRICT;"`
}

func (d *Department) BeforeCreate(tx *gorm.DB) error {
	if d.ID == uuid.Nil {
		d.ID = uuid.New()
	}
	if d.TenantID == uuid.Nil {
		if tenant, ok := tx.Statement.Context.Value(common.CtxTenantKey).(Tenant); ok {
			d.TenantID = tenant.ID
		}
	}
	return nil
}

// LetterHead represents official corporate headers and footers for PDF documents
type LetterHead struct {
	ID         uuid.UUID      `json:"id" gorm:"type:char(36);primaryKey"`
	CompanyID  *uuid.UUID     `json:"company_id" gorm:"type:char(36);index"`
	Company    *Company       `json:"company,omitempty" gorm:"foreignKey:CompanyID;constraint:OnUpdate:CASCADE,OnDelete:SET NULL;"`
	Name       string         `json:"name" gorm:"type:varchar(200);not null"`
	HeaderHTML string         `json:"header_html" gorm:"type:text"`
	FooterHTML string         `json:"footer_html" gorm:"type:text"`
	LogoURL    string         `json:"logo_url" gorm:"type:text"`
	IsDefault  bool           `json:"is_default" gorm:"default:false"`
	IsActive   bool           `json:"is_active" gorm:"default:true"`
	CreatedAt  time.Time      `json:"created_at" gorm:"autoCreateTime"`
	UpdatedAt  time.Time      `json:"updated_at" gorm:"autoUpdateTime"`
	DeletedAt  gorm.DeletedAt `json:"deleted_at" gorm:"index"`

	TenantID uuid.UUID `json:"tenant_id" gorm:"type:char(36);not null;index"`
	Tenant   Tenant    `json:"-" gorm:"foreignKey:TenantID;constraint:OnUpdate:CASCADE,OnDelete:RESTRICT;"`
}

func (lh *LetterHead) BeforeCreate(tx *gorm.DB) error {
	if lh.ID == uuid.Nil {
		lh.ID = uuid.New()
	}
	if lh.TenantID == uuid.Nil {
		if tenant, ok := tx.Statement.Context.Value(common.CtxTenantKey).(Tenant); ok {
			lh.TenantID = tenant.ID
		}
	}
	return nil
}
