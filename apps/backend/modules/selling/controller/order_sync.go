package controller

import (
	"errors"
	"strings"
	"time"

	coremodel "gin-template/model"
	crmmodel "gin-template/model/crm"
	sellingmodel "gin-template/modules/selling/model"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// MarkStoreOrderPaid records a successful payment and creates the ERP Sales
// Order in one transaction. Calling it repeatedly is safe: StoreOrderID is the
// stable bridge between the storefront order and the ERP document.
func MarkStoreOrderPaid(db *gorm.DB, order *sellingmodel.StoreOrder, paidAt time.Time) error {
	return db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Model(order).Updates(map[string]interface{}{
			"status":         "Diproses",
			"payment_status": "PAID",
			"paid_at":        &paidAt,
		}).Error; err != nil {
			return err
		}
		order.Status = "Diproses"
		order.PaymentStatus = "PAID"
		order.PaidAt = &paidAt
		return ensureERPSalesOrder(tx, order, paidAt)
	})
}

func ensureERPSalesOrder(db *gorm.DB, order *sellingmodel.StoreOrder, paidAt time.Time) error {
	tenantID, err := uuid.Parse(strings.TrimSpace(order.TenantID))
	if err != nil || tenantID == uuid.Nil {
		return errors.New("store order has an invalid tenant_id")
	}

	var existing crmmodel.SalesOrder
	err = db.Where("tenant_id = ? AND store_order_id = ?", tenantID, order.ID).First(&existing).Error
	if err == nil {
		return db.Model(&existing).Updates(map[string]interface{}{
			"payment_status":    "PAID",
			"payment_reference": order.PaymentReference,
			"paid_at":           &paidAt,
		}).Error
	}
	if !errors.Is(err, gorm.ErrRecordNotFound) {
		return err
	}

	if len(order.Items) == 0 {
		if err := db.Where("order_id = ?", order.ID).Find(&order.Items).Error; err != nil {
			return err
		}
	}

	customer, customerEmail := order.UserID, ""
	if userID, parseErr := uuid.Parse(order.UserID); parseErr == nil {
		var user coremodel.User
		if findErr := db.First(&user, "id = ?", userID).Error; findErr == nil {
			customerEmail = user.Email
			if strings.TrimSpace(user.DisplayName) != "" {
				customer = user.DisplayName
			} else if customerEmail != "" {
				customer = customerEmail
			}
		}
	}

	productIDs := make([]string, 0, len(order.Items))
	for _, item := range order.Items {
		productIDs = append(productIDs, item.ProductID)
	}
	var products []sellingmodel.StoreProduct
	if len(productIDs) > 0 {
		_ = db.Where("tenant_id = ? AND id IN ?", order.TenantID, productIDs).Find(&products).Error
	}
	skuByProduct := make(map[string]string, len(products))
	for _, product := range products {
		skuByProduct[product.ID] = product.SKU
	}

	salesOrderID := uuid.New()
	storeOrderID := order.ID
	transactionDate := order.CreatedAt
	if transactionDate.IsZero() {
		transactionDate = paidAt
	}
	salesOrder := crmmodel.SalesOrder{
		Base:             crmmodel.Base{ID: salesOrderID, TenantID: tenantID},
		StoreOrderID:     &storeOrderID,
		OrderNumber:      order.OrderNumber,
		Customer:         customer,
		CustomerEmail:    customerEmail,
		ShippingAddress:  order.Address,
		TransactionDate:  transactionDate,
		Currency:         "IDR",
		Subtotal:         order.Subtotal,
		ShippingAmount:   order.Shipping,
		TotalAmount:      order.Total,
		PaymentStatus:    "PAID",
		PaymentReference: order.PaymentReference,
		PaidAt:           &paidAt,
		Status:           "confirmed",
	}
	for _, item := range order.Items {
		itemCode := strings.TrimSpace(skuByProduct[item.ProductID])
		if itemCode == "" {
			itemCode = item.ProductID
		}
		salesOrder.Items = append(salesOrder.Items, crmmodel.SalesOrderItem{
			Base:         crmmodel.Base{TenantID: tenantID},
			SalesOrderID: salesOrderID,
			ProductID:    item.ProductID,
			ItemCode:     itemCode,
			ItemName:     item.Name,
			Quantity:     item.Quantity,
			Rate:         item.Price,
			Amount:       item.Subtotal,
		})
	}
	return db.Create(&salesOrder).Error
}
