package services

import (
	"testing"
	"time"
)

func TestCalculateDynamicExpiry(t *testing.T) {
	duration, total, err := CalculateDynamicExpiry(map[string]int{"ticket-a": 1, "ticket-b": 2})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if total != 3 {
		t.Fatalf("expected total 3, got %d", total)
	}
	if duration != 18*time.Minute {
		t.Fatalf("expected 18 minutes, got %s", duration)
	}
}

func TestCalculateDynamicExpiryCapsAtThirtyMinutes(t *testing.T) {
	duration, total, err := CalculateDynamicExpiry(map[string]int{"ticket-a": 20})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if total != 20 {
		t.Fatalf("expected total 20, got %d", total)
	}
	if duration != 30*time.Minute {
		t.Fatalf("expected cap at 30 minutes, got %s", duration)
	}
}

func TestCalculateDynamicExpiryRejectsInvalidSelections(t *testing.T) {
	tests := map[string]map[string]int{
		"none":       {},
		"zero":       {"ticket-a": 0},
		"negative":   {"ticket-a": -1},
		"over limit": {"ticket-a": 21},
	}

	for name, tickets := range tests {
		if _, _, err := CalculateDynamicExpiry(tickets); err == nil {
			t.Fatalf("%s: expected error", name)
		}
	}
}
