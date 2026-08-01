package controller

import (
	"errors"
	"fmt"
	"gin-template/common"
	"gin-template/model"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/xuri/excelize/v2"
	"go.uber.org/zap"
	"gorm.io/gorm"
)

type BalanceWithdrawalController struct {
	DB *gorm.DB
}

func NewBalanceWithdrawalController(db *gorm.DB) *BalanceWithdrawalController {
	return &BalanceWithdrawalController{DB: db}
}

// GET /lms/admin/balance
func (ctrl *BalanceWithdrawalController) GetBalanceAndLogs(c *gin.Context) {
	log := zap.L().With(zap.String("controller", "BalanceWithdrawalController"), zap.String("function", "GetBalanceAndLogs"))
	role := c.GetInt("role")
	if role < 99 {
		log.Warn("Access denied for non-admin role", zap.Int("role", role))
		sendError(c, http.StatusForbidden, "Akses ditolak", nil)
		return
	}

	db := lmsDB(c, ctrl.DB)

	tenantVal, _ := c.Get(common.CtxTenantKey)
	tenant := tenantVal.(model.Tenant)

	userIDStr := c.GetString("id")
	userID, err := uuid.Parse(userIDStr)
	if err != nil {
		log.Warn("Invalid User ID in context", zap.String("user_id_raw", userIDStr))
		sendError(c, http.StatusUnauthorized, "User ID tidak valid", nil)
		return
	}

	log = log.With(zap.String("user_id", userID.String()), zap.String("tenant_id", tenant.ID.String()))

	// Fetch tenant to get the fresh balance
	var dbTenant model.Tenant
	if err := db.First(&dbTenant, "id = ?", tenant.ID).Error; err != nil {
		log.Error("Failed to fetch tenant balance", zap.Error(err))
		sendInternalError(c, err)
		return
	}

	var logs []model.BalanceLog
	if err := db.Order("created_at desc").Find(&logs).Error; err != nil {
		log.Error("Failed to fetch balance logs", zap.Error(err))
		sendInternalError(c, err)
		return
	}

	// Fetch the saved user bank details from their Profile
	var profile model.Profile
	_ = db.First(&profile, "user_id = ?", userID).Error

	log.Info("Retrieved tenant balance and logs", zap.Float64("balance", dbTenant.Balance), zap.Int("logs_count", len(logs)))

	sendSuccess(c, gin.H{
		"balance":             dbTenant.Balance,
		"logs":                logs,
		"bank_name":           profile.BankName,
		"bank_account_number": profile.BankAccountNumber,
		"bank_account_name":   profile.BankAccountName,
	}, "Balance and transaction logs retrieved successfully")
}

