package controller

import (
	"errors"
	"fmt"
	"net/http"
	"regexp"
	"strings"
	"time"

	"gin-template/common"
	"gin-template/model"
	sellingmodel "gin-template/modules/selling/model"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

type StoreController struct{}

func NewStoreController() *StoreController { return &StoreController{} }

type storeRegisterInput struct {
	FullName string `json:"full_name"`
	Email    string `json:"email"`
	Password string `json:"password"`
}

func (ctrl *StoreController) Register(ctx *gin.Context) {
	var input storeRegisterInput
	if err := ctx.ShouldBindJSON(&input); err != nil {
		storeError(ctx, http.StatusBadRequest, "Data pendaftaran tidak valid")
		return
	}
	input.FullName = strings.TrimSpace(input.FullName)
	input.Email = strings.ToLower(strings.TrimSpace(input.Email))
	if input.FullName == "" || !strings.Contains(input.Email, "@") || len(input.Password) < 8 {
		storeError(ctx, http.StatusBadRequest, "Nama, email valid, dan kata sandi minimal 8 karakter wajib diisi")
		return
	}
	db := storeDB(ctx)
	var count int64
	if err := db.Model(&model.User{}).Where("email = ?", input.Email).Count(&count).Error; err != nil {
		storeError(ctx, http.StatusInternalServerError, "Gagal memeriksa akun buyer")
		return
	}
	if count > 0 {
		storeError(ctx, http.StatusConflict, "Email sudah terdaftar. Silakan masuk.")
		return
	}
	passwordHash, err := common.Password2Hash(input.Password)
	if err != nil {
		storeError(ctx, http.StatusInternalServerError, "Gagal mengamankan kata sandi")
		return
	}
	usernameBase := storeIDCleaner.ReplaceAllString(strings.ToLower(strings.Split(input.Email, "@")[0]), "")
	if len(usernameBase) > 7 {
		usernameBase = usernameBase[:7]
	}
	if usernameBase == "" {
		usernameBase = "buyer"
	}
	user := model.User{
		Username: usernameBase + uuid.NewString()[:5], Password: passwordHash, DisplayName: input.FullName,
		Email: input.Email, Role: common.RoleCommonUser, Status: common.UserStatusEnabled,
	}
	if err := db.Create(&user).Error; err != nil {
		storeError(ctx, http.StatusInternalServerError, "Gagal membuat akun buyer")
		return
	}
	ctx.JSON(http.StatusCreated, gin.H{"success": true, "data": gin.H{"id": user.ID, "email": user.Email, "full_name": user.DisplayName}})
}

func storeDB(ctx *gin.Context) *gorm.DB { return model.GetDB(ctx).WithContext(ctx.Request.Context()) }

func storeTenant(ctx *gin.Context) string { return strings.TrimSpace(ctx.GetString("tenant_id")) }

func storeUserID(ctx *gin.Context) (string, bool) {
	value := strings.TrimSpace(ctx.GetString("id"))
	if value == "" {
		ctx.JSON(http.StatusUnauthorized, gin.H{"success": false, "message": "Silakan masuk terlebih dahulu"})
		return "", false
	}
	return value, true
}

func storeSuccess(ctx *gin.Context, data interface{}) {
	ctx.JSON(http.StatusOK, gin.H{"success": true, "data": data})
}

func storeError(ctx *gin.Context, status int, message string) {
	ctx.JSON(status, gin.H{"success": false, "message": message})
}

var storeIDCleaner = regexp.MustCompile(`[^a-z0-9]+`)

func storePrefix(tenant string) string {
	value := storeIDCleaner.ReplaceAllString(strings.ToLower(tenant), "")
	if len(value) > 8 {
		value = value[:8]
	}
	if value == "" {
		return "default"
	}
	return value
}

func ensureStoreCatalog(db *gorm.DB, tenant string) error {
	var count int64
	if err := db.Model(&sellingmodel.StoreProduct{}).Where("tenant_id = ?", tenant).Count(&count).Error; err != nil {
		return err
	}
	if count > 0 {
		return nil
	}

	prefix := storePrefix(tenant)
	categories := []sellingmodel.StoreCategory{
		{ID: prefix + "-cat-makeup", TenantID: tenant, Name: "Makeup", Slug: "makeup", Description: "Warna dan essentials untuk setiap ekspresi.", Image: "/beauty/makeup.jpg", SortOrder: 1, IsActive: true},
		{ID: prefix + "-cat-skincare", TenantID: tenant, Name: "Skincare", Slug: "skincare", Description: "Ritual harian untuk kulit yang terasa sehat.", Image: "/beauty/skincare.jpg", SortOrder: 2, IsActive: true},
		{ID: prefix + "-cat-fragrance", TenantID: tenant, Name: "Fragrance", Slug: "fragrance", Description: "Signature scent untuk setiap suasana.", Image: "/beauty/perfume.jpg", SortOrder: 3, IsActive: true},
		{ID: prefix + "-cat-bath-body", TenantID: tenant, Name: "Bath & Body", Slug: "bath-body", Description: "Perawatan tubuh dan little luxuries sehari-hari.", Image: "/beauty/serum.jpg", SortOrder: 4, IsActive: true},
	}
	categoryID := map[string]string{}
	for i := range categories {
		categoryID[categories[i].Slug] = categories[i].ID
	}
	products := []sellingmodel.StoreProduct{
		{ID: prefix + "-p-curology", TenantID: tenant, CategoryID: categoryID["skincare"], Name: "Everyday Skin Essential", Slug: "curology-skin-essential", SKU: "LUM-SKN-001", Brand: "Curology", Description: "Daily skin essential yang ringan untuk membantu menjaga kelembapan dan tampilan kulit tetap seimbang sepanjang hari.", Ingredients: "Niacinamide, hyaluronic acid, ceramide complex.", HowToUse: "Gunakan pada wajah yang bersih setiap pagi dan malam, lalu lanjutkan dengan moisturizer.", Price: 489000, Badge: "NEW", Image: "/beauty/skincare.jpg", SecondaryImage: "/beauty/serum.jpg", Rating: 4.9, ReviewCount: 326, Stock: 48, IsFeatured: true, IsActive: true},
		{ID: prefix + "-p-beauty-edit", TenantID: tenant, CategoryID: categoryID["makeup"], Name: "Complete Makeup Essentials Set", Slug: "beauty-edit-set", SKU: "LUM-MKP-001", Brand: "The Beauty Edit", Description: "Set makeup lengkap berisi pilihan essentials untuk menciptakan tampilan natural sampai statement look.", Ingredients: "Set berisi complexion, eye, cheek, dan lip essentials.", HowToUse: "Aplikasikan sesuai urutan complexion, mata, pipi, lalu bibir.", Price: 895000, CompareAtPrice: 1050000, Badge: "ONLY AT LUMÉA", Image: "/beauty/lipstick.jpg", SecondaryImage: "/beauty/makeup.jpg", Rating: 4.8, ReviewCount: 5600, Stock: 24, IsFeatured: true, IsActive: true},
		{ID: prefix + "-p-soft-focus", TenantID: tenant, CategoryID: categoryID["makeup"], Name: "Soft Focus Makeup Essentials", Slug: "lumea-soft-focus", SKU: "LUM-MKP-002", Brand: "LUMÉA Collection", Description: "Koleksi soft-focus dengan hasil akhir halus dan buildable untuk tampilan effortless setiap hari.", Ingredients: "Silky mineral pigments and soft-focus powders.", HowToUse: "Gunakan tipis untuk hasil natural atau tambahkan lapisan untuk intensitas lebih tinggi.", Price: 570000, Badge: "NEW", Image: "/beauty/makeup.jpg", SecondaryImage: "/beauty/lipstick.jpg", Rating: 4.7, ReviewCount: 824, Stock: 36, IsFeatured: true, IsActive: true},
		{ID: prefix + "-p-body-lotion", TenantID: tenant, CategoryID: categoryID["bath-body"], Name: "The Body Lotion Fragrance-Free", Slug: "necessaire-body-lotion", SKU: "LUM-BDY-001", Brand: "Nécessaire", Description: "Body lotion tanpa pewangi dengan tekstur nyaman untuk melembapkan kulit tanpa terasa berat.", Ingredients: "Peptides, niacinamide, marula oil, vitamin E.", HowToUse: "Pijatkan ke seluruh tubuh setelah mandi atau kapan pun kulit membutuhkan kelembapan.", Price: 625000, Badge: "BESTSELLER", Image: "/beauty/serum.jpg", SecondaryImage: "/beauty/skincare.jpg", Rating: 4.9, ReviewCount: 6300, Stock: 64, IsFeatured: true, IsActive: true},
		{ID: prefix + "-p-chanel-no5", TenantID: tenant, CategoryID: categoryID["fragrance"], Name: "N°5 Eau De Parfum", Slug: "chanel-no5", SKU: "LUM-FRG-001", Brand: "Chanel", Description: "Floral aldehyde ikonis dengan karakter elegan, hangat, dan meninggalkan jejak yang tak terlupakan.", Ingredients: "Aldehydes, ylang-ylang, jasmine, rose, sandalwood, vanilla.", HowToUse: "Semprotkan pada titik nadi dari jarak sekitar 15 cm. Hindari menggosok area aplikasi.", Price: 2850000, Badge: "ONLY AT LUMÉA", Image: "/beauty/perfume.jpg", SecondaryImage: "/beauty/hero-beauty.png", Rating: 4.8, ReviewCount: 3800, Stock: 18, IsFeatured: true, IsActive: true},
	}

	return db.Transaction(func(tx *gorm.DB) error {
		for i := range categories {
			if err := tx.Where("tenant_id = ? AND slug = ?", tenant, categories[i].Slug).FirstOrCreate(&categories[i]).Error; err != nil {
				return err
			}
		}
		for i := range products {
			if err := tx.Where("tenant_id = ? AND slug = ?", tenant, products[i].Slug).FirstOrCreate(&products[i]).Error; err != nil {
				return err
			}
		}
		return nil
	})
}

func (ctrl *StoreController) Categories(ctx *gin.Context) {
	db, tenant := storeDB(ctx), storeTenant(ctx)
	if err := ensureStoreCatalog(db, tenant); err != nil {
		storeError(ctx, http.StatusInternalServerError, "Gagal menyiapkan kategori produk")
		return
	}
	var categories []sellingmodel.StoreCategory
	if err := db.Where("tenant_id = ? AND is_active = ?", tenant, true).Order("sort_order asc, name asc").Find(&categories).Error; err != nil {
		storeError(ctx, http.StatusInternalServerError, "Gagal mengambil kategori produk")
		return
	}
	storeSuccess(ctx, categories)
}

func (ctrl *StoreController) Products(ctx *gin.Context) {
	db, tenant := storeDB(ctx), storeTenant(ctx)
	if err := ensureStoreCatalog(db, tenant); err != nil {
		storeError(ctx, http.StatusInternalServerError, "Gagal menyiapkan katalog produk")
		return
	}
	query := db.Preload("Category").Where("store_products.tenant_id = ? AND store_products.is_active = ?", tenant, true)
	if category := strings.TrimSpace(ctx.Query("category")); category != "" {
		query = query.Joins("JOIN store_categories ON store_categories.id = store_products.category_id").Where("store_categories.slug = ?", category)
	}
	if search := strings.TrimSpace(ctx.Query("q")); search != "" {
		like := "%" + search + "%"
		query = query.Where("store_products.name LIKE ? OR store_products.brand LIKE ? OR store_products.description LIKE ?", like, like, like)
	}
	if ctx.Query("featured") == "true" {
		query = query.Where("store_products.is_featured = ?", true)
	}
	var products []sellingmodel.StoreProduct
	if err := query.Order("store_products.is_featured desc, store_products.created_at desc").Find(&products).Error; err != nil {
		storeError(ctx, http.StatusInternalServerError, "Gagal mengambil produk")
		return
	}
	storeSuccess(ctx, products)
}

func (ctrl *StoreController) Product(ctx *gin.Context) {
	db, tenant := storeDB(ctx), storeTenant(ctx)
	if err := ensureStoreCatalog(db, tenant); err != nil {
		storeError(ctx, http.StatusInternalServerError, "Gagal menyiapkan katalog produk")
		return
	}
	var product sellingmodel.StoreProduct
	value := strings.TrimSpace(ctx.Param("slug"))
	if err := db.Preload("Category").Where("tenant_id = ? AND is_active = ? AND (slug = ? OR id = ?)", tenant, true, value, value).First(&product).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			storeError(ctx, http.StatusNotFound, "Produk tidak ditemukan")
			return
		}
		storeError(ctx, http.StatusInternalServerError, "Gagal mengambil detail produk")
		return
	}
	storeSuccess(ctx, product)
}

