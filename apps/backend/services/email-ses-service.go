package services

import (
	"encoding/base64"
	"errors"

	"github.com/tencentcloud/tencentcloud-sdk-go/tencentcloud/common"
	"github.com/tencentcloud/tencentcloud-sdk-go/tencentcloud/common/profile"
	ses "github.com/tencentcloud/tencentcloud-sdk-go/tencentcloud/ses/v20201002"
	"go.uber.org/zap"
)

type SESService struct {
	Client *ses.Client
	Logger *zap.Logger
}

var errOfflineService = errors.New("layanan email cloud tidak tersedia dalam mode offline")

func NewOfflineSESService(logger *zap.Logger) *SESService {
	return &SESService{Logger: logger}
}

func (s *SESService) available() error {
	if s == nil || s.Client == nil {
		return errOfflineService
	}
	return nil
}

func mapTencentStatus(status uint64) string {
	switch status {
	case 0:
		return "APPROVED"
	case 1:
		return "PENDING"
	case 2:
		return "REJECTED"
	default:
		return "UNKNOWN"
	}
}

// Init Client: Inject logger di sini agar konsisten dengan aplikasi utama
func NewSESService(secretId, secretKey, region string, logger *zap.Logger) (*SESService, error) {
	cpf := profile.NewClientProfile()
	cpf.HttpProfile.Endpoint = "ses.intl.tencentcloudapi.com"

	client, err := ses.NewClient(common.NewCredential(secretId, secretKey), region, cpf)
	if err != nil {
		// Log error inisialisasi sangat krusial
		logger.Error("failed to init ses client", zap.Error(err), zap.String("region", region))
		return nil, err
	}
	return &SESService{Client: client, Logger: logger}, nil
}

func (s *SESService) GetTemplateStatusMap(limit, offset uint64) (map[uint64]string, error) {
	if err := s.available(); err != nil {
		return nil, err
	}
	request := ses.NewListEmailTemplatesRequest()
	request.Limit = common.Uint64Ptr(limit)
	request.Offset = common.Uint64Ptr(offset)

	response, err := s.Client.ListEmailTemplates(request)
	if err != nil {
		s.Logger.Error("failed to list email templates", zap.Error(err))
		return nil, err
	}

	statusMap := make(map[uint64]string)
	for _, item := range response.Response.TemplatesMetadata {
		// Cek nil pointer untuk keamanan
		if item.TemplateID != nil && item.TemplateStatus != nil {

			// FIX: Lakukan casting uint64() pada *item.TemplateStatus
			// karena SDK mengembalikan int64 di endpoint ini.
			statusMap[*item.TemplateID] = mapTencentStatus(uint64(*item.TemplateStatus))
		}
	}

	return statusMap, nil
}

func (s *SESService) GetTemplateStatus(tencentID uint64) (string, error) {
	if err := s.available(); err != nil {
		return "", err
	}
	request := ses.NewGetEmailTemplateRequest()
	request.TemplateID = common.Uint64Ptr(tencentID)

	// Call API Tencent
	response, err := s.Client.GetEmailTemplate(request)
	if err != nil {
		return "", err
	}

	// Ambil status integer, convert ke string
	statusInt := *response.Response.TemplateStatus
	return mapTencentStatus(statusInt), nil
}

// 1. Create Template
func (s *SESService) CreateTemplate(name, htmlBody string) (uint64, error) {
	if err := s.available(); err != nil {
		return 0, err
	}
	// Log intent
	s.Logger.Info("attempting to create email template", zap.String("template_name", name))

	request := ses.NewCreateEmailTemplateRequest()
	request.TemplateName = common.StringPtr(name)

	encodedHtml := base64.StdEncoding.EncodeToString([]byte(htmlBody))
	request.TemplateContent = &ses.TemplateContent{
		Html: common.StringPtr(encodedHtml),
	}

	response, err := s.Client.CreateEmailTemplate(request)
	if err != nil {
		s.Logger.Error("failed to create email template",
			zap.String("template_name", name),
			zap.Error(err),
		)
		return 0, err
	}

	id := *response.Response.TemplateID
	// Log success dengan ID yang dihasilkan untuk traceability
	s.Logger.Info("email template created successfully",
		zap.String("template_name", name),
		zap.Uint64("template_id", id),
	)

	return id, nil
}

// 2. Update Template
func (s *SESService) UpdateTemplate(tencentID uint64, name, htmlBody string) error {
	if err := s.available(); err != nil {
		return err
	}
	s.Logger.Info("attempting to update email template",
		zap.Uint64("template_id", tencentID),
		zap.String("new_name", name),
	)

	request := ses.NewUpdateEmailTemplateRequest()
	request.TemplateID = common.Uint64Ptr(tencentID)
	request.TemplateName = common.StringPtr(name)

	encodedHtml := base64.StdEncoding.EncodeToString([]byte(htmlBody))
	request.TemplateContent = &ses.TemplateContent{
		Html: common.StringPtr(encodedHtml),
	}

	_, err := s.Client.UpdateEmailTemplate(request)
	if err != nil {
		s.Logger.Error("failed to update email template",
			zap.Uint64("template_id", tencentID),
			zap.Error(err),
		)
		return err
	}

	s.Logger.Info("email template updated successfully", zap.Uint64("template_id", tencentID))
	return nil
}

// 3. Delete Template
func (s *SESService) DeleteTemplate(tencentID uint64) error {
	if err := s.available(); err != nil {
		return err
	}
	s.Logger.Info("attempting to delete email template", zap.Uint64("template_id", tencentID))

	request := ses.NewDeleteEmailTemplateRequest()
	request.TemplateID = common.Uint64Ptr(tencentID)

	_, err := s.Client.DeleteEmailTemplate(request)
	if err != nil {
		s.Logger.Error("failed to delete email template",
			zap.Uint64("template_id", tencentID),
			zap.Error(err),
		)
		return err
	}

	s.Logger.Info("email template deleted successfully", zap.Uint64("template_id", tencentID))
	return nil
}
