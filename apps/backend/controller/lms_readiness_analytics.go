package controller

import (
	"context"
	"crypto/sha256"
	"encoding/json"
	"fmt"
	"gin-template/common"
	"gin-template/model"
	"net/http"
	"os"
	"sort"
	"strings"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
)

type readinessCountDatum struct {
	Label      string  `json:"label"`
	Count      int     `json:"count"`
	Percentage float64 `json:"percentage"`
}

type readinessDimensionDatum struct {
	Key           string  `json:"key"`
	Label         string  `json:"label"`
	Average       float64 `json:"average"`
	ResponseCount int     `json:"response_count"`
}

type readinessTrendDatum struct {
	Date         string  `json:"date"`
	Completed    int     `json:"completed"`
	AverageScore float64 `json:"average_score"`
}

type readinessAnalytics struct {
	Summary struct {
		TotalStarted       int     `json:"total_started"`
		Completed          int     `json:"completed"`
		Drafts             int     `json:"drafts"`
		CompletionRate     float64 `json:"completion_rate"`
		AverageParentScore float64 `json:"average_parent_score"`
	} `json:"summary"`
	ReadinessDistribution  []readinessCountDatum     `json:"readiness_distribution"`
	RespondentDistribution []readinessCountDatum     `json:"respondent_distribution"`
	DimensionScores        []readinessDimensionDatum `json:"dimension_scores"`
	Trend                  []readinessTrendDatum     `json:"trend"`
	StrongestDimension     *readinessDimensionDatum  `json:"strongest_dimension,omitempty"`
	WeakestDimension       *readinessDimensionDatum  `json:"weakest_dimension,omitempty"`
}

var readinessDimensionLabels = map[string]string{
	"psikologis":     "Kesiapan psikologis",
	"waktu":          "Ketersediaan waktu",
	"finansial":      "Kesiapan finansial",
	"lingkungan":     "Lingkungan belajar",
	"dukungan":       "Dukungan keluarga",
	"komitmen":       "Komitmen orang tua",
	"pemahaman":      "Pemahaman homeschooling",
	"teknologi":      "Kesiapan teknologi",
	"sosialisasi":    "Rencana sosialisasi",
	"tujuan_belajar": "Tujuan belajar",
}

const readinessInterpretationCacheTTL = 7 * 24 * time.Hour

type readinessLocalCacheEntry struct {
	Interpretation readinessAIInterpretation
	ExpiresAt      time.Time
}

var readinessInterpretationLocalCache sync.Map

func readinessPercentage(count, total int) float64 {
	if total == 0 {
		return 0
	}
	return float64(int((float64(count)/float64(total))*1000+0.5)) / 10
}

