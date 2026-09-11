package model

import "time"

type GLEntry struct {
	ID                            string    `gorm:"primaryKey;size:64" json:"id"`
	TenantID                      string    `gorm:"size:64;not null;index" json:"tenant_id"`
	PostingDate                   time.Time `json:"posting_date"`
	FiscalYear                    string    `gorm:"size:16;index" json:"fiscal_year"`
	Account                       string    `gorm:"size:220;not null;index" json:"account"`
	AccountCurrency               string    `gorm:"size:10;default:'IDR'" json:"account_currency"`
	Against                       string    `gorm:"size:220;index" json:"against"`
	VoucherType                   string    `gorm:"size:80;not null;index" json:"voucher_type"`
	VoucherNo                     string    `gorm:"size:120;not null;index" json:"voucher_no"`
	VoucherSubtype                string    `gorm:"size:80" json:"voucher_subtype"`
	TransactionCurrency           string    `gorm:"size:10;default:'IDR'" json:"transaction_currency"`
	TransactionExchangeRate       float64   `gorm:"type:decimal(18,6);default:1" json:"transaction_exchange_rate"`
	ReportingCurrencyExchangeRate float64   `gorm:"type:decimal(18,6);default:1" json:"reporting_currency_exchange_rate"`

	DebitInAccountCurrency     float64 `gorm:"type:decimal(20,2);default:0" json:"debit_in_account_currency"`
	Debit                      float64 `gorm:"type:decimal(20,2);default:0" json:"debit"`
	DebitInTransactionCurrency float64 `gorm:"type:decimal(20,2);default:0" json:"debit_in_transaction_currency"`
	DebitInReportingCurrency   float64 `gorm:"type:decimal(20,2);default:0" json:"debit_in_reporting_currency"`

	CreditInAccountCurrency     float64 `gorm:"type:decimal(20,2);default:0" json:"credit_in_account_currency"`
	Credit                      float64 `gorm:"type:decimal(20,2);default:0" json:"credit"`
	CreditInTransactionCurrency float64 `gorm:"type:decimal(20,2);default:0" json:"credit_in_transaction_currency"`
	CreditInReportingCurrency   float64 `gorm:"type:decimal(20,2);default:0" json:"credit_in_reporting_currency"`

	CostCenter string `gorm:"size:180;index" json:"cost_center"`
	Project    string `gorm:"size:180;index" json:"project"`
	Company    string `gorm:"size:180;not null;index" json:"company"`

	IsOpening   bool `gorm:"default:false" json:"is_opening"`
	IsAdvance   bool `gorm:"default:false" json:"is_advance"`
	IsCancelled bool `gorm:"default:false;index" json:"is_cancelled"`

	Remarks string `gorm:"type:text" json:"remarks"`
	Comment string `gorm:"type:text" json:"comment"`

	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

func (GLEntry) TableName() string {
	return "accounting_gl_entries"
}
