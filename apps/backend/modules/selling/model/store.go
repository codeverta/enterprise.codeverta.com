package model

import "time"

type StoreCategory struct {
	ID          string    `gorm:"primaryKey;size:64" json:"id"`
	TenantID    string    `gorm:"size:64;not null;index;uniqueIndex:idx_store_category_tenant_slug" json:"tenant_id"`
	Name        string    `gorm:"size:120;not null" json:"name"`
	Slug        string    `gorm:"size:120;not null;index;uniqueIndex:idx_store_category_tenant_slug" json:"slug"`
	Description string    `gorm:"type:text" json:"description"`
	Image       string    `gorm:"type:text" json:"image"`
	SortOrder   int       `gorm:"default:0" json:"sort_order"`
	IsActive    bool      `gorm:"default:true;index" json:"is_active"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

type StoreProduct struct {
	ID             string        `gorm:"primaryKey;size:64" json:"id"`
	TenantID       string        `gorm:"size:64;not null;index;uniqueIndex:idx_store_product_tenant_slug" json:"tenant_id"`
	CategoryID     string        `gorm:"size:64;not null;index" json:"category_id"`
	Category       StoreCategory `gorm:"foreignKey:CategoryID" json:"category,omitempty"`
	Name           string        `gorm:"size:255;not null;index" json:"name"`
	Slug           string        `gorm:"size:255;not null;index;uniqueIndex:idx_store_product_tenant_slug" json:"slug"`
	SKU            string        `gorm:"size:100;not null;index" json:"sku"`
	Brand          string        `gorm:"size:150;not null;index" json:"brand"`
	Description    string        `gorm:"type:text" json:"description"`
	Ingredients    string        `gorm:"type:text" json:"ingredients"`
	HowToUse       string        `gorm:"type:text" json:"how_to_use"`
	Price          float64       `gorm:"type:decimal(16,2);not null" json:"price"`
	CompareAtPrice float64       `gorm:"type:decimal(16,2);default:0" json:"compare_at_price"`
	Badge          string        `gorm:"size:80" json:"badge"`
	Image          string        `gorm:"type:text" json:"image"`
	SecondaryImage string        `gorm:"type:text" json:"secondary_image"`
	Rating         float64       `gorm:"type:decimal(3,2);default:0" json:"rating"`
	ReviewCount    int           `gorm:"default:0" json:"review_count"`
	Stock          int           `gorm:"default:0" json:"stock"`
	IsFeatured     bool          `gorm:"default:false;index" json:"is_featured"`
	IsActive       bool          `gorm:"default:true;index" json:"is_active"`
	CreatedAt      time.Time     `json:"created_at"`
	UpdatedAt      time.Time     `json:"updated_at"`
}

type StoreCartItem struct {
	ID        string       `gorm:"primaryKey;size:64" json:"id"`
	TenantID  string       `gorm:"size:64;not null;index;uniqueIndex:idx_store_cart_user_product" json:"tenant_id"`
	UserID    string       `gorm:"size:64;not null;index;uniqueIndex:idx_store_cart_user_product" json:"user_id"`
	ProductID string       `gorm:"size:64;not null;index;uniqueIndex:idx_store_cart_user_product" json:"product_id"`
	Product   StoreProduct `gorm:"foreignKey:ProductID" json:"product"`
	Quantity  int          `gorm:"not null;default:1" json:"quantity"`
	CreatedAt time.Time    `json:"created_at"`
	UpdatedAt time.Time    `json:"updated_at"`
}

type StoreWishlistItem struct {
	ID        string       `gorm:"primaryKey;size:64" json:"id"`
	TenantID  string       `gorm:"size:64;not null;index;uniqueIndex:idx_store_wishlist_user_product" json:"tenant_id"`
	UserID    string       `gorm:"size:64;not null;index;uniqueIndex:idx_store_wishlist_user_product" json:"user_id"`
	ProductID string       `gorm:"size:64;not null;index;uniqueIndex:idx_store_wishlist_user_product" json:"product_id"`
	Product   StoreProduct `gorm:"foreignKey:ProductID" json:"product"`
	CreatedAt time.Time    `json:"created_at"`
}

type StoreOrder struct {
	ID               string           `gorm:"primaryKey;size:64" json:"id"`
	TenantID         string           `gorm:"size:64;not null;index" json:"tenant_id"`
	UserID           string           `gorm:"size:64;not null;index" json:"user_id"`
	OrderNumber      string           `gorm:"size:64;not null;uniqueIndex" json:"order_number"`
	Status           string           `gorm:"size:40;not null;index" json:"status"`
	Subtotal         float64          `gorm:"type:decimal(16,2);not null" json:"subtotal"`
	Shipping         float64          `gorm:"type:decimal(16,2);default:0" json:"shipping"`
	Total            float64          `gorm:"type:decimal(16,2);not null" json:"total"`
	PaymentMethod    string           `gorm:"size:100;not null" json:"payment_method"`
	PaymentProvider  string           `gorm:"size:40;not null;default:'';index" json:"payment_provider"`
	PaymentStatus    string           `gorm:"size:40;not null;default:'';index" json:"payment_status"`
	PaymentReference string           `gorm:"size:128;index" json:"payment_reference"`
	PaymentURL       string           `gorm:"type:text" json:"payment_url"`
	PaymentExpiresAt *time.Time       `json:"payment_expires_at"`
	PaidAt           *time.Time       `json:"paid_at"`
	Address          string           `gorm:"type:text;not null" json:"address"`
	Items            []StoreOrderItem `gorm:"foreignKey:OrderID;constraint:OnDelete:CASCADE" json:"items"`
	CreatedAt        time.Time        `json:"created_at"`
	UpdatedAt        time.Time        `json:"updated_at"`
}

type StoreOrderItem struct {
	ID        string  `gorm:"primaryKey;size:64" json:"id"`
	OrderID   string  `gorm:"size:64;not null;index" json:"order_id"`
	ProductID string  `gorm:"size:64;not null;index" json:"product_id"`
	Name      string  `gorm:"size:255;not null" json:"name"`
	Brand     string  `gorm:"size:150;not null" json:"brand"`
	Image     string  `gorm:"type:text" json:"image"`
	Price     float64 `gorm:"type:decimal(16,2);not null" json:"price"`
	Quantity  int     `gorm:"not null" json:"quantity"`
	Subtotal  float64 `gorm:"type:decimal(16,2);not null" json:"subtotal"`
}