func buildReadinessAnalytics(c *gin.Context, ctrl *LMSController) (readinessAnalytics, error) {
	var analytics readinessAnalytics
	analytics.ReadinessDistribution = make([]readinessCountDatum, 0)
	analytics.RespondentDistribution = make([]readinessCountDatum, 0)
	analytics.DimensionScores = make([]readinessDimensionDatum, 0)
	analytics.Trend = make([]readinessTrendDatum, 0)

	db := lmsDB(c, ctrl.DB).Model(&model.ReadinessResponse{})
	if testType := strings.TrimSpace(c.Query("test_type")); testType != "" {
		db = db.Where("test_type = ?", testType)
	}
	if respondentType := strings.TrimSpace(c.Query("respondent_type")); respondentType != "" {
		db = db.Where("respondent_type = ?", respondentType)
	}

	var rows []model.ReadinessResponse
	if err := db.Find(&rows).Error; err != nil {
		return analytics, err
	}

	analytics.Summary.TotalStarted = len(rows)
	readinessCounts := map[string]int{}
	respondentCounts := map[string]int{}
	dimensionTotals := map[string]float64{}
	dimensionCounts := map[string]int{}
	type trendAccumulator struct {
		completed  int
		scoreTotal int
		scoreCount int
	}
	trends := map[string]*trendAccumulator{}
	parentScoreTotal := 0
	parentScoreCount := 0
	parentCompleted := 0

	for _, row := range rows {
		if row.Status == "draft" {
			analytics.Summary.Drafts++
			continue
		}
		analytics.Summary.Completed++
		respondentCounts[row.RespondentType]++

		date := row.CreatedAt.In(time.Local).Format("2006-01-02")
		if row.CompletedAt != nil {
			date = row.CompletedAt.In(time.Local).Format("2006-01-02")
		}
		if trends[date] == nil {
			trends[date] = &trendAccumulator{}
		}
		trends[date].completed++

		if row.TestType == model.ReadinessTestParent {
			parentCompleted++
			readinessCounts[row.ResultLabel]++
			parentScoreTotal += row.Score
			parentScoreCount++
			trends[date].scoreTotal += row.Score
			trends[date].scoreCount++

			var result struct {
				DimensionScores map[string]float64 `json:"dimension_scores"`
			}
			if json.Unmarshal(row.Result, &result) == nil {
				for key, score := range result.DimensionScores {
					dimensionTotals[key] += score
					dimensionCounts[key]++
				}
			}
		}
	}

	analytics.Summary.CompletionRate = readinessPercentage(analytics.Summary.Completed, analytics.Summary.TotalStarted)
	if parentScoreCount > 0 {
		analytics.Summary.AverageParentScore = float64(int((float64(parentScoreTotal)/float64(parentScoreCount))*10+0.5)) / 10
	}

	for label, count := range readinessCounts {
		if label == "" {
			label = "Belum diklasifikasikan"
		}
		analytics.ReadinessDistribution = append(analytics.ReadinessDistribution, readinessCountDatum{
			Label: label, Count: count, Percentage: readinessPercentage(count, parentCompleted),
		})
	}
	sort.Slice(analytics.ReadinessDistribution, func(i, j int) bool {
		if analytics.ReadinessDistribution[i].Count != analytics.ReadinessDistribution[j].Count {
			return analytics.ReadinessDistribution[i].Count > analytics.ReadinessDistribution[j].Count
		}
		return analytics.ReadinessDistribution[i].Label < analytics.ReadinessDistribution[j].Label
	})

	for label, count := range respondentCounts {
		if label == "" {
			label = "Tidak diketahui"
		}
		analytics.RespondentDistribution = append(analytics.RespondentDistribution, readinessCountDatum{
			Label: label, Count: count, Percentage: readinessPercentage(count, analytics.Summary.Completed),
		})
	}
	sort.Slice(analytics.RespondentDistribution, func(i, j int) bool {
		if analytics.RespondentDistribution[i].Count != analytics.RespondentDistribution[j].Count {
			return analytics.RespondentDistribution[i].Count > analytics.RespondentDistribution[j].Count
		}
		return analytics.RespondentDistribution[i].Label < analytics.RespondentDistribution[j].Label
	})

	for key, total := range dimensionTotals {
		count := dimensionCounts[key]
		if count == 0 {
			continue
		}
		label := readinessDimensionLabels[key]
		if label == "" {
			label = key
		}
		analytics.DimensionScores = append(analytics.DimensionScores, readinessDimensionDatum{
			Key: key, Label: label, Average: float64(int((total/float64(count))*10+0.5)) / 10, ResponseCount: count,
		})
	}
	sort.Slice(analytics.DimensionScores, func(i, j int) bool {
		if analytics.DimensionScores[i].Average != analytics.DimensionScores[j].Average {
			return analytics.DimensionScores[i].Average > analytics.DimensionScores[j].Average
		}
		return analytics.DimensionScores[i].Key < analytics.DimensionScores[j].Key
	})
	if len(analytics.DimensionScores) > 0 {
		strongest := analytics.DimensionScores[0]
		weakest := analytics.DimensionScores[len(analytics.DimensionScores)-1]
		analytics.StrongestDimension = &strongest
		analytics.WeakestDimension = &weakest
	}

	for date, item := range trends {
		average := 0.0
		if item.scoreCount > 0 {
			average = float64(int((float64(item.scoreTotal)/float64(item.scoreCount))*10+0.5)) / 10
		}
		analytics.Trend = append(analytics.Trend, readinessTrendDatum{
			Date: date, Completed: item.completed, AverageScore: average,
		})
	}
	sort.Slice(analytics.Trend, func(i, j int) bool {
		return analytics.Trend[i].Date < analytics.Trend[j].Date
	})
	if len(analytics.Trend) > 30 {
		analytics.Trend = analytics.Trend[len(analytics.Trend)-30:]
	}

	return analytics, nil
}

