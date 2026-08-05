package crm

import (
	"encoding/json"
	"testing"

	"gin-template/middleware"
	crmmodel "gin-template/model/crm"

	"github.com/google/uuid"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

func TestIngestWhatsAppMessageCreatesConversationAndUpdatesStatus(t *testing.T) {
	db, err := gorm.Open(sqlite.Open("file:crm_messaging?mode=memory&cache=shared"), &gorm.Config{})
	if err != nil {
		t.Fatal(err)
	}
	if err := crmmodel.Migrate(db); err != nil {
		t.Fatal(err)
	}
	middleware.RegisterTenantPlugin(db)
	tenantID := uuid.New()
	scoped := db.Set("tenant_id", tenantID.String())

	var payload metaMessagingWebhook
	if err := json.Unmarshal([]byte(`{
		"object":"whatsapp_business_account",
		"entry":[{"changes":[{"field":"messages","value":{
			"metadata":{"phone_number_id":"phone-1"},
			"contacts":[{"wa_id":"628123","profile":{"name":"Rabi"}}],
			"messages":[{"from":"628123","id":"wamid.inbound-1","timestamp":"1785862800","type":"text","text":{"body":"Halo CRM"}}]
		}}]}]
	}`), &payload); err != nil {
		t.Fatal(err)
	}

	received, updated := ingestMetaMessagingWebhook(scoped, payload)
	if received != 1 || updated != 0 {
		t.Fatalf("received=%d updated=%d", received, updated)
	}
	// Webhook retries must be idempotent.
	received, _ = ingestMetaMessagingWebhook(scoped, payload)
	if received != 0 {
		t.Fatalf("expected duplicate webhook to be ignored, received=%d", received)
	}

	var conversation crmmodel.Conversation
	if err := scoped.Session(&gorm.Session{}).First(&conversation).Error; err != nil {
		t.Fatal(err)
	}
	if conversation.Channel != "whatsapp" || conversation.ParticipantName != "Rabi" || conversation.UnreadCount != 1 {
		t.Fatalf("unexpected conversation: %#v", conversation)
	}
	var message crmmodel.Message
	if err := scoped.Session(&gorm.Session{}).First(&message).Error; err != nil {
		t.Fatal(err)
	}
	if message.Text != "Halo CRM" || message.Direction != "inbound" {
		t.Fatalf("unexpected message: %#v", message)
	}

	outbound := crmmodel.Message{ConversationID: conversation.ID, ExternalID: "wamid.outbound-1", Direction: "outbound", Type: "text", Text: "Halo juga", Status: "sent", SentAt: message.SentAt}
	if err := scoped.Session(&gorm.Session{}).Create(&outbound).Error; err != nil {
		t.Fatal(err)
	}
	if err := json.Unmarshal([]byte(`{"object":"whatsapp_business_account","entry":[{"changes":[{"field":"messages","value":{"statuses":[{"id":"wamid.outbound-1","status":"read","timestamp":"1785862810"}]}}]}]}`), &payload); err != nil {
		t.Fatal(err)
	}
	_, updated = ingestMetaMessagingWebhook(scoped, payload)
	if updated != 1 {
		t.Fatalf("expected status update, got %d", updated)
	}
	if err := scoped.Session(&gorm.Session{}).First(&outbound, "id = ?", outbound.ID).Error; err != nil {
		t.Fatal(err)
	}
	if outbound.Status != "read" {
		t.Fatalf("expected read status, got %s", outbound.Status)
	}
}
