package model

import "testing"

func TestPurchaseInvoiceCalculateTaxesDiscountAndPayment(t *testing.T) {
	invoice := PurchaseInvoice{
		IsPaid:                       true,
		ApplyDiscountOn:              "grand_total",
		AdditionalDiscountPercentage: 10,
		Items: []PurchaseInvoiceItem{
			{AcceptedQty: 2, Rate: 100_000},
			{AcceptedQty: 1, Rate: 50_000},
		},
		Taxes: []PurchaseInvoiceTax{
			{AddDeduct: "add", ChargeType: "on_net_total", Rate: 11},
			{AddDeduct: "deduct", ChargeType: "actual", TaxAmount: 5_000},
		},
	}

	invoice.Calculate()

	if invoice.TotalQty != 3 || invoice.Total != 250_000 {
		t.Fatalf("unexpected item totals: qty=%v total=%v", invoice.TotalQty, invoice.Total)
	}
	if invoice.TaxesAndChargesAdded != 27_500 || invoice.TaxesAndChargesDeducted != 5_000 || invoice.TotalTaxesAndCharges != 22_500 {
		t.Fatalf("unexpected taxes: added=%v deducted=%v total=%v", invoice.TaxesAndChargesAdded, invoice.TaxesAndChargesDeducted, invoice.TotalTaxesAndCharges)
	}
	if invoice.AdditionalDiscountAmount != 27_250 || invoice.GrandTotal != 245_250 || invoice.RoundedTotal != 245_250 {
		t.Fatalf("unexpected grand totals: discount=%v grand=%v rounded=%v", invoice.AdditionalDiscountAmount, invoice.GrandTotal, invoice.RoundedTotal)
	}
	if invoice.PaidAmount != 245_250 {
		t.Fatalf("expected paid amount to follow rounded total, got %v", invoice.PaidAmount)
	}
}

func TestPurchaseInvoiceCalculateDebitNote(t *testing.T) {
	invoice := PurchaseInvoice{
		IsReturn:        true,
		ApplyDiscountOn: "net_total",
		Items:           []PurchaseInvoiceItem{{AcceptedQty: 1, Rate: 100_000}},
		Taxes:           []PurchaseInvoiceTax{{AddDeduct: "add", ChargeType: "on_net_total", Rate: 11}},
	}

	invoice.Calculate()

	if invoice.Total != -100_000 || invoice.Taxes[0].TaxAmount != -11_000 || invoice.GrandTotal != -111_000 {
		t.Fatalf("unexpected debit note values: total=%v tax=%v grand=%v", invoice.Total, invoice.Taxes[0].TaxAmount, invoice.GrandTotal)
	}
}
