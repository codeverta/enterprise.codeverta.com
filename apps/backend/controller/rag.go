package controller

import (
	"context"
	"database/sql/driver"
	"errors"
	"fmt"
	"net"
	"net/http"
	"regexp"
	"sort"
	"strings"
	"time"
	"unicode/utf8"

	"gin-template/model"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"go.uber.org/zap"
	"gorm.io/gorm"
)

const (
	maxRAGDocumentRunes = 200_000
	ragChunkRunes       = 1_600
	ragChunkOverlap     = 180
	maxRAGQueryRunes    = 4_000
	maxRAGContextTokens = 6_000
)

var ragWordPattern = regexp.MustCompile(`[\pL\pN]+`)

type ragDocumentRequest struct {
	Title         string   `json:"title" binding:"required"`
	SourceURL     string   `json:"source_url"`
	Content       string   `json:"content" binding:"required"`
	AudienceRoles []string `json:"audience_roles"`
	IsActive      *bool    `json:"is_active"`
}

type ragRetrievedChunk struct {
	DocumentID uuid.UUID `json:"document_id"`
	Title      string    `json:"title"`
	SourceURL  string    `json:"source_url"`
	Content    string    `json:"content"`
	Score      float64   `json:"-"`
}

type ragContext struct {
	Text         string
	Sources      []map[string]string
	TokenCount   int
	Found        bool
	AudienceRole string
}

func ListRAGDocuments(c *gin.Context) {
	tenant, ok := currentTenant(c)
	if !ok {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "Gagal memuat dokumentasi"})
		return
	}
	var documents []model.RAGDocument
	err := scopedCleanDB(c).Where("tenant_id = ?", tenant.ID).
		Order("updated_at DESC").Find(&documents).Error
	if err != nil {
		zap.L().Error("Gagal memuat dokumen RAG", zap.Error(err), zap.String("tenant_id", tenant.ID.String()))
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "Gagal memuat dokumentasi"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "data": documents})
}

func CreateRAGDocument(c *gin.Context) {
	upsertRAGDocument(c, uuid.Nil)
}

func UpdateRAGDocument(c *gin.Context) {
	documentID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "ID dokumentasi tidak valid"})
		return
	}
	upsertRAGDocument(c, documentID)
}

func upsertRAGDocument(c *gin.Context, documentID uuid.UUID) {
	userID, ok := currentUserID(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"success": false, "message": "Unauthorized"})
		return
	}
	tenant, ok := currentTenant(c)
	if !ok {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "Gagal menyimpan dokumentasi"})
		return
	}
	var req ragDocumentRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "Judul dan isi dokumentasi wajib diisi"})
		return
	}
	req.Title = cleanPlainText(req.Title, 220)
	req.SourceURL = cleanPlainText(req.SourceURL, 1000)
	req.Content = cleanDocumentText(req.Content)
	audienceRoles := normalizeRAGAudienceRoles(req.AudienceRoles)
	if req.Title == "" || req.Content == "" {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "Judul dan isi dokumentasi wajib diisi"})
		return
	}
	if len(audienceRoles) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "Pilih minimal satu role yang boleh mengakses dokumentasi"})
		return
	}
	if utf8.RuneCountInString(req.Content) > maxRAGDocumentRunes {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "Dokumentasi maksimal 200.000 karakter"})
		return
	}
	chunks := splitRAGChunks(req.Content)
	isActive := true
	if req.IsActive != nil {
		isActive = *req.IsActive
	}

	database := scopedCleanDB(c)
	var saved model.RAGDocument
	err := database.Transaction(func(tx *gorm.DB) error {
		if documentID == uuid.Nil {
			saved = model.RAGDocument{Title: req.Title, SourceURL: req.SourceURL, Content: req.Content,
				AudienceRoles: strings.Join(audienceRoles, ","), IsActive: isActive, CreatedByID: userID,
				ChunkCount: len(chunks), TenantID: &tenant.ID}
			if err := tx.Create(&saved).Error; err != nil {
				return err
			}
		} else {
			if err := tx.Where("id = ? AND tenant_id = ?", documentID, tenant.ID).First(&saved).Error; err != nil {
				return err
			}
			if err := tx.Model(&saved).Updates(map[string]interface{}{
				"title": req.Title, "source_url": req.SourceURL, "content": req.Content,
				"audience_roles": strings.Join(audienceRoles, ","), "is_active": isActive, "chunk_count": len(chunks),
			}).Error; err != nil {
				return err
			}
			if err := tx.Where("document_id = ? AND tenant_id = ?", saved.ID, tenant.ID).
				Delete(&model.RAGDocumentChunk{}).Error; err != nil {
				return err
			}
		}
		rows := make([]model.RAGDocumentChunk, 0, len(chunks))
		for index, content := range chunks {
			rows = append(rows, model.RAGDocumentChunk{DocumentID: saved.ID, ChunkIndex: index,
				Content: content, TokenEstimate: estimateTokens(content), TenantID: &tenant.ID})
		}
		return tx.Create(&rows).Error
	})
	if err != nil {
		zap.L().Error("Gagal menyimpan dokumen RAG", zap.Error(err), zap.String("document_id", documentID.String()), zap.String("tenant_id", tenant.ID.String()))
		if errors.Is(err, gorm.ErrRecordNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"success": false, "message": "Dokumentasi tidak ditemukan"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "Gagal menyimpan dokumentasi"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "data": saved})
}

