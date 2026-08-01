package crm

import (
	"encoding/json"
	"testing"

	crmmodel "gin-template/model/crm"

	"github.com/google/uuid"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

func TestParseTikTokWebhookLeads(t *testing.T) {
	body := []byte(`{"data":{"lead_id":"tt-123","full_name":"Siti","email":"siti@example.com","campaign_name":"Launch","ttclid":"click-1"}}`)
	leads, err := parseTikTokWebhookLeads(body)
	if err != nil {
		t.Fatal(err)
	}
	if len(leads) != 1 || leads[0].ExternalID != "tt-123" || leads[0].Source != "tiktok_ads" || leads[0].UTMCampaign != "Launch" {
		t.Fatalf("unexpected parsed leads: %#v", leads)
	}
}

func TestPrepareLeadScoresAndAssignsRoundRobin(t *testing.T) {
	db, err := gorm.Open(sqlite.Open("file:crm_lead_automation?mode=memory&cache=shared"), &gorm.Config{})
	if err != nil {
		t.Fatal(err)
	}
	if err := crmmodel.Migrate(db); err != nil {
		t.Fatal(err)
	}
	tenantID := uuid.New()
	repA, repB := uuid.New(), uuid.New()
	reps, _ := json.Marshal([]uuid.UUID{repA, repB})
	config := crmmodel.LeadAutomationConfig{AssignmentMethod: "round_robin", SalesRepIDs: reps, CaptureEnabled: true, LastAssigned: -1}
	scoped := db.Set("tenant_id", tenantID.String())
	if err := scoped.Create(&config).Error; err != nil {
		t.Fatal(err)
	}

	first := crmmodel.Lead{Name: "First", Email: "first@example.com", Phone: "+62812", CompanyName: "Acme", Source: "referral"}
	if err := prepareLead(scoped, &first); err != nil {
		t.Fatal(err)
	}
	if first.Score != 70 {
		t.Fatalf("expected score 70, got %d", first.Score)
	}
	if first.AssignedTo == nil || *first.AssignedTo != repA {
		t.Fatalf("expected first rep %s, got %v", repA, first.AssignedTo)
	}

	second := crmmodel.Lead{Name: "Second", Source: "website"}
	if err := prepareLead(scoped, &second); err != nil {
		t.Fatal(err)
	}
	if second.AssignedTo == nil || *second.AssignedTo != repB {
		t.Fatalf("expected second rep %s, got %v", repB, second.AssignedTo)
	}
}

func TestCalculateLeadScoreCapsAtOneHundred(t *testing.T) {
	lead := crmmodel.Lead{
		Email: "lead@example.com", Phone: "+62812", CompanyName: "Acme", ProductInterest: "ERP",
		Source: "referral", UTMSource: "meta",
	}
	if score := calculateLeadScore(&lead, map[string]int{"email": 90}); score != 100 {
		t.Fatalf("expected capped score 100, got %d", score)
	}
}
