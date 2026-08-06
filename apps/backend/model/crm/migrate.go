package crm

import (
	"fmt"

	"gorm.io/gorm"
)

// Migrate owns the CRM schema independently from the core ERP model list.
func Migrate(db *gorm.DB) error {
	models := []interface{}{
		&Account{}, &Contact{}, &PipelineStage{}, &Opportunity{}, &Lead{},
		&Activity{}, &Product{}, &Quotation{}, &QuotationItem{}, &SalesOrder{}, &SalesOrderItem{},
		&Invoice{}, &Ticket{}, &TicketComment{}, &Campaign{}, &CampaignMember{},
		&Note{}, &Attachment{}, &Tag{}, &Taggable{},
		&LeadAutomationConfig{}, &Integration{}, &Conversation{}, &Message{},
	}
	if err := db.AutoMigrate(models...); err != nil {
		return fmt.Errorf("auto migrate CRM models: %w", err)
	}
	indexes := []struct {
		model   interface{}
		name    string
		columns string
	}{
		{&PipelineStage{}, "idx_crm_stage_tenant_name", "tenant_id, name"},
		{&Product{}, "idx_crm_product_tenant_sku", "tenant_id, sku"},
		{&Quotation{}, "idx_crm_quote_tenant_number", "tenant_id, quote_number"},
		{&SalesOrder{}, "idx_crm_order_tenant_number", "tenant_id, order_number"},
		{&SalesOrder{}, "idx_crm_order_tenant_store", "tenant_id, store_order_id"},
		{&Invoice{}, "idx_crm_invoice_tenant_number", "tenant_id, invoice_number"},
		{&Tag{}, "idx_crm_tag_tenant_name", "tenant_id, name"},
		{&Taggable{}, "idx_crm_taggable_unique", "tenant_id, tag_id, related_to_type, related_to_id"},
		{&LeadAutomationConfig{}, "idx_crm_automation_tenant", "tenant_id"},
		{&Integration{}, "idx_crm_integration_tenant_provider", "tenant_id, provider"},
		{&Conversation{}, "idx_crm_conversation_external", "tenant_id, channel, external_account_id, external_participant_id"},
		{&Message{}, "idx_crm_message_external", "tenant_id, external_id"},
	}
	for _, index := range indexes {
		if db.Migrator().HasIndex(index.model, index.name) {
			continue
		}
		table, err := tableName(db, index.model)
		if err != nil {
			return err
		}
		statement := fmt.Sprintf("CREATE UNIQUE INDEX %s ON %s (%s)", index.name, table, index.columns)
		if err := db.Exec(statement).Error; err != nil {
			return fmt.Errorf("create CRM index %s: %w", index.name, err)
		}
	}
	return nil
}

func tableName(db *gorm.DB, value interface{}) (string, error) {
	statement := &gorm.Statement{DB: db}
	if err := statement.Parse(value); err != nil {
		return "", fmt.Errorf("resolve CRM table: %w", err)
	}
	return statement.Schema.Table, nil
}