func DeleteRAGDocument(c *gin.Context) {
	documentID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "ID dokumentasi tidak valid"})
		return
	}
	tenant, ok := currentTenant(c)
	if !ok {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "Gagal menghapus dokumentasi"})
		return
	}
	result := scopedCleanDB(c).Where("id = ? AND tenant_id = ?", documentID, tenant.ID).Delete(&model.RAGDocument{})
	if result.Error != nil {
		zap.L().Error("Gagal menghapus dokumen RAG", zap.Error(result.Error), zap.String("document_id", documentID.String()))
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "Gagal menghapus dokumentasi"})
		return
	}
	if result.RowsAffected == 0 {
		c.JSON(http.StatusNotFound, gin.H{"success": false, "message": "Dokumentasi tidak ditemukan"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "message": "Dokumentasi berhasil dihapus"})
}

// AppGuideAIHistory returns the user's persistent, lesson-independent RAG chat.
func AppGuideAIHistory(c *gin.Context) {
	userID, ok := currentUserID(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"success": false, "message": "Unauthorized"})
		return
	}
	tenant, ok := currentTenant(c)
	if !ok {
		c.JSON(http.StatusForbidden, gin.H{"success": false, "message": "Tenant tidak valid"})
		return
	}
	database := scopedCleanDB(c)
	var conversation model.ChatConversation
	err := database.Where("tenant_id = ? AND sender_id = ? AND lesson_id IS NULL AND receiver_role = ?",
		tenant.ID, userID, model.ChatReceiverAI).Order("COALESCE(last_message_at, created_at) DESC").First(&conversation).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		c.JSON(http.StatusOK, gin.H{"success": true, "data": gin.H{"conversation": nil, "messages": []model.ChatMessage{}}})
		return
	}
	if err != nil {
		zap.L().Error("Gagal memuat history panduan AI", zap.Error(err), zap.String("user_id", userID.String()))
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "Gagal memuat history AI"})
		return
	}
	var messages []model.ChatMessage
	if err := database.Where("conversation_id = ?", conversation.ID).Order("created_at ASC").Find(&messages).Error; err != nil {
		zap.L().Error("Gagal memuat pesan panduan AI", zap.Error(err), zap.String("conversation_id", conversation.ID.String()))
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "Gagal memuat pesan AI"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "data": gin.H{"conversation": conversation, "messages": messages}})
}

