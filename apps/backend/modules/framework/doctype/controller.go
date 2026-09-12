package doctype

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"strconv"
	"strings"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

type Controller struct {
	Registry *Registry
	Service  *Service
}

// Schema exposes the read-only database structure used by the Desk DocType browser.
func (controller *Controller) Schema(ctx *gin.Context) {
	tables, err := controller.Service.DB.Migrator().GetTables()
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal membaca struktur database"})
		return
	}
	search := strings.ToLower(strings.TrimSpace(ctx.Query("q")))
	type columnInfo struct {
		Name       string  `json:"name"`
		Type       string  `json:"type"`
		Nullable   bool    `json:"nullable"`
		PrimaryKey bool    `json:"primary_key"`
		Default    *string `json:"default"`
	}
	type tableInfo struct {
		Name    string       `json:"name"`
		Columns []columnInfo `json:"columns"`
	}
	result := make([]tableInfo, 0, len(tables))
	for _, table := range tables {
		if search != "" && !strings.Contains(strings.ToLower(table), search) {
			continue
		}
		columns, err := controller.Service.DB.Migrator().ColumnTypes(table)
		if err != nil {
			continue
		}
		info := tableInfo{Name: table, Columns: make([]columnInfo, 0, len(columns))}
		for _, column := range columns {
			nullable, _ := column.Nullable()
			primary, _ := column.PrimaryKey()
			defaultValue, hasDefault := column.DefaultValue()
			var defaultPtr *string
			if hasDefault {
				defaultPtr = &defaultValue
			}
			typeName := column.DatabaseTypeName()
			if typeName == "" {
				typeName, _ = column.ColumnType()
			}
			info.Columns = append(info.Columns, columnInfo{Name: column.Name(), Type: typeName, Nullable: nullable, PrimaryKey: primary, Default: defaultPtr})
		}
		result = append(result, info)
	}
	ctx.JSON(http.StatusOK, gin.H{"data": result})
}

func NewController(registry *Registry, db *gorm.DB) *Controller {
	return &Controller{Registry: registry, Service: NewService(db)}
}

func (controller *Controller) definition(ctx *gin.Context) (Definition, bool) {
	definition, found := controller.Registry.Get(ctx.Param("doctype"))
	if !found {
		ctx.JSON(http.StatusNotFound, gin.H{"error": "DocType tidak terdaftar"})
	}
	return definition, found
}

func tenant(ctx *gin.Context) string { return strings.TrimSpace(ctx.GetString("tenant_id")) }

func requestContext(ctx *gin.Context) context.Context {
	requestContext := ctx.Request.Context()
	if actor, exists := ctx.Get("id"); exists {
		requestContext = context.WithValue(requestContext, "id", actor)
	}
	return requestContext
}

func respondError(ctx *gin.Context, err error) {
	switch {
	case errors.Is(err, ErrNotFound):
		ctx.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
	case errors.Is(err, ErrVersionConflict):
		ctx.JSON(http.StatusConflict, gin.H{"error": err.Error(), "code": "VERSION_CONFLICT"})
	case errors.Is(err, ErrNotDraft), errors.Is(err, ErrNotSubmitted), errors.Is(err, ErrNotCancelled), errors.Is(err, ErrNotSubmittable):
		ctx.JSON(http.StatusUnprocessableEntity, gin.H{"error": err.Error()})
	default:
		ctx.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
	}
}

func (controller *Controller) Definitions(ctx *gin.Context) {
	ctx.JSON(http.StatusOK, gin.H{"data": controller.Registry.Names()})
}