func (ctrl *StoreController) Cart(ctx *gin.Context) {
	userID, ok := storeUserID(ctx)
	if !ok {
		return
	}
	var items []sellingmodel.StoreCartItem
	if err := storeDB(ctx).Preload("Product.Category").Where("tenant_id = ? AND user_id = ?", storeTenant(ctx), userID).Order("created_at asc").Find(&items).Error; err != nil {
		storeError(ctx, http.StatusInternalServerError, "Gagal mengambil keranjang")
		return
	}
	storeSuccess(ctx, items)
}

type storeQuantityInput struct {
	Quantity int `json:"quantity"`
}

func (ctrl *StoreController) AddCart(ctx *gin.Context) {
	userID, ok := storeUserID(ctx)
	if !ok {
		return
	}
	var input storeQuantityInput
	_ = ctx.ShouldBindJSON(&input)
	if input.Quantity <= 0 {
		input.Quantity = 1
	}
	db, tenant, productID := storeDB(ctx), storeTenant(ctx), strings.TrimSpace(ctx.Param("productID"))
	var product sellingmodel.StoreProduct
	if err := db.Where("tenant_id = ? AND id = ? AND is_active = ?", tenant, productID, true).First(&product).Error; err != nil {
		storeError(ctx, http.StatusNotFound, "Produk tidak ditemukan")
		return
	}
	var item sellingmodel.StoreCartItem
	err := db.Where("tenant_id = ? AND user_id = ? AND product_id = ?", tenant, userID, productID).First(&item).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		item = sellingmodel.StoreCartItem{ID: "cart-" + uuid.NewString(), TenantID: tenant, UserID: userID, ProductID: productID, Quantity: input.Quantity}
		err = db.Create(&item).Error
	} else if err == nil {
		item.Quantity += input.Quantity
		err = db.Save(&item).Error
	}
	if err != nil {
		storeError(ctx, http.StatusInternalServerError, "Gagal menambahkan produk ke keranjang")
		return
	}
	db.Preload("Product.Category").First(&item, "id = ?", item.ID)
	storeSuccess(ctx, item)
}