// GET /lms/admin/balance/export
func (ctrl *BalanceWithdrawalController) ExportBalanceLogsExcel(c *gin.Context) {
	log := zap.L().With(zap.String("controller", "BalanceWithdrawalController"), zap.String("function", "ExportBalanceLogsExcel"))
	role := c.GetInt("role")
	if role < 99 {
		log.Warn("Access denied for non-admin role", zap.Int("role", role))
		sendError(c, http.StatusForbidden, "Akses ditolak", nil)
		return
	}

	db := lmsDB(c, ctrl.DB)

	var logs []model.BalanceLog
	if err := db.Order("created_at desc").Find(&logs).Error; err != nil {
		log.Error("Failed to fetch balance logs for export", zap.Error(err))
		sendInternalError(c, err)
		return
	}

	f := excelize.NewFile()
	defer func() {
		_ = f.Close()
	}()

	sheetName := "Sheet1"
	_ = f.SetSheetName("Sheet1", sheetName)

	headers := []string{"ID Transaksi", "Kategori", "Deskripsi", "Gateway Amount (Gross)", "System Amount (Net)", "Status", "Tanggal Dibuat"}
	for i, header := range headers {
		col, _ := excelize.ColumnNumberToName(i + 1)
		cell := fmt.Sprintf("%s1", col)
		_ = f.SetCellValue(sheetName, cell, header)
	}

	for rIdx, l := range logs {
		rowNum := rIdx + 2
		_ = f.SetCellValue(sheetName, fmt.Sprintf("A%d", rowNum), l.TransactionID)
		_ = f.SetCellValue(sheetName, fmt.Sprintf("B%d", rowNum), string(l.Category))
		_ = f.SetCellValue(sheetName, fmt.Sprintf("C%d", rowNum), l.Description)
		_ = f.SetCellValue(sheetName, fmt.Sprintf("D%d", rowNum), l.GatewayAmount)
		_ = f.SetCellValue(sheetName, fmt.Sprintf("E%d", rowNum), l.SystemAmount)
		_ = f.SetCellValue(sheetName, fmt.Sprintf("F%d", rowNum), l.Status)
		_ = f.SetCellValue(sheetName, fmt.Sprintf("G%d", rowNum), l.CreatedAt.Format("2006-01-02 15:04:05"))
	}

	log.Info("Exporting balance logs Excel statement", zap.Int("record_count", len(logs)))

	c.Header("Content-Disposition", "attachment; filename=balance-statement.xlsx")
	c.Header("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
	if err := f.Write(c.Writer); err != nil {
		log.Error("Failed to write Excel stream to response writer", zap.Error(err))
		sendInternalError(c, err)
	}
}

// GET /lms/admin/withdrawals
func (ctrl *BalanceWithdrawalController) ListWithdrawals(c *gin.Context) {
	log := zap.L().With(zap.String("controller", "BalanceWithdrawalController"), zap.String("function", "ListWithdrawals"))
	role := c.GetInt("role")
	if role < 99 {
		log.Warn("Access denied for non-admin role", zap.Int("role", role))
		sendError(c, http.StatusForbidden, "Akses ditolak", nil)
		return
	}

	db := lmsDB(c, ctrl.DB)

	var list []model.Withdrawal
	if err := db.Preload("RequestedBy").Preload("ApprovedBy").Order("created_at desc").Find(&list).Error; err != nil {
		log.Error("Failed to fetch withdrawal requests list", zap.Error(err))
		sendInternalError(c, err)
		return
	}

	log.Info("Retrieved withdrawal requests list", zap.Int("count", len(list)))
	sendSuccess(c, list, "Withdrawal requests retrieved successfully")
}

// POST /lms/admin/withdrawals
func (ctrl *BalanceWithdrawalController) CreateWithdrawal(c *gin.Context) {
	log := zap.L().With(zap.String("controller", "BalanceWithdrawalController"), zap.String("function", "CreateWithdrawal"))
	role := c.GetInt("role")
	// Allow Mentor (30), Admin (99), and Superadmin (100) to request withdrawals
	if role < 30 {
		log.Warn("Access denied for non-mentor/admin role", zap.Int("role", role))
		sendError(c, http.StatusForbidden, "Hanya mentor, admin, atau superadmin yang dapat mengajukan penarikan dana", nil)
		return
	}

	var req struct {
		Amount            float64 `json:"amount" binding:"required,gt=0"`
		Notes             string  `json:"notes"`
		BankName          string  `json:"bank_name" binding:"required"`
		BankAccountNumber string  `json:"bank_account_number" binding:"required"`
		BankAccountName   string  `json:"bank_account_name" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		log.Warn("Invalid JSON request for CreateWithdrawal", zap.Error(err))
		sendError(c, http.StatusBadRequest, "Data rekening dan jumlah penarikan wajib diisi secara lengkap", nil)
		return
	}

	db := lmsDB(c, ctrl.DB)

	tenantVal, _ := c.Get(common.CtxTenantKey)
	tenant := tenantVal.(model.Tenant)

	userIDStr := c.GetString("id")
	userID, err := uuid.Parse(userIDStr)
	if err != nil {
		log.Warn("Invalid User ID in context", zap.String("user_id_raw", userIDStr))
		sendError(c, http.StatusUnauthorized, "User ID tidak valid", nil)
		return
	}

	log = log.With(
		zap.String("user_id", userID.String()),
		zap.Int("role", role),
		zap.Float64("amount", req.Amount),
		zap.String("bank_name", req.BankName),
		zap.String("account_number", req.BankAccountNumber),
	)

	var withdrawalID uuid.UUID
	err = db.Transaction(func(tx *gorm.DB) error {
		var wallet *model.Wallet
		if role >= 30 && role < 99 {
			wallet, err = EnsureWallet(tx, model.WalletOwnerUser, userID, tenant.ID)
		} else {
			wallet, err = EnsureWallet(tx, model.WalletOwnerPlatform, uuid.Nil, tenant.ID)
		}
		if err != nil {
			return fmt.Errorf("gagal memuat dompet: %w", err)
		}

		available := wallet.GetAvailableBalance()
		if available < req.Amount {
			return fmt.Errorf("saldo tersedia tidak mencukupi. Tersedia: Rp %.0f, Diminta: Rp %.0f", available, req.Amount)
		}

		var profile model.Profile
		err = tx.Where("user_id = ?", userID).First(&profile).Error
		if err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				profile = model.Profile{
					UserID:            userID,
					FullName:          c.GetString("username"),
					BankName:          req.BankName,
					BankAccountNumber: req.BankAccountNumber,
					BankAccountName:   req.BankAccountName,
					TenantID:          &tenant.ID,
				}
				if err := tx.Create(&profile).Error; err != nil {
					return err
				}
			} else {
				return err
			}
		} else {
			if err := tx.Model(&profile).Updates(map[string]interface{}{
				"bank_name":           req.BankName,
				"bank_account_number": req.BankAccountNumber,
				"bank_account_name":   req.BankAccountName,
			}).Error; err != nil {
				return err
			}
		}

		withdrawalID = uuid.New()
		w := model.Withdrawal{
			ID:                withdrawalID,
			Amount:            req.Amount,
			TotalDeduct:       req.Amount,
			Status:            model.WithdrawalStatusPending,
			RequestedByID:     userID,
			WalletID:          &wallet.ID,
			Notes:             req.Notes,
			BankName:          req.BankName,
			BankAccountNumber: req.BankAccountNumber,
			BankAccountName:   req.BankAccountName,
			TenantID:          &tenant.ID,
		}
		if err := tx.Create(&w).Error; err != nil {
			return err
		}

		var sysSetting model.SystemSetting
		if err := tx.First(&sysSetting).Error; err == nil {
			if sysSetting.DiscordWithdrawalWebhook != "" {
				var reqUser model.User
				_ = tx.First(&reqUser, "id = ?", userID).Error

				displayName := reqUser.DisplayName
				if displayName == "" {
					displayName = reqUser.Email
				}

				payload := common.DiscordWebhook{
					Embeds: []common.DiscordEmbed{
						{
							Title:       "💸 Pengajuan Penarikan Dana Baru!",
							Description: "Ada pengajuan penarikan dana baru yang memerlukan persetujuan dari Superadmin.",
							Color:       0xf1c40f,
							Fields: []common.DiscordEmbedField{
								{Name: "Pengaju", Value: displayName, Inline: true},
								{Name: "Jumlah Penarikan", Value: fmt.Sprintf("Rp %.0f", req.Amount), Inline: true},
								{Name: "Bank", Value: req.BankName, Inline: true},
								{Name: "Nomor Rekening", Value: req.BankAccountNumber, Inline: true},
								{Name: "Nama Pemilik Rekening", Value: req.BankAccountName, Inline: true},
								{Name: "Catatan", Value: req.Notes, Inline: false},
							},
							Timestamp: time.Now().UTC().Format(time.RFC3339),
						},
					},
				}
				go common.SendWebhook(sysSetting.DiscordWithdrawalWebhook, payload)
			}
		}

		return nil
	})

	if err != nil {
		log.Warn("Create withdrawal request failed", zap.Error(err))
		sendError(c, http.StatusBadRequest, err.Error(), nil)
		return
	}

	log.Info("Withdrawal request created successfully", zap.String("withdrawal_id", withdrawalID.String()))
	sendSuccess(c, nil, "Pengajuan penarikan berhasil dibuat, menunggu approval superadmin")
}

// POST /lms/admin/withdrawals/:id/approve
func (ctrl *BalanceWithdrawalController) ApproveWithdrawal(c *gin.Context) {
	log := zap.L().With(zap.String("controller", "BalanceWithdrawalController"), zap.String("function", "ApproveWithdrawal"))
	role := c.GetInt("role")
	if role < 100 {
		log.Warn("Access denied for non-superadmin role", zap.Int("role", role))
		sendError(c, http.StatusForbidden, "Hanya superadmin yang dapat menyetujui penarikan", nil)
		return
	}

	idStr := c.Param("id")
	wID, err := uuid.Parse(idStr)
	if err != nil {
		log.Warn("Invalid withdrawal ID param", zap.String("raw_id", idStr))
		sendError(c, http.StatusBadRequest, "ID penarikan tidak valid", nil)
		return
	}

	db := lmsDB(c, ctrl.DB)

	userIDStr := c.GetString("id")
	userID, err := uuid.Parse(userIDStr)
	if err != nil {
		log.Warn("Invalid Superadmin User ID in context", zap.String("user_id_raw", userIDStr))
		sendError(c, http.StatusUnauthorized, "User ID tidak valid", nil)
		return
	}

	log = log.With(zap.String("withdrawal_id", wID.String()), zap.String("superadmin_id", userID.String()))

	err = db.Transaction(func(tx *gorm.DB) error {
		var w model.Withdrawal
		if err := tx.First(&w, "id = ?", wID).Error; err != nil {
			return err
		}

		if w.Status != model.WithdrawalStatusPending {
			return fmt.Errorf("penarikan ini sudah diproses sebelumnya (Status: %s)", w.Status)
		}

		walletID := w.WalletID
		if walletID == nil {
			return fmt.Errorf("penarikan tidak memiliki wallet_id")
		}

		wUUID := w.ID
		if _, err := DebitWallet(tx, *walletID, w.Amount,
			model.LedgerReasonWithdrawal, "withdrawal", &wUUID,
			fmt.Sprintf("Penarikan: Rp %.0f (%s - %s a/n %s)", w.Amount, w.BankName, w.BankAccountNumber, w.BankAccountName)); err != nil {
			return err
		}

		if err := tx.Model(&w).Updates(map[string]interface{}{
			"status":         model.WithdrawalStatusApproved,
			"approved_by_id": &userID,
		}).Error; err != nil {
			return err
		}

		balanceLog := model.BalanceLog{
			ID:            uuid.New(),
			TransactionID: w.ID.String(),
			Category:      model.CategoryRefund,
			Description:   fmt.Sprintf("Penarikan Dana disetujui: Rp %.0f (%s - %s a/n %s)", w.Amount, w.BankName, w.BankAccountNumber, w.BankAccountName),
			GatewayAmount: w.Amount,
			SystemAmount:  -w.Amount,
			Diff:          0,
			Status:        "MATCH",
			TenantID:      w.TenantID,
		}
		if err := tx.Create(&balanceLog).Error; err != nil {
			return err
		}

		return nil
	})

	if err != nil {
		log.Error("Approve withdrawal transaction failed", zap.Error(err))
		sendError(c, http.StatusBadRequest, err.Error(), nil)
		return
	}

	log.Info("Withdrawal approved and wallet debited successfully")
	sendSuccess(c, nil, "Penarikan berhasil disetujui dan saldo berhasil didebet")
}

// POST /lms/admin/withdrawals/:id/reject
func (ctrl *BalanceWithdrawalController) RejectWithdrawal(c *gin.Context) {
	log := zap.L().With(zap.String("controller", "BalanceWithdrawalController"), zap.String("function", "RejectWithdrawal"))
	role := c.GetInt("role")
	if role < 100 {
		log.Warn("Access denied for non-superadmin role", zap.Int("role", role))
		sendError(c, http.StatusForbidden, "Hanya superadmin yang dapat menolak penarikan", nil)
		return
	}

	idStr := c.Param("id")
	wID, err := uuid.Parse(idStr)
	if err != nil {
		log.Warn("Invalid withdrawal ID param", zap.String("raw_id", idStr))
		sendError(c, http.StatusBadRequest, "ID penarikan tidak valid", nil)
		return
	}

	var req struct {
		Reason string `json:"reason" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		log.Warn("Invalid JSON payload for RejectWithdrawal", zap.Error(err))
		sendError(c, http.StatusBadRequest, "Alasan penolakan wajib diisi", nil)
		return
	}

	db := lmsDB(c, ctrl.DB)

	userIDStr := c.GetString("id")
	userID, err := uuid.Parse(userIDStr)
	if err != nil {
		log.Warn("Invalid Superadmin User ID in context", zap.String("user_id_raw", userIDStr))
		sendError(c, http.StatusUnauthorized, "User ID tidak valid", nil)
		return
	}

	log = log.With(zap.String("withdrawal_id", wID.String()), zap.String("superadmin_id", userID.String()), zap.String("reason", req.Reason))

	err = db.Transaction(func(tx *gorm.DB) error {
		var w model.Withdrawal
		if err := tx.First(&w, "id = ?", wID).Error; err != nil {
			return err
		}

		if w.Status != model.WithdrawalStatusPending {
			return fmt.Errorf("penarikan ini sudah diproses sebelumnya (Status: %s)", w.Status)
		}

		if err := tx.Model(&w).Updates(map[string]interface{}{
			"status":           model.WithdrawalStatusRejected,
			"approved_by_id":   &userID,
			"rejection_reason": req.Reason,
		}).Error; err != nil {
			return err
		}

		return nil
	})

	if err != nil {
		log.Error("Reject withdrawal transaction failed", zap.Error(err))
		sendError(c, http.StatusBadRequest, err.Error(), nil)
		return
	}

	log.Info("Withdrawal rejected successfully")
	sendSuccess(c, nil, "Penarikan berhasil ditolak")
}

// GET /api/finance/summary
func (ctrl *BalanceWithdrawalController) GetFinanceSummary(c *gin.Context) {
	role := c.GetInt("role")
	if role < 30 {
		c.JSON(http.StatusForbidden, gin.H{"error": "Forbidden: Insufficient permissions"})
		return
	}

	db := lmsDB(c, ctrl.DB)
	userIDStr := c.GetString("id")
	userID, err := uuid.Parse(userIDStr)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User ID tidak valid"})
		return
	}

	tenantVal, _ := c.Get(common.CtxTenantKey)
	tenant := tenantVal.(model.Tenant)

	if role < 99 {
		wallet, err := EnsureWallet(db, model.WalletOwnerUser, userID, tenant.ID)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		var totalOmset float64
		db.Model(&model.WalletLedger{}).
			Where("wallet_id = ? AND entry_type = ?", wallet.ID, model.LedgerCredit).
			Select("COALESCE(SUM(amount), 0)").
			Scan(&totalOmset)

		c.JSON(http.StatusOK, gin.H{
			"active_balance": wallet.Balance,
			"total_omset":    totalOmset,
		})
		return
	}

	var dbTenant model.Tenant
	if err := db.First(&dbTenant, "id = ?", tenant.ID).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// Calculate total omset from BalanceLog (if exists)
	var totalOmset float64
	db.Model(&model.BalanceLog{}).Where("system_amount > 0").Select("COALESCE(SUM(system_amount), 0)").Scan(&totalOmset)

	// If BalanceLog is empty (e.g. payments processed before BalanceLog was implemented),
	// fallback to calculating from paid LMSPayments
	if totalOmset == 0 {
		db.Model(&model.LMSPayment{}).Where("status = ?", "paid").
			Select("COALESCE(SUM(amount), 0)").Scan(&totalOmset)
	}

	// If active_balance is 0 but we have omset, calculate from paid - withdrawn
	activeBalance := dbTenant.Balance
	if activeBalance == 0 && totalOmset > 0 {
		var withdrawn float64
		db.Model(&model.Withdrawal{}).Where("status = ?", "APPROVED").
			Select("COALESCE(SUM(total_deduct), 0)").Scan(&withdrawn)
		activeBalance = totalOmset - withdrawn
	}

	c.JSON(http.StatusOK, gin.H{
		"active_balance": activeBalance,
		"total_omset":    totalOmset,
	})
}