// AppGuideAIChat answers application-usage questions from the MariaDB RAG store
// without requiring a lesson attachment.
func AppGuideAIChat(c *gin.Context) {
	userID, ok := currentUserID(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"success": false, "message": "Unauthorized"})
		return
	}
	var req LessonAIChatRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "Pertanyaan wajib diisi"})
		return
	}
	message := cleanPlainText(req.Message, maxRAGQueryRunes)
	if message == "" {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "Pertanyaan tidak boleh kosong"})
		return
	}
	if len([]rune(req.Message)) > maxRAGQueryRunes {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "Pertanyaan maksimal 4.000 karakter"})
		return
	}
	tenant, ok := currentTenant(c)
	if !ok {
		c.JSON(http.StatusForbidden, gin.H{"success": false, "message": "Tenant tidak valid"})
		return
	}
	database := scopedCleanDB(c)
	var usage *model.AIChatDailyUsage
	var usageResetAt time.Time
	quotaCommitted := false
	if currentUserRole(c) == model.LMSRoleStudent {
		reservedUsage, resetAt, reserved, err := reserveAIUsage(database, userID, time.Now())
		if err != nil {
			zap.L().Error("Gagal memeriksa quota panduan AI", zap.Error(err), zap.String("user_id", userID.String()))
			c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "Gagal memeriksa limit chat AI"})
			return
		}
		if !reserved {
			c.JSON(http.StatusTooManyRequests, gin.H{"success": false, "message": "Limit chat AI harian sudah tercapai.", "data": gin.H{"ai_usage": aiUsagePayload(reservedUsage, resetAt)}})
			return
		}
		usage, usageResetAt = &reservedUsage, resetAt
		defer func() {
			if !quotaCommitted {
				refundAIUsage(database, usage.ID)
			}
		}()
	}

	conversation, err := ensureAppGuideAIConversation(c, userID, tenant.ID, req.ConversationID, req.NewConversation)
	if err != nil {
		zap.L().Error("Gagal menyiapkan conversation panduan AI", zap.Error(err), zap.String("user_id", userID.String()))
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "Gagal menyiapkan history AI"})
		return
	}
	userMessage := model.ChatMessage{ConversationID: conversation.ID, SenderID: userID, SenderName: currentUserName(c),
		SenderRole: currentUserRole(c), Body: message, IsRead: true, TenantID: &tenant.ID}
	if userMessage.SenderName == "" {
		userMessage.SenderName = "Saya"
	}
	if err := database.Create(&userMessage).Error; err != nil {
		zap.L().Error("Gagal menyimpan pertanyaan panduan AI", zap.Error(err), zap.String("conversation_id", conversation.ID.String()))
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "Gagal menyimpan pertanyaan AI"})
		return
	}
	questionAt := time.Now()
	if err := database.Model(&conversation).Updates(map[string]interface{}{
		"last_message": truncate(message, 120), "last_message_at": &questionAt,
	}).Error; err != nil {
		zap.L().Warn("Gagal memperbarui preview pertanyaan panduan AI", zap.Error(err), zap.String("conversation_id", conversation.ID.String()))
	}
	var history []model.ChatMessage
	if err := database.Where("conversation_id = ? AND id != ?", conversation.ID, userMessage.ID).
		Order("created_at ASC").Limit(20).Find(&history).Error; err != nil {
		zap.L().Error("Gagal memuat history panduan AI", zap.Error(err), zap.String("conversation_id", conversation.ID.String()))
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "Gagal memproses pertanyaan AI"})
		return
	}
	retrieved, err := retrieveRAGContext(c.Request.Context(), database, tenant.ID, currentRAGAudienceRole(c), message)
	if err != nil {
		zap.L().Error("Retrieval panduan RAG gagal", zap.Error(err), zap.String("tenant_id", tenant.ID.String()))
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "Gagal memproses pertanyaan AI"})
		return
	}
	answer, err := callDeepSeekLessonAssistant(c.Request.Context(), "", retrieved, true, message, history)
	if err != nil {
		zap.L().Error("DeepSeek panduan aplikasi gagal", zap.Error(err), zap.String("user_id", userID.String()))
		c.JSON(http.StatusBadGateway, gin.H{"success": false, "message": "AI sedang tidak bisa menjawab. Coba lagi sebentar ya."})
		return
	}
	assistantMessage := model.ChatMessage{ConversationID: conversation.ID, SenderID: userID, SenderName: "AI Assistant",
		SenderRole: model.LMSRole("ai"), Body: answer, IsRead: true, TenantID: &tenant.ID}
	if err := database.Create(&assistantMessage).Error; err != nil {
		zap.L().Error("Gagal menyimpan jawaban panduan AI", zap.Error(err), zap.String("conversation_id", conversation.ID.String()))
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "Gagal menyimpan jawaban AI"})
		return
	}
	now := time.Now()
	if err := database.Model(&conversation).Updates(map[string]interface{}{"last_message": truncate(answer, 120), "last_message_at": &now}).Error; err != nil {
		zap.L().Warn("Gagal memperbarui preview conversation panduan AI", zap.Error(err), zap.String("conversation_id", conversation.ID.String()))
	}
	quotaCommitted = true
	c.JSON(http.StatusOK, gin.H{"success": true, "data": gin.H{"answer": answer, "conversation_id": conversation.ID,
		"conversation": conversation, "user_message": userMessage, "assistant_message": assistantMessage, "rag_sources": retrieved.Sources,
		"ai_usage": aiUsagePayloadOrNil(usage, usageResetAt)}})
}

