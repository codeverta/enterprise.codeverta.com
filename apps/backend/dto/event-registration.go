package dto

// Request Payload Struct (Untuk Validasi JSON masuk)
type ParticipantRequest struct {
	FirstName           string `json:"first_name" binding:"required,min=1,max=100"`
	LastName            string `json:"last_name" binding:"required,min=1,max=100"`
	BibName             string `json:"bib_name" binding:"required,max=50"`
	Email               string `json:"email" binding:"required,email,max=191"`
	PhoneNumber         string `json:"phone_number" binding:"required,numeric,min=10,max=20"`
	TicketPriceID       string `json:"ticket_price_id" binding:"required,uuid"`
	DateOfBirth         string `json:"date_of_birth" binding:"required,datetime=2006-01-02"`
	IdType              string `json:"id_type" binding:"omitempty,oneof=KTP PASSPORT SIM STUDENT"`
	IdNumber            string `json:"id_number" binding:"omitempty,alphanum,min=5,max=20"`
	BloodType           string `json:"blood_type" binding:"required,oneof=A B AB O"`
	JerseySize          string `json:"jersey_size" binding:"required,alphanum,max=4"`
	JerseyType          string `json:"jersey_type" binding:"required"`
	Gender              string `json:"gender" binding:"required,oneof=Male Female,max=6"`
	Country             string `json:"country" binding:"required,max=100"`
	Province            string `json:"province" binding:"required,max=100"`
	City                string `json:"city" binding:"required,max=100"`
	Address             string `json:"address" binding:"required,max=500"`
	TrackingProfileLink string `json:"tracking_profile_link" binding:"omitempty,url,max=255"`
	EmergencyName       string `json:"emergency_contact_name" binding:"required,max=255"`
	EmergencyNumber     string `json:"emergency_contact_numbers" binding:"required,min=10,max=20"`
	EmergencyRelation   string `json:"relationship_with_emergency_contacts" binding:"required,alpha,max=50"`
	CommunityName       string `json:"community_name" binding:"max=150"`
	MedicalCondition    string `json:"medical_condition" binding:"omitempty,max=500"`
}