// GET /api/finance/withdrawals
func (ctrl *BalanceWithdrawalController) GetFinanceWithdrawals(c *gin.Context) {
	role := c.GetInt("role")
	if role < 30 {
		c.JSON(http.StatusForbidden, gin.H{"error": "Forbidden: Insufficient permissions"})
		return
	}

	db := lmsDB(c, ctrl.DB)
	userIDStr := c.GetString("id")
	userID, err := uuid.Parse(userIDStr)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User ID tidak valid"})
		return
	}

	var list []model.Withdrawal
	var queryErr error

	if role < 99 {
		queryErr = db.Preload("RequestedBy").Preload("ApprovedBy").Where("requested_by_id = ?", userID).Order("created_at desc").Find(&list).Error
	} else {
		queryErr = db.Preload("RequestedBy").Preload("ApprovedBy").Order("created_at desc").Find(&list).Error
	}

	if queryErr != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": queryErr.Error()})
		return
	}

	c.JSON(http.StatusOK, list)
}

func (ctrl *BalanceWithdrawalController) GetFinanceTransactions(c *gin.Context) {
	role := c.GetInt("role")
	if role < 30 {
		c.JSON(http.StatusForbidden, gin.H{"error": "Forbidden: Insufficient permissions"})
		return
	}

	db := lmsDB(c, ctrl.DB)
	userIDStr := c.GetString("id")
	userID, err := uuid.Parse(userIDStr)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User ID tidak valid"})
		return
	}

	type TransactionResp struct {
		ID           string    `json:"id"`
		Type         string    `json:"type"` // "INCOME", "EXPENSE", "PAYOUT"
		Amount       float64   `json:"amount"`
		Description  string    `json:"description"`
		BalanceAfter float64   `json:"balance_after"`
		CreatedAt    time.Time `json:"created_at"`
	}

	var txs []TransactionResp

	if role < 99 {
		tenantVal, _ := c.Get(common.CtxTenantKey)
		tenant := tenantVal.(model.Tenant)

		wallet, err := EnsureWallet(db, model.WalletOwnerUser, userID, tenant.ID)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		var logs []model.WalletLedger
		if err := db.Where("wallet_id = ?", wallet.ID).Order("created_at asc").Find(&logs).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		for _, l := range logs {
			txType := "INCOME"
			amount := l.Amount
			if l.EntryType == model.LedgerDebit {
				txType = "PAYOUT"
				amount = -l.Amount
			}
			txs = append(txs, TransactionResp{
				ID:           l.ID.String(),
				Type:         txType,
				Amount:       amount,
				Description:  l.Description,
				BalanceAfter: l.RunningBalance,
				CreatedAt:    l.CreatedAt,
			})
		}
	} else {
		var logs []model.BalanceLog
		if err := db.Order("created_at asc").Find(&logs).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		runningBalance := 0.0
		for _, l := range logs {
			runningBalance += l.SystemAmount
			txType := "INCOME"
			if l.SystemAmount < 0 {
				txType = "PAYOUT"
			}
			txs = append(txs, TransactionResp{
				ID:           l.ID.String(),
				Type:         txType,
				Amount:       l.SystemAmount,
				Description:  l.Description,
				BalanceAfter: runningBalance,
				CreatedAt:    l.CreatedAt,
			})
		}
	}

	// Reverse to show latest first
	for i, j := 0, len(txs)-1; i < j; i, j = i+1, j-1 {
		txs[i], txs[j] = txs[j], txs[i]
	}

	c.JSON(http.StatusOK, txs)
}