func (controller *Controller) List(ctx *gin.Context) {
	definition, ok := controller.definition(ctx)
	if !ok {
		return
	}
	page, _ := strconv.Atoi(ctx.DefaultQuery("page", "1"))
	limit, _ := strconv.Atoi(ctx.DefaultQuery("limit", "50"))
	if page < 1 {
		page = 1
	}
	if limit < 1 || limit > 200 {
		limit = 50
	}
	collection := definition.NewCollection()
	query := controller.Service.DB.WithContext(requestContext(ctx)).Model(definition.Model).Where("tenant_id = ?", tenant(ctx))
	if status := strings.TrimSpace(ctx.Query("doc_status")); status != "" {
		if value, err := strconv.Atoi(status); err == nil {
			query = query.Where("doc_status = ?", value)
		}
	}
	if search := strings.TrimSpace(ctx.Query("q")); search != "" && len(definition.SearchFields) > 0 {
		conditions := make([]string, 0, len(definition.SearchFields))
		values := make([]any, 0, len(definition.SearchFields))
		for _, field := range definition.SearchFields {
			conditions = append(conditions, fmt.Sprintf("%s LIKE ?", field))
			values = append(values, "%"+search+"%")
		}
		query = query.Where("("+strings.Join(conditions, " OR ")+")", values...)
	}
	var total int64
	if err := query.Count(&total).Error; err != nil {
		respondError(ctx, err)
		return
	}
	if err := query.Order("updated_at desc").Offset((page - 1) * limit).Limit(limit).Find(collection).Error; err != nil {
		respondError(ctx, err)
		return
	}
	ctx.JSON(http.StatusOK, gin.H{"data": collection, "meta": gin.H{"page": page, "limit": limit, "total": total}})
}

func (controller *Controller) Get(ctx *gin.Context) {
	definition, ok := controller.definition(ctx)
	if !ok {
		return
	}
	document, err := controller.Service.load(controller.Service.DB.WithContext(requestContext(ctx)), definition, tenant(ctx), ctx.Param("id"))
	if err != nil {
		respondError(ctx, err)
		return
	}
	ctx.JSON(http.StatusOK, document)
}

func (controller *Controller) Create(ctx *gin.Context) {
	definition, ok := controller.definition(ctx)
	if !ok {
		return
	}
	document := definition.New()
	if err := ctx.ShouldBindJSON(document); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "Payload dokumen tidak valid"})
		return
	}
	if err := controller.Service.CreateDraft(requestContext(ctx), definition, tenant(ctx), document); err != nil {
		respondError(ctx, err)
		return
	}
	ctx.JSON(http.StatusCreated, document)
}

func (controller *Controller) Save(ctx *gin.Context) {
	definition, ok := controller.definition(ctx)
	if !ok {
		return
	}
	document := definition.New()
	if err := ctx.ShouldBindJSON(document); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "Payload dokumen tidak valid"})
		return
	}
	if err := controller.Service.SaveDraft(requestContext(ctx), definition, tenant(ctx), ctx.Param("id"), document); err != nil {
		respondError(ctx, err)
		return
	}
	ctx.JSON(http.StatusOK, document)
}

func (controller *Controller) Submit(ctx *gin.Context) {
	controller.transition(ctx, "submit")
}

func (controller *Controller) Cancel(ctx *gin.Context) {
	controller.transition(ctx, "cancel")
}

func (controller *Controller) Amend(ctx *gin.Context) {
	controller.transition(ctx, "amend")
}

func (controller *Controller) transition(ctx *gin.Context, action string) {
	definition, ok := controller.definition(ctx)
	if !ok {
		return
	}
	var document Document
	var err error
	switch action {
	case "submit":
		document, err = controller.Service.Submit(requestContext(ctx), definition, tenant(ctx), ctx.Param("id"))
	case "cancel":
		document, err = controller.Service.Cancel(requestContext(ctx), definition, tenant(ctx), ctx.Param("id"))
	case "amend":
		document, err = controller.Service.Amend(requestContext(ctx), definition, tenant(ctx), ctx.Param("id"))
	}
	if err != nil {
		respondError(ctx, err)
		return
	}
	ctx.JSON(http.StatusOK, document)
}

func (controller *Controller) Revisions(ctx *gin.Context) {
	definition, ok := controller.definition(ctx)
	if !ok {
		return
	}
	rows, err := controller.Service.Revisions(requestContext(ctx), definition, tenant(ctx), ctx.Param("id"))
	if err != nil {
		respondError(ctx, err)
		return
	}
	ctx.JSON(http.StatusOK, gin.H{"data": rows})
}
