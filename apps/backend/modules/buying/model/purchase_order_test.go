package model

import (
	"testing"
	"time"
)

func TestPurchaseOrderCalculate(t *testing.T) {
	date := time.Date(2026, 8, 5, 0, 0, 0, 0, time.UTC)
	order := PurchaseOrder{
		ScheduleDate: date,
		SetWarehouse: "Main Warehouse",
		Items: []PurchaseOrderItem{
			{ItemCode: "LAPTOP", Quantity: 2, UOM: "Unit", Rate: 10_000_000},
			{ItemCode: "MOUSE", Quantity: 3, UOM: "Pcs", Rate: 250_000},
		},
		Taxes:           []PurchaseOrderTax{{ChargeType: "on_net_total", AccountHead: "PPN Masukan", Rate: 11}},
		ApplyDiscountOn: "grand_total", AdditionalDiscountPercentage: 5,
	}
	order.Calculate()
	if order.TotalQty != 5 || order.Total != 20_750_000 {
		t.Fatalf("unexpected item totals: qty=%v total=%v", order.TotalQty, order.Total)
	}
	if order.TotalTaxesAndCharges != 2_282_500 {
		t.Fatalf("unexpected taxes: %v", order.TotalTaxesAndCharges)
	}
	if order.AdditionalDiscountAmount != 1_151_625 || order.GrandTotal != 21_880_875 {
		t.Fatalf("unexpected discount/grand total: discount=%v grand=%v", order.AdditionalDiscountAmount, order.GrandTotal)
	}
	if order.Items[0].ScheduleDate != date || order.Items[0].TargetWarehouse != "Main Warehouse" {
		t.Fatal("expected schedule date and warehouse defaults to propagate to items")
	}
}

func TestPurchaseOrderActualTaxAndRoundedTotal(t *testing.T) {
	order := PurchaseOrder{
		DisableRoundedTotal: true,
		Items:               []PurchaseOrderItem{{ItemCode: "ITEM", Quantity: 1.5, UOM: "Kg", Rate: 10_000.25}},
		Taxes:               []PurchaseOrderTax{{ChargeType: "actual", AccountHead: "Freight", TaxAmount: 2_000.25}},
	}
	order.Calculate()
	if order.Total != 15_000.38 || order.GrandTotal != 17_000.63 || order.RoundedTotal != order.GrandTotal || order.RoundingAdjustment != 0 {
		t.Fatalf("unexpected totals: %#v", order)
	}
}