// GET /api/settings/payout
func (ctrl *BalanceWithdrawalController) GetPayoutSetting(c *gin.Context) {
	role := c.GetInt("role")
	if role < 30 {
		c.JSON(http.StatusForbidden, gin.H{"error": "Forbidden: Insufficient permissions"})
		return
	}

	db := lmsDB(c, ctrl.DB)
	userIDStr := c.GetString("id")
	userID, err := uuid.Parse(userIDStr)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User ID tidak valid"})
		return
	}

	var profile model.Profile
	_ = db.First(&profile, "user_id = ?", userID).Error

	c.JSON(http.StatusOK, gin.H{
		"bank_name":           profile.BankName,
		"bank_account_number": profile.BankAccountNumber,
		"bank_account_name":   profile.BankAccountName,
	})
}

// POST /api/settings/payout
func (ctrl *BalanceWithdrawalController) UpdatePayoutSetting(c *gin.Context) {
	role := c.GetInt("role")
	if role < 30 {
		c.JSON(http.StatusForbidden, gin.H{"error": "Forbidden: Insufficient permissions"})
		return
	}

	var req struct {
		BankName          string `json:"bank_name" binding:"required"`
		BankAccountNumber string `json:"bank_account_number" binding:"required"`
		BankAccountName   string `json:"bank_account_name" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Data rekening tidak lengkap"})
		return
	}

	db := lmsDB(c, ctrl.DB)
	userIDStr := c.GetString("id")
	userID, err := uuid.Parse(userIDStr)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User ID tidak valid"})
		return
	}

	tenantVal, _ := c.Get(common.CtxTenantKey)
	tenant := tenantVal.(model.Tenant)

	var profile model.Profile
	err = db.Where("user_id = ?", userID).First(&profile).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			profile = model.Profile{
				UserID:            userID,
				FullName:          c.GetString("username"),
				BankName:          req.BankName,
				BankAccountNumber: req.BankAccountNumber,
				BankAccountName:   req.BankAccountName,
				TenantID:          &tenant.ID,
			}
			if err := db.Create(&profile).Error; err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
				return
			}
		} else {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
	} else {
		if err := db.Model(&profile).Updates(map[string]interface{}{
			"bank_name":           req.BankName,
			"bank_account_number": req.BankAccountNumber,
			"bank_account_name":   req.BankAccountName,
		}).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"message":             "Detail rekening berhasil disimpan",
		"bank_name":           req.BankName,
		"bank_account_number": req.BankAccountNumber,
		"bank_account_name":   req.BankAccountName,
	})
}
