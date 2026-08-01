package services

import (
	"fmt"
	"time"
)

func CalculateDynamicExpiry(tickets map[string]int) (time.Duration, int, error) {
	total := 0
	for _, count := range tickets {
		if count < 0 {
			return 0, 0, fmt.Errorf("invalid ticket count")
		}
		total += count
	}

	// Validasi Maksimal 20 Tiket
	if total > 20 {
		return 0, 0, fmt.Errorf("maximum 20 tickets allowed per reservation")
	}
	if total <= 0 {
		return 0, 0, fmt.Errorf("please select at least 1 ticket")
	}

	// Logika Durasi: 10 menit s/id 25 menit
	// Base 10 menit + 1 menit per tiket tambahan
	minutes := 10 + ((total * 3) - 1)

	if minutes > 30 {
		minutes = 30
	}

	return time.Duration(minutes) * time.Minute, total, nil
}