func ensureAppGuideAIConversation(c *gin.Context, userID, tenantID uuid.UUID, requestedID *string, forceNew bool) (model.ChatConversation, error) {
	database := scopedCleanDB(c)
	var conversation model.ChatConversation
	if requestedID != nil && strings.TrimSpace(*requestedID) != "" {
		conversationID, err := uuid.Parse(strings.TrimSpace(*requestedID))
		if err != nil {
			return conversation, fmt.Errorf("invalid AI conversation id")
		}
		err = database.Where("id = ? AND tenant_id = ? AND sender_id = ? AND lesson_id IS NULL AND receiver_role = ?",
			conversationID, tenantID, userID, model.ChatReceiverAI).First(&conversation).Error
		return conversation, err
	}
	if !forceNew {
		err := database.Where("tenant_id = ? AND sender_id = ? AND lesson_id IS NULL AND receiver_role = ?",
			tenantID, userID, model.ChatReceiverAI).Order("COALESCE(last_message_at, created_at) DESC").First(&conversation).Error
		if err == nil {
			return conversation, nil
		}
		if !errors.Is(err, gorm.ErrRecordNotFound) {
			return conversation, err
		}
	}
	conversation = model.ChatConversation{SenderID: userID, TenantID: &tenantID, Title: "Panduan Penggunaan Aplikasi",
		Status: model.ChatConversationOpen, ReceiverRole: model.ChatReceiverAI}
	return conversation, database.Create(&conversation).Error
}

func cleanPlainText(value string, maxRunes int) string {
	value = strings.Map(func(r rune) rune {
		if r < 32 && r != '\n' && r != '\t' {
			return -1
		}
		return r
	}, strings.TrimSpace(value))
	runes := []rune(value)
	if len(runes) > maxRunes {
		return string(runes[:maxRunes])
	}
	return value
}

func cleanDocumentText(value string) string {
	value = strings.ReplaceAll(value, "\x00", "")
	value = strings.ReplaceAll(value, "\r\n", "\n")
	return strings.TrimSpace(value)
}

func splitRAGChunks(content string) []string {
	runes := []rune(content)
	if len(runes) == 0 {
		return nil
	}
	chunks := make([]string, 0, len(runes)/ragChunkRunes+1)
	for start := 0; start < len(runes); {
		end := start + ragChunkRunes
		if end >= len(runes) {
			end = len(runes)
		} else {
			floor := start + ragChunkRunes/2
			for cursor := end; cursor > floor; cursor-- {
				if runes[cursor-1] == '\n' || runes[cursor-1] == '.' || runes[cursor-1] == '!' || runes[cursor-1] == '?' {
					end = cursor
					break
				}
			}
		}
		chunk := strings.TrimSpace(string(runes[start:end]))
		if chunk != "" {
			chunks = append(chunks, chunk)
		}
		if end == len(runes) {
			break
		}
		start = end - ragChunkOverlap
		if start < 0 {
			start = 0
		}
	}
	return chunks
}

func currentRAGAudienceRole(c *gin.Context) string {
	raw, exists := c.Get("role")
	if !exists {
		return string(model.LMSRoleStudent)
	}
	if roleInt, ok := raw.(int); ok {
		switch {
		case roleInt >= model.RoleSuperAdmin:
			return "superadmin"
		case roleInt >= model.RoleAdmin:
			return string(model.LMSRoleAdmin)
		case roleInt == model.RoleMentor:
			return string(model.LMSRoleMentor)
		case roleInt == model.RoleParent:
			return string(model.LMSRoleParent)
		default:
			return string(model.LMSRoleStudent)
		}
	}
	if roleString, ok := raw.(string); ok {
		roles := normalizeRAGAudienceRoles([]string{roleString})
		if len(roles) > 0 {
			return roles[0]
		}
	}
	return string(model.LMSRoleStudent)
}