func (ctrl *LMSController) GetReadinessAnalytics(c *gin.Context) {
	analytics, err := buildReadinessAnalytics(c, ctrl)
	if err != nil {
		sendInternalError(c, err)
		return
	}
	sendSuccess(c, analytics, "Readiness analytics retrieved successfully")
}

type readinessAIInterpretation struct {
	Headline       string   `json:"headline"`
	Summary        string   `json:"summary"`
	KeyFindings    []string `json:"key_findings"`
	Actions        []string `json:"actions"`
	DataCaution    string   `json:"data_caution"`
	GeneratedBy    string   `json:"generated_by"`
	GeneratedAt    string   `json:"generated_at"`
	CacheExpiresAt string   `json:"cache_expires_at"`
	Cached         bool     `json:"cached"`
}

func (ctrl *LMSController) InterpretReadinessAnalytics(c *gin.Context) {
	analytics, err := buildReadinessAnalytics(c, ctrl)
	if err != nil {
		sendInternalError(c, err)
		return
	}
	if analytics.Summary.TotalStarted == 0 {
		sendError(c, http.StatusUnprocessableEntity, "Belum ada data yang dapat diinterpretasikan", nil)
		return
	}
	analyticsJSON, err := json.Marshal(analytics)
	if err != nil {
		sendInternalError(c, err)
		return
	}

	tenantValue, exists := c.Get(common.CtxTenantKey)
	tenant, validTenant := tenantValue.(model.Tenant)
	if !exists || !validTenant {
		sendInternalError(c, fmt.Errorf("tenant context is required"))
		return
	}

	forceRefresh := strings.EqualFold(c.Query("force"), "true") || strings.EqualFold(c.Query("refresh"), "true")
	cacheKey := readinessInterpretationCacheKey(tenant.ID.String(), deepSeekModelName(), analyticsJSON)
	if !forceRefresh {
		if cached, ok := getReadinessInterpretationCache(c.Request.Context(), cacheKey); ok {
			cached.Cached = true
			sendSuccess(c, cached, "Cached readiness analytics interpretation retrieved successfully")
			return
		}
	}

	apiKey := strings.TrimSpace(os.Getenv("DEEPSEEK_API_KEY"))
	if apiKey == "" {
		sendError(c, http.StatusServiceUnavailable, "DEEPSEEK_API_KEY belum dikonfigurasi", nil)
		return
	}

	systemPrompt := `Anda adalah analis pendidikan untuk dashboard Homeschooling KITA. Analisis hanya agregat statistik yang diberikan, tanpa menebak data individu atau hubungan sebab-akibat.

Kembalikan JSON valid tanpa markdown dengan bentuk:
{
  "headline": "kesimpulan utama maksimal 12 kata",
  "summary": "interpretasi 2-3 kalimat yang menghubungkan completion, skor, distribusi, dan dimensi",
  "key_findings": ["3 temuan spesifik dengan angka"],
  "actions": ["3 tindakan operasional yang konkret untuk admin"],
  "data_caution": "batasan sampel dan hal yang tidak boleh disimpulkan"
}

Gunakan Bahasa Indonesia, sebutkan angka yang mendukung setiap kesimpulan, dan bedakan korelasi dari kausalitas. Jika sampel kecil, nyatakan secara tegas.`
	messages := []map[string]string{
		{"role": "system", "content": systemPrompt},
		{"role": "user", "content": "<aggregated_readiness_data>\n" + string(analyticsJSON) + "\n</aggregated_readiness_data>"},
	}
	payload, err := json.Marshal(map[string]interface{}{
		"model":       deepSeekModelName(),
		"temperature": 0.2,
		"max_tokens":  900,
		"messages":    messages,
	})
	if err != nil {
		sendInternalError(c, err)
		return
	}

	responseBody, err := doDeepSeekRequest(c.Request.Context(), deepSeekEndpoint(), apiKey, payload)
	if err != nil {
		sendError(c, http.StatusBadGateway, "DeepSeek gagal menginterpretasikan data", nil)
		return
	}
	var deepSeekResponse struct {
		Choices []struct {
			Message struct {
				Content string `json:"content"`
			} `json:"message"`
		} `json:"choices"`
	}
	if err := json.Unmarshal(responseBody, &deepSeekResponse); err != nil || len(deepSeekResponse.Choices) == 0 {
		sendError(c, http.StatusBadGateway, "Respons DeepSeek tidak valid", nil)
		return
	}

	content := strings.TrimSpace(deepSeekResponse.Choices[0].Message.Content)
	content = strings.TrimPrefix(content, "```json")
	content = strings.TrimPrefix(content, "```")
	content = strings.TrimSuffix(content, "```")
	var interpretation readinessAIInterpretation
	if err := json.Unmarshal([]byte(strings.TrimSpace(content)), &interpretation); err != nil {
		sendError(c, http.StatusBadGateway, "Interpretasi DeepSeek tidak dapat dibaca", nil)
		return
	}
	interpretation.GeneratedBy = deepSeekModelName()
	interpretation.GeneratedAt = time.Now().Format(time.RFC3339)
	interpretation.CacheExpiresAt = time.Now().Add(readinessInterpretationCacheTTL).Format(time.RFC3339)
	interpretation.Cached = false
	setReadinessInterpretationCache(c.Request.Context(), cacheKey, interpretation)
	sendSuccess(c, interpretation, "Readiness analytics interpreted successfully")
}

