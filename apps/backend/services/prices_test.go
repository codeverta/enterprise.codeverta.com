package services

import (
	"gin-template/model"
	"testing"
	"time"

	"github.com/google/uuid"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

func setupPriceTestDB(t *testing.T) *gorm.DB {
	t.Helper()

	db, err := gorm.Open(sqlite.Open("file:"+uuid.NewString()+"?mode=memory&cache=shared"), &gorm.Config{})
	if err != nil {
		t.Fatalf("open sqlite: %v", err)
	}

	statements := []string{
		`CREATE TABLE events (
			id char(36) PRIMARY KEY,
			name text,
			is_active boolean,
			created_at datetime,
			updated_at datetime,
			deleted_at datetime
		)`,
		`CREATE TABLE ticket_categories (
			id char(36) PRIMARY KEY,
			event_id char(36),
			name text,
			distance_km real,
			requirements text,
			created_at datetime,
			updated_at datetime,
			tenant_id char(36),
			deleted_at datetime
		)`,
		`CREATE TABLE ticket_prices (
			id char(36) PRIMARY KEY,
			ticket_category_id char(36),
			price real,
			type text,
			quota integer,
			start_at datetime,
			end_at datetime,
			created_at datetime,
			updated_at datetime,
			tenant_id char(36),
			deleted_at datetime
		)`,
		`CREATE TABLE promo_codes (
			id char(36) PRIMARY KEY,
			code text,
			discount_type text,
			discount_value real,
			max_discount real,
			min_participants integer,
			quota integer,
			used_quota integer,
			start_at datetime,
			end_at datetime,
			is_active boolean,
			created_at datetime,
			updated_at datetime,
			tenant_id char(36),
			deleted_at datetime
		)`,
	}
	for _, statement := range statements {
		if err := db.Exec(statement).Error; err != nil {
			t.Fatalf("create table: %v", err)
		}
	}
	return db
}

func seedTicketPrice(t *testing.T, db *gorm.DB, activeEvent bool, quota int, startAt time.Time, endAt time.Time) (uuid.UUID, uuid.UUID) {
	t.Helper()

	eventID := uuid.New()
	categoryID := uuid.New()
	priceID := uuid.New()

	if err := db.Exec(`INSERT INTO events (id, name, is_active) VALUES (?, ?, ?)`, eventID.String(), "Race", activeEvent).Error; err != nil {
		t.Fatalf("insert event: %v", err)
	}
	if err := db.Exec(`INSERT INTO ticket_categories (id, event_id, name, distance_km) VALUES (?, ?, ?, ?)`, categoryID.String(), eventID.String(), "7K", 7).Error; err != nil {
		t.Fatalf("insert category: %v", err)
	}
	if err := db.Exec(
		`INSERT INTO ticket_prices (id, ticket_category_id, price, type, quota, start_at, end_at) VALUES (?, ?, ?, ?, ?, ?, ?)`,
		priceID.String(), categoryID.String(), 100000, string(model.PriceNormal), quota, startAt, endAt,
	).Error; err != nil {
		t.Fatalf("insert price: %v", err)
	}

	return priceID, categoryID
}

func seedPromo(t *testing.T, db *gorm.DB, code string, discountType model.DiscountType, value float64, maxDiscount float64, minParticipants int, quota int, usedQuota int, active bool, startAt time.Time, endAt time.Time) {
	t.Helper()

	if err := db.Exec(
		`INSERT INTO promo_codes (id, code, discount_type, discount_value, max_discount, min_participants, quota, used_quota, start_at, end_at, is_active) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		uuid.NewString(), code, string(discountType), value, maxDiscount, minParticipants, quota, usedQuota, startAt, endAt, active,
	).Error; err != nil {
		t.Fatalf("insert promo: %v", err)
	}
}

func TestCalculateBatchPriceAppliesPercentPromoWithMaxDiscount(t *testing.T) {
	db := setupPriceTestDB(t)
	now := time.Now().UTC()
	priceID, categoryID := seedTicketPrice(t, db, true, 10, now.Add(-time.Hour), now.Add(time.Hour))
	seedPromo(t, db, "DISC10", model.DiscountPercent, 10, 5000, 1, 10, 0, true, now.Add(-time.Hour), now.Add(time.Hour))

	res, err := CalculateBatchPrice(db, CheckPriceRequest{
		Tickets:   map[string]int{priceID.String(): 2},
		PromoCode: "DISC10",
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if res.OriginalTotal != 200000 {
		t.Fatalf("expected original total 200000, got %.0f", res.OriginalTotal)
	}
	if res.DiscountAmount != 10000 || res.FinalPrice != 190000 {
		t.Fatalf("unexpected discount/final: discount=%.0f final=%.0f", res.DiscountAmount, res.FinalPrice)
	}
	if !res.PromoApplied || res.PromoCode != "DISC10" {
		t.Fatalf("expected promo applied, got %+v", res)
	}
	if len(res.Items) != 1 || res.Items[0].CategoryID != categoryID.String() {
		t.Fatalf("unexpected item detail: %+v", res.Items)
	}
}

func TestCalculateBatchPriceRejectsUnavailableTickets(t *testing.T) {
	db := setupPriceTestDB(t)
	if _, err := CalculateBatchPrice(db, CheckPriceRequest{Tickets: map[string]int{uuid.NewString(): 1}}); err == nil {
		t.Fatal("expected unavailable ticket error")
	}
}

func TestCalculateBatchPriceRejectsInactiveEvent(t *testing.T) {
	db := setupPriceTestDB(t)
	now := time.Now().UTC()
	priceID, _ := seedTicketPrice(t, db, false, 10, now.Add(-time.Hour), now.Add(time.Hour))

	if _, err := CalculateBatchPrice(db, CheckPriceRequest{Tickets: map[string]int{priceID.String(): 1}}); err == nil {
		t.Fatal("expected inactive event to be unavailable")
	}
}

func TestCalculateBatchPriceRejectsTicketWindowAndQuotaEdges(t *testing.T) {
	now := time.Now().UTC()

	tests := []struct {
		name    string
		quota   int
		startAt time.Time
		endAt   time.Time
		count   int
	}{
		{"not started", 10, now.Add(time.Hour), now.Add(2 * time.Hour), 1},
		{"ended", 10, now.Add(-2 * time.Hour), now.Add(-time.Hour), 1},
		{"quota insufficient", 1, now.Add(-time.Hour), now.Add(time.Hour), 2},
	}

	for _, tt := range tests {
		db := setupPriceTestDB(t)
		priceID, _ := seedTicketPrice(t, db, true, tt.quota, tt.startAt, tt.endAt)
		if _, err := CalculateBatchPrice(db, CheckPriceRequest{Tickets: map[string]int{priceID.String(): tt.count}}); err == nil {
			t.Fatalf("%s: expected error", tt.name)
		}
	}
}

func TestCalculateBatchPriceRejectsPromoEdges(t *testing.T) {
	now := time.Now().UTC()

	tests := []struct {
		name            string
		code            string
		active          bool
		startAt         time.Time
		endAt           time.Time
		minParticipants int
		quota           int
		usedQuota       int
	}{
		{"inactive", "PROMO", false, now.Add(-time.Hour), now.Add(time.Hour), 1, 10, 0},
		{"not started", "PROMO", true, now.Add(time.Hour), now.Add(2 * time.Hour), 1, 10, 0},
		{"expired", "PROMO", true, now.Add(-2 * time.Hour), now.Add(-time.Hour), 1, 10, 0},
		{"min participants", "PROMO", true, now.Add(-time.Hour), now.Add(time.Hour), 2, 10, 0},
		{"quota insufficient", "PROMO", true, now.Add(-time.Hour), now.Add(time.Hour), 1, 1, 1},
	}

	for _, tt := range tests {
		db := setupPriceTestDB(t)
		priceID, _ := seedTicketPrice(t, db, true, 10, now.Add(-time.Hour), now.Add(time.Hour))
		seedPromo(t, db, tt.code, model.DiscountFixed, 10000, 0, tt.minParticipants, tt.quota, tt.usedQuota, tt.active, tt.startAt, tt.endAt)
		if _, err := CalculateBatchPrice(db, CheckPriceRequest{Tickets: map[string]int{priceID.String(): 1}, PromoCode: tt.code}); err == nil {
			t.Fatalf("%s: expected promo error", tt.name)
		}
	}
}