func (ctrl *StoreController) UpdateCart(ctx *gin.Context) {
	userID, ok := storeUserID(ctx)
	if !ok {
		return
	}
	var input storeQuantityInput
	if err := ctx.ShouldBindJSON(&input); err != nil || input.Quantity < 1 {
		storeError(ctx, http.StatusBadRequest, "Jumlah produk minimal 1")
		return
	}
	result := storeDB(ctx).Model(&sellingmodel.StoreCartItem{}).Where("tenant_id = ? AND user_id = ? AND product_id = ?", storeTenant(ctx), userID, ctx.Param("productID")).Update("quantity", input.Quantity)
	if result.Error != nil {
		storeError(ctx, http.StatusInternalServerError, "Gagal memperbarui keranjang")
		return
	}
	if result.RowsAffected == 0 {
		storeError(ctx, http.StatusNotFound, "Produk tidak ada di keranjang")
		return
	}
	storeSuccess(ctx, gin.H{"product_id": ctx.Param("productID"), "quantity": input.Quantity})
}

func (ctrl *StoreController) RemoveCart(ctx *gin.Context) {
	userID, ok := storeUserID(ctx)
	if !ok {
		return
	}
	if err := storeDB(ctx).Where("tenant_id = ? AND user_id = ? AND product_id = ?", storeTenant(ctx), userID, ctx.Param("productID")).Delete(&sellingmodel.StoreCartItem{}).Error; err != nil {
		storeError(ctx, http.StatusInternalServerError, "Gagal menghapus produk dari keranjang")
		return
	}
	storeSuccess(ctx, nil)
}

