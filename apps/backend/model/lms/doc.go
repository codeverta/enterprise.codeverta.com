// Package lms is the organized import surface for Enterprise Resource
// models. The aliases intentionally keep the existing model package API
// compatible while allowing new code to import gin-template/model/lms.
package lms

import core "gin-template/model"

type (
	LMSRole                  = core.LMSRole
	CourseStatus             = core.CourseStatus
	LearningAssetType        = core.LearningAssetType
	QuizQuestionType         = core.QuizQuestionType
	QuizAttemptStatus        = core.QuizAttemptStatus
	SubscriptionStatus       = core.SubscriptionStatus
	LMSPaymentStatus         = core.LMSPaymentStatus
	Profile                  = core.Profile
	UserRole                 = core.UserRole
	LearningAsset            = core.LearningAsset
	LibraryItem              = core.LibraryItem
	Membership               = core.Membership
	StudentProgress          = core.StudentProgress
	FAQ                      = core.FAQ
	Testimonial              = core.Testimonial
	SiteContent              = core.SiteContent
	ParentGuide              = core.ParentGuide
	AIImageGenerationStatus  = core.AIImageGenerationStatus
	AIImageGeneration        = core.AIImageGeneration
	AIImageDailyQuota        = core.AIImageDailyQuota
	AssignmentStatus         = core.AssignmentStatus
	Assignment               = core.Assignment
	CertificateTemplate      = core.CertificateTemplate
	StudentCertificate       = core.StudentCertificate
	Course                   = core.Course
	CourseBundle             = core.CourseBundle
	CourseBundleItem         = core.CourseBundleItem
	CourseCategory           = core.CourseCategory
	Lesson                   = core.Lesson
	LevelUnlock              = core.LevelUnlock
	Module                   = core.Module
	LMSPayment               = core.LMSPayment
	QuizQuestionImportRow    = core.QuizQuestionImportRow
	Quiz                     = core.Quiz
	QuizQuestion             = core.QuizQuestion
	QuizOption               = core.QuizOption
	QuizAttempt              = core.QuizAttempt
	QuizAnswer               = core.QuizAnswer
	QuizProgress             = core.QuizProgress
	ScheduleResourceType     = core.ScheduleResourceType
	ScheduleTemplate         = core.ScheduleTemplate
	ScheduleTemplateItem     = core.ScheduleTemplateItem
	StudentSchedule          = core.StudentSchedule
	StudentScheduleItem      = core.StudentScheduleItem
	Subscription             = core.Subscription
	CourseCategoryTargetRole = core.CourseCategoryTargetRole
	CourseTargetRole         = core.CourseTargetRole
)

const (
	LMSRoleStudent                  = core.LMSRoleStudent
	LMSRoleParent                   = core.LMSRoleParent
	LMSRoleMentor                   = core.LMSRoleMentor
	LMSRoleMentorEksternal          = core.LMSRoleMentorEksternal
	LMSRoleAdmin                    = core.LMSRoleAdmin
	CourseStatusDraft               = core.CourseStatusDraft
	CourseStatusPublished           = core.CourseStatusPublished
	CourseStatusArchived            = core.CourseStatusArchived
	LearningAssetVideo              = core.LearningAssetVideo
	LearningAssetEbook              = core.LearningAssetEbook
	LearningAssetAudiobook          = core.LearningAssetAudiobook
	LearningAssetWorksheet          = core.LearningAssetWorksheet
	LearningAssetImage              = core.LearningAssetImage
	QuizQuestionSingle              = core.QuizQuestionSingle
	QuizQuestionMultiple            = core.QuizQuestionMultiple
	QuizQuestionTrueFalse           = core.QuizQuestionTrueFalse
	QuizQuestionShortAnswer         = core.QuizQuestionShortAnswer
	QuizQuestionArrangeWords        = core.QuizQuestionArrangeWords
	QuizAttemptInProgress           = core.QuizAttemptInProgress
	QuizAttemptSubmitted            = core.QuizAttemptSubmitted
	QuizAttemptPassed               = core.QuizAttemptPassed
	QuizAttemptFailed               = core.QuizAttemptFailed
	QuizAttemptExpired              = core.QuizAttemptExpired
	SubscriptionStatusTrialing      = core.SubscriptionStatusTrialing
	SubscriptionStatusActive        = core.SubscriptionStatusActive
	SubscriptionStatusPastDue       = core.SubscriptionStatusPastDue
	SubscriptionStatusCanceled      = core.SubscriptionStatusCanceled
	SubscriptionStatusExpired       = core.SubscriptionStatusExpired
	LMSPaymentPending               = core.LMSPaymentPending
	LMSPaymentPaid                  = core.LMSPaymentPaid
	LMSPaymentFailed                = core.LMSPaymentFailed
	LMSPaymentExpired               = core.LMSPaymentExpired
	AIImageGenerationReserved       = core.AIImageGenerationReserved
	AIImageGenerationGenerated      = core.AIImageGenerationGenerated
	AIImageGenerationApproved       = core.AIImageGenerationApproved
	AIImageGenerationRejected       = core.AIImageGenerationRejected
	AIImageGenerationProviderFailed = core.AIImageGenerationProviderFailed
	AIImageGenerationStorageFailed  = core.AIImageGenerationStorageFailed
	AssignmentStatusSubmitted       = core.AssignmentStatusSubmitted
	AssignmentStatusGraded          = core.AssignmentStatusGraded
	AssignmentStatusReturned        = core.AssignmentStatusReturned
	ScheduleResourceCourse          = core.ScheduleResourceCourse
	ScheduleResourceModule          = core.ScheduleResourceModule
	ScheduleResourceLesson          = core.ScheduleResourceLesson
	ScheduleResourceQuiz            = core.ScheduleResourceQuiz
)

func LMSModels() []interface{} { return core.LMSModels() }
