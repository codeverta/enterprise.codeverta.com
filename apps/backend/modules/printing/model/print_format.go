package model

import "time"

type PrintFormat struct {
	ID                   string    `gorm:"primaryKey;size:64" json:"id"`
	TenantID             string    `gorm:"size:64;not null;uniqueIndex:idx_print_format_tenant_name" json:"tenant_id"`
	Name                 string    `gorm:"size:180;not null;uniqueIndex:idx_print_format_tenant_name" json:"name"`
	PrintFormatFor       string    `gorm:"size:20;not null;default:'DocType'" json:"print_format_for"`
	DocType              string    `gorm:"size:180;index" json:"doc_type"`
	Module               string    `gorm:"size:120;index" json:"module"`
	DefaultPrintLanguage string    `gorm:"size:32;default:'id'" json:"default_print_language"`
	CustomFormat         bool      `gorm:"default:false" json:"custom_format"`
	Disabled             bool      `gorm:"default:false;index" json:"disabled"`
	PDFGenerator         string    `gorm:"size:32;not null;default:'chrome'" json:"pdf_generator"`
	MarginTop            float64   `gorm:"type:decimal(10,2);default:15" json:"margin_top"`
	MarginBottom         float64   `gorm:"type:decimal(10,2);default:15" json:"margin_bottom"`
	MarginLeft           float64   `gorm:"type:decimal(10,2);default:15" json:"margin_left"`
	MarginRight          float64   `gorm:"type:decimal(10,2);default:15" json:"margin_right"`
	AlignLabelsRight     bool      `gorm:"default:false" json:"align_labels_right"`
	ShowSectionHeadings  bool      `gorm:"default:true" json:"show_section_headings"`
	LineBreaks           bool      `gorm:"default:false" json:"line_breaks"`
	Font                 string    `gorm:"size:120" json:"font"`
	PageNumber           string    `gorm:"size:32;default:'Hide'" json:"page_number"`
	CSS                  string    `gorm:"type:text" json:"css"`
	CreatedAt            time.Time `json:"created_at"`
	UpdatedAt            time.Time `json:"updated_at"`
}

func (PrintFormat) TableName() string { return "printing_print_formats" }