func (ctrl *StoreController) Wishlist(ctx *gin.Context) {
	userID, ok := storeUserID(ctx)
	if !ok {
		return
	}
	var items []sellingmodel.StoreWishlistItem
	if err := storeDB(ctx).Preload("Product.Category").Where("tenant_id = ? AND user_id = ?", storeTenant(ctx), userID).Order("created_at desc").Find(&items).Error; err != nil {
		storeError(ctx, http.StatusInternalServerError, "Gagal mengambil wishlist")
		return
	}
	storeSuccess(ctx, items)
}

func (ctrl *StoreController) AddWishlist(ctx *gin.Context) {
	userID, ok := storeUserID(ctx)
	if !ok {
		return
	}
	db, tenant, productID := storeDB(ctx), storeTenant(ctx), ctx.Param("productID")
	var product sellingmodel.StoreProduct
	if err := db.Where("tenant_id = ? AND id = ? AND is_active = ?", tenant, productID, true).First(&product).Error; err != nil {
		storeError(ctx, http.StatusNotFound, "Produk tidak ditemukan")
		return
	}
	item := sellingmodel.StoreWishlistItem{ID: "wish-" + uuid.NewString(), TenantID: tenant, UserID: userID, ProductID: productID}
	if err := db.Where("tenant_id = ? AND user_id = ? AND product_id = ?", tenant, userID, productID).FirstOrCreate(&item).Error; err != nil {
		storeError(ctx, http.StatusInternalServerError, "Gagal menyimpan wishlist")
		return
	}
	db.Preload("Product.Category").First(&item, "id = ?", item.ID)
	storeSuccess(ctx, item)
}