func readinessInterpretationCacheKey(tenantID, modelName string, analyticsJSON []byte) string {
	fingerprint := sha256.Sum256(analyticsJSON)
	return fmt.Sprintf("readiness:interpretation:v1:%s:%s:%x", tenantID, modelName, fingerprint)
}

func getReadinessInterpretationCache(ctx context.Context, key string) (readinessAIInterpretation, bool) {
	var cached readinessAIInterpretation
	if common.GetCache(ctx, key, &cached) {
		return cached, true
	}
	value, ok := readinessInterpretationLocalCache.Load(key)
	if !ok {
		return cached, false
	}
	entry, ok := value.(readinessLocalCacheEntry)
	if !ok || time.Now().After(entry.ExpiresAt) {
		readinessInterpretationLocalCache.Delete(key)
		return cached, false
	}
	return entry.Interpretation, true
}

func setReadinessInterpretationCache(ctx context.Context, key string, interpretation readinessAIInterpretation) {
	readinessInterpretationLocalCache.Store(key, readinessLocalCacheEntry{
		Interpretation: interpretation,
		ExpiresAt:      time.Now().Add(readinessInterpretationCacheTTL),
	})
	_ = common.SetCache(ctx, key, interpretation, readinessInterpretationCacheTTL)
}

func deepSeekEndpoint() string {
	if endpoint := strings.TrimSpace(os.Getenv("DEEPSEEK_API_URL")); endpoint != "" {
		return endpoint
	}
	return "https://api.deepseek.com/chat/completions"
}

func deepSeekModelName() string {
	if modelName := strings.TrimSpace(os.Getenv("DEEPSEEK_MODEL")); modelName != "" {
		return modelName
	}
	return "deepseek-chat"
}
