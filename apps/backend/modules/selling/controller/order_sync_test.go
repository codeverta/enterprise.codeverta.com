package controller

import (
	"testing"
	"time"

	crmmodel "gin-template/model/crm"
	sellingmodel "gin-template/modules/selling/model"

	"github.com/google/uuid"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

func TestMarkStoreOrderPaidCreatesOneERPSalesOrder(t *testing.T) {
	db, err := gorm.Open(sqlite.Open("file:"+uuid.NewString()+"?mode=memory&cache=shared"), &gorm.Config{})
	if err != nil {
		t.Fatalf("open database: %v", err)
	}
	if err := db.AutoMigrate(
		&sellingmodel.StoreProduct{}, &sellingmodel.StoreOrder{}, &sellingmodel.StoreOrderItem{},
		&crmmodel.SalesOrder{}, &crmmodel.SalesOrderItem{},
	); err != nil {
		t.Fatalf("migrate database: %v", err)
	}

	tenantID := uuid.New()
	product := sellingmodel.StoreProduct{
		ID: "store-product-1", TenantID: tenantID.String(), CategoryID: "category-1",
		Name: "Serum", Slug: "serum", SKU: "SERUM-001", Brand: "Lumea", Price: 200000, Stock: 5, IsActive: true,
	}
	if err := db.Create(&product).Error; err != nil {
		t.Fatalf("create product: %v", err)
	}
	order := sellingmodel.StoreOrder{
		ID: "order-1", TenantID: tenantID.String(), UserID: "buyer-1", OrderNumber: "LUM-001",
		Status: "Menunggu Pembayaran", Subtotal: 400000, Shipping: 25000, Total: 425000,
		PaymentMethod: "XENDIT", PaymentProvider: "xendit", PaymentStatus: "PENDING",
		PaymentReference: "xendit-invoice-1", Address: "Jakarta", CreatedAt: time.Now(),
		Items: []sellingmodel.StoreOrderItem{{
			ID: "order-item-1", OrderID: "order-1", ProductID: product.ID, Name: product.Name,
			Brand: product.Brand, Price: product.Price, Quantity: 2, Subtotal: 400000,
		}},
	}
	if err := db.Create(&order).Error; err != nil {
		t.Fatalf("create store order: %v", err)
	}

	paidAt := time.Now()
	if err := MarkStoreOrderPaid(db, &order, paidAt); err != nil {
		t.Fatalf("mark first payment: %v", err)
	}
	if err := MarkStoreOrderPaid(db, &order, paidAt); err != nil {
		t.Fatalf("repeat payment callback: %v", err)
	}

	var salesOrders []crmmodel.SalesOrder
	if err := db.Preload("Items").Find(&salesOrders).Error; err != nil {
		t.Fatalf("load ERP sales orders: %v", err)
	}
	if len(salesOrders) != 1 {
		t.Fatalf("expected one ERP sales order, got %d", len(salesOrders))
	}
	got := salesOrders[0]
	if got.OrderNumber != order.OrderNumber || got.Status != "confirmed" || got.PaymentStatus != "PAID" {
		t.Fatalf("unexpected ERP sales order: %+v", got)
	}
	if got.PaymentMethod != "XENDIT" || got.PaymentProvider != "xendit" || got.PaymentReference != order.PaymentReference {
		t.Fatalf("unexpected ERP payment details: %+v", got)
	}
	if len(got.Items) != 1 || got.Items[0].ItemCode != product.SKU || got.Items[0].Quantity != 2 {
		t.Fatalf("unexpected ERP sales order items: %+v", got.Items)
	}

	// Opening an older Sales Order with missing detail rows must repair it from
	// the immutable storefront order instead of showing a blank item table.
	if err := db.Where("sales_order_id = ?", got.ID).Delete(&crmmodel.SalesOrderItem{}).Error; err != nil {
		t.Fatalf("remove projected items: %v", err)
	}
	if err := EnsureERPSalesOrder(db, &order, paidAt); err != nil {
		t.Fatalf("repair ERP sales order: %v", err)
	}
	var repaired crmmodel.SalesOrder
	if err := db.Preload("Items").First(&repaired, "id = ?", got.ID).Error; err != nil {
		t.Fatalf("load repaired order: %v", err)
	}
	if len(repaired.Items) != 1 || repaired.Items[0].ItemCode != product.SKU {
		t.Fatalf("expected projected items to be backfilled, got %+v", repaired.Items)
	}
}