func (ctrl *StoreController) RemoveWishlist(ctx *gin.Context) {
	userID, ok := storeUserID(ctx)
	if !ok {
		return
	}
	if err := storeDB(ctx).Where("tenant_id = ? AND user_id = ? AND product_id = ?", storeTenant(ctx), userID, ctx.Param("productID")).Delete(&sellingmodel.StoreWishlistItem{}).Error; err != nil {
		storeError(ctx, http.StatusInternalServerError, "Gagal menghapus wishlist")
		return
	}
	storeSuccess(ctx, nil)
}

func (ctrl *StoreController) Orders(ctx *gin.Context) {
	userID, ok := storeUserID(ctx)
	if !ok {
		return
	}
	var orders []sellingmodel.StoreOrder
	if err := storeDB(ctx).Preload("Items").Where("tenant_id = ? AND user_id = ?", storeTenant(ctx), userID).Order("created_at desc").Find(&orders).Error; err != nil {
		storeError(ctx, http.StatusInternalServerError, "Gagal mengambil transaksi")
		return
	}
	storeSuccess(ctx, orders)
}

type storeOrderInput struct {
	PaymentMethod string `json:"payment_method"`
	Address       string `json:"address"`
}

func (ctrl *StoreController) CreateOrder(ctx *gin.Context) {
	userID, ok := storeUserID(ctx)
	if !ok {
		return
	}
	var input storeOrderInput
	if err := ctx.ShouldBindJSON(&input); err != nil || strings.TrimSpace(input.PaymentMethod) == "" || strings.TrimSpace(input.Address) == "" {
		storeError(ctx, http.StatusBadRequest, "Alamat dan metode pembayaran wajib diisi")
		return
	}
	db, tenant := storeDB(ctx), storeTenant(ctx)
	var created sellingmodel.StoreOrder
	err := db.Transaction(func(tx *gorm.DB) error {
		var cart []sellingmodel.StoreCartItem
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).Preload("Product").Where("tenant_id = ? AND user_id = ?", tenant, userID).Find(&cart).Error; err != nil {
			return err
		}
		if len(cart) == 0 {
			return fmt.Errorf("EMPTY_CART")
		}
		now := time.Now()
		created = sellingmodel.StoreOrder{
			ID: "order-" + uuid.NewString(), TenantID: tenant, UserID: userID,
			OrderNumber: "LUM-" + now.Format("060102150405") + strings.ToUpper(uuid.NewString()[:4]),
			Status:      "Diproses", PaymentMethod: strings.TrimSpace(input.PaymentMethod), Address: strings.TrimSpace(input.Address), CreatedAt: now, UpdatedAt: now,
		}
		if strings.EqualFold(created.PaymentMethod, "Bank Transfer") {
			created.Status = "Menunggu Pembayaran"
		}
		for _, cartItem := range cart {
			if !cartItem.Product.IsActive || cartItem.Product.Stock < cartItem.Quantity {
				return fmt.Errorf("OUT_OF_STOCK:%s", cartItem.Product.Name)
			}
			subtotal := cartItem.Product.Price * float64(cartItem.Quantity)
			created.Subtotal += subtotal
			created.Items = append(created.Items, sellingmodel.StoreOrderItem{
				ID: "order-item-" + uuid.NewString(), ProductID: cartItem.ProductID, Name: cartItem.Product.Name,
				Brand: cartItem.Product.Brand, Image: cartItem.Product.Image, Price: cartItem.Product.Price,
				Quantity: cartItem.Quantity, Subtotal: subtotal,
			})
		}
		if created.Subtotal < 500000 {
			created.Shipping = 25000
		}
		created.Total = created.Subtotal + created.Shipping
		for i := range created.Items {
			created.Items[i].OrderID = created.ID
		}
		if err := tx.Create(&created).Error; err != nil {
			return err
		}
		for _, item := range cart {
			result := tx.Model(&sellingmodel.StoreProduct{}).
				Where("tenant_id = ? AND id = ? AND stock >= ?", tenant, item.ProductID, item.Quantity).
				Update("stock", gorm.Expr("stock - ?", item.Quantity))
			if result.Error != nil {
				return result.Error
			}
			if result.RowsAffected == 0 {
				return fmt.Errorf("OUT_OF_STOCK:%s", item.Product.Name)
			}
		}
		return tx.Where("tenant_id = ? AND user_id = ?", tenant, userID).Delete(&sellingmodel.StoreCartItem{}).Error
	})
	if err != nil {
		switch {
		case err.Error() == "EMPTY_CART":
			storeError(ctx, http.StatusConflict, "Keranjang masih kosong")
		case strings.HasPrefix(err.Error(), "OUT_OF_STOCK:"):
			storeError(ctx, http.StatusConflict, "Stok tidak mencukupi untuk "+strings.TrimPrefix(err.Error(), "OUT_OF_STOCK:"))
		default:
			storeError(ctx, http.StatusInternalServerError, "Gagal membuat pesanan")
		}
		return
	}
	ctx.JSON(http.StatusCreated, gin.H{"success": true, "data": created})
}