func normalizeRAGAudienceRoles(values []string) []string {
	allowed := map[string]bool{
		string(model.LMSRoleStudent): true,
		string(model.LMSRoleParent):  true,
		string(model.LMSRoleMentor):  true,
		string(model.LMSRoleAdmin):   true,
		"superadmin":                 true,
	}
	seen := map[string]bool{}
	roles := make([]string, 0, len(values))
	for _, value := range values {
		normalized := strings.ToLower(strings.TrimSpace(value))
		switch normalized {
		case "role_student", "20":
			normalized = string(model.LMSRoleStudent)
		case "role_parent", "10":
			normalized = string(model.LMSRoleParent)
		case "teacher", "instructor", "30":
			normalized = string(model.LMSRoleMentor)
		case "99":
			normalized = string(model.LMSRoleAdmin)
		case "100":
			normalized = "superadmin"
		}
		if !allowed[normalized] || seen[normalized] {
			continue
		}
		seen[normalized] = true
		roles = append(roles, normalized)
	}
	sort.SliceStable(roles, func(i, j int) bool {
		order := map[string]int{string(model.LMSRoleStudent): 1, string(model.LMSRoleParent): 2, string(model.LMSRoleMentor): 3, string(model.LMSRoleAdmin): 4, "superadmin": 5}
		return order[roles[i]] < order[roles[j]]
	})
	return roles
}

func ragAudienceScope(db *gorm.DB, role string) *gorm.DB {
	if role == "superadmin" {
		return db
	}
	return db.Where("d.audience_roles <> '' AND FIND_IN_SET(?, d.audience_roles) > 0", role)
}

func retrieveRAGContext(ctx context.Context, db *gorm.DB, tenantID uuid.UUID, audienceRole string, query string) (ragContext, error) {
	audienceRole = strings.TrimSpace(audienceRole)
	if audienceRole == "" {
		audienceRole = string(model.LMSRoleStudent)
	}
	query = cleanPlainText(query, maxRAGQueryRunes)
	if query == "" {
		return ragContext{AudienceRole: audienceRole}, nil
	}
	var chunks []ragRetrievedChunk
	fullTextSQL := `SELECT c.document_id, d.title, d.source_url, c.content,
		MATCH(c.content) AGAINST (? IN NATURAL LANGUAGE MODE) AS score
		FROM rag_document_chunks c JOIN rag_documents d ON d.id = c.document_id
		WHERE c.tenant_id = ? AND d.tenant_id = ? AND d.is_active = 1
		AND d.deleted_at IS NULL AND %s AND MATCH(c.content) AGAINST (? IN NATURAL LANGUAGE MODE)
		ORDER BY score DESC, c.chunk_index ASC LIMIT 8`
	audienceSQL := "d.audience_roles <> '' AND FIND_IN_SET(?, d.audience_roles) > 0"
	rawArgs := []interface{}{query, tenantID, tenantID, audienceRole, query}
	if audienceRole == "superadmin" {
		audienceSQL = "1 = 1"
		rawArgs = []interface{}{query, tenantID, tenantID, query}
	}
	err := withDBRetry(ctx, func(attemptCtx context.Context) error {
		chunks = nil
		return db.WithContext(attemptCtx).Raw(fmt.Sprintf(fullTextSQL, audienceSQL), rawArgs...).Scan(&chunks).Error
	})
	if err != nil {
		zap.L().Warn("Pencarian FULLTEXT RAG gagal, mencoba keyword fallback", zap.Error(err))
	}
	if len(chunks) == 0 {
		keywords := ragKeywords(query)
		if len(keywords) == 0 {
			return ragContext{AudienceRole: audienceRole}, nil
		}
		fallback := db.Table("rag_document_chunks AS c").
			Select("c.document_id, d.title, d.source_url, c.content, 0 AS score").
			Joins("JOIN rag_documents d ON d.id = c.document_id").
			Where("c.tenant_id = ? AND d.tenant_id = ? AND d.is_active = ? AND d.deleted_at IS NULL", tenantID, tenantID, true)
		fallback = ragAudienceScope(fallback, audienceRole)
		conditions := make([]string, 0, len(keywords))
		arguments := make([]interface{}, 0, len(keywords))
		for _, keyword := range keywords {
			conditions = append(conditions, "LOWER(c.content) LIKE ?")
			arguments = append(arguments, "%"+strings.ToLower(keyword)+"%")
		}
		fallback = fallback.Where("("+strings.Join(conditions, " OR ")+")", arguments...)
		err = withDBRetry(ctx, func(attemptCtx context.Context) error {
			chunks = nil
			return fallback.WithContext(attemptCtx).Limit(8).Scan(&chunks).Error
		})
		if err != nil {
			return ragContext{}, err
		}
	}
	retrieved := boundRAGChunks(chunks, maxRAGContextTokens)
	retrieved.AudienceRole = audienceRole
	return retrieved, nil
}