func (ctrl *StoreController) Me(ctx *gin.Context) {
	userID, ok := storeUserID(ctx)
	if !ok {
		return
	}
	db := storeDB(ctx)
	var user model.User
	if err := db.Preload("Profile").First(&user, "id = ?", userID).Error; err != nil {
		storeError(ctx, http.StatusNotFound, "Akun buyer tidak ditemukan")
		return
	}
	avatar := ""
	if user.Profile != nil {
		avatar = user.Profile.AvatarURL
	}
	storeSuccess(ctx, gin.H{
		"id": user.ID, "email": user.Email, "full_name": user.DisplayName, "phone": user.PhoneNumber,
		"birth_date": formatStoreBirthDate(user.DateOfBirth), "gender": user.Gender, "address": user.Address,
		"avatar": avatar, "member_since": user.CreatedAt, "balance": user.Balance,
	})
}

func formatStoreBirthDate(value time.Time) string {
	if value.IsZero() {
		return ""
	}
	return value.Format("2006-01-02")
}

type storeProfileInput struct {
	FullName  string `json:"full_name"`
	Phone     string `json:"phone"`
	BirthDate string `json:"birth_date"`
	Gender    string `json:"gender"`
	Address   string `json:"address"`
}

func (ctrl *StoreController) UpdateMe(ctx *gin.Context) {
	userID, ok := storeUserID(ctx)
	if !ok {
		return
	}
	var input storeProfileInput
	if err := ctx.ShouldBindJSON(&input); err != nil {
		storeError(ctx, http.StatusBadRequest, "Data profil tidak valid")
		return
	}
	parsedUserID, err := uuid.Parse(userID)
	if err != nil {
		storeError(ctx, http.StatusUnauthorized, "Identitas akun tidak valid")
		return
	}
	updates := map[string]interface{}{
		"display_name": strings.TrimSpace(input.FullName), "phone_number": strings.TrimSpace(input.Phone),
		"gender": strings.TrimSpace(input.Gender), "address": strings.TrimSpace(input.Address),
	}
	var birthDate *time.Time
	if strings.TrimSpace(input.BirthDate) != "" {
		parsed, parseErr := time.Parse("2006-01-02", input.BirthDate)
		if parseErr != nil {
			storeError(ctx, http.StatusBadRequest, "Tanggal lahir tidak valid")
			return
		}
		birthDate = &parsed
		updates["date_of_birth"] = parsed
	} else {
		updates["date_of_birth"] = nil
	}
	db := storeDB(ctx)
	if err := db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Model(&model.User{}).Where("id = ?", parsedUserID).Updates(updates).Error; err != nil {
			return err
		}
		profileUpdates := map[string]interface{}{"full_name": strings.TrimSpace(input.FullName), "display_name": strings.TrimSpace(input.FullName), "phone_number": strings.TrimSpace(input.Phone), "date_of_birth": birthDate}
		return tx.Model(&model.Profile{}).Where("user_id = ?", parsedUserID).Updates(profileUpdates).Error
	}); err != nil {
		storeError(ctx, http.StatusInternalServerError, "Gagal memperbarui profil")
		return
	}
	ctrl.Me(ctx)
}