func ragKeywords(query string) []string {
	seen := map[string]bool{}
	words := ragWordPattern.FindAllString(strings.ToLower(query), -1)
	keywords := make([]string, 0, 6)
	for _, word := range words {
		if utf8.RuneCountInString(word) < 3 || seen[word] {
			continue
		}
		seen[word] = true
		keywords = append(keywords, word)
		if len(keywords) == 6 {
			break
		}
	}
	return keywords
}

func boundRAGChunks(chunks []ragRetrievedChunk, maxTokens int) ragContext {
	if len(chunks) == 0 || maxTokens <= 0 {
		return ragContext{}
	}
	var builder strings.Builder
	sources := make(map[uuid.UUID]map[string]string)
	tokens := 0
	for index, chunk := range chunks {
		header := fmt.Sprintf("[Document %d: %s]\n", index+1, chunk.Title)
		remaining := maxTokens - tokens - estimateTokens(header) - 2 // trailing separators
		if remaining <= 0 {
			break
		}
		content := truncateToTokens(chunk.Content, remaining)
		if content == "" {
			break
		}
		piece := header + content + "\n\n"
		pieceTokens := estimateTokens(piece)
		if tokens+pieceTokens > maxTokens {
			break
		}
		builder.WriteString(piece)
		tokens += pieceTokens
		sources[chunk.DocumentID] = map[string]string{"id": chunk.DocumentID.String(), "title": chunk.Title, "source_url": chunk.SourceURL}
	}
	resultSources := make([]map[string]string, 0, len(sources))
	for _, source := range sources {
		resultSources = append(resultSources, source)
	}
	sort.Slice(resultSources, func(i, j int) bool { return resultSources[i]["title"] < resultSources[j]["title"] })
	text := strings.TrimSpace(builder.String())
	return ragContext{Text: text, Sources: resultSources, TokenCount: tokens, Found: text != ""}
}

func estimateTokens(value string) int {
	// A conservative language-agnostic estimate. Three Unicode code points per
	// token leaves more headroom than the common four-character approximation.
	count := utf8.RuneCountInString(value)
	return (count + 2) / 3
}

func truncateToTokens(value string, maxTokens int) string {
	if maxTokens <= 0 {
		return ""
	}
	runes := []rune(value)
	maxRunes := maxTokens * 3
	if len(runes) > maxRunes {
		runes = runes[:maxRunes]
	}
	return strings.TrimSpace(string(runes))
}

func withDBRetry(ctx context.Context, operation func(context.Context) error) error {
	var lastErr error
	for attempt := 1; attempt <= 3; attempt++ {
		attemptCtx, cancel := context.WithTimeout(ctx, 3*time.Second)
		lastErr = operation(attemptCtx)
		cancel()
		if lastErr == nil {
			return nil
		}
		if !isTransientDBError(lastErr) || attempt == 3 {
			return lastErr
		}
		select {
		case <-ctx.Done():
			return ctx.Err()
		case <-time.After(time.Duration(attempt) * 100 * time.Millisecond):
		}
	}
	return lastErr
}

func isTransientDBError(err error) bool {
	if errors.Is(err, driver.ErrBadConn) {
		return true
	}
	var netErr net.Error
	if errors.As(err, &netErr) {
		return true
	}
	message := strings.ToLower(err.Error())
	for _, marker := range []string{"deadlock", "lock wait timeout", "bad connection", "connection reset", "broken pipe"} {
		if strings.Contains(message, marker) {
			return true
		}
	}
	return false
}
