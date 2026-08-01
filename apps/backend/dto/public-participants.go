package dto

type PublicParticipantResponse struct {
	ID            string `json:"id"`
	Name          string `json:"name"`
	Gender        string `json:"gender"`
	Category      string `json:"category"`
	CommunityName string `json:"community_name"` // Kosong jika tidak ada
	Country       string `json:"country"`
	BibNumber     string `json:"bib"`    // Menggunakan UniqueCode atau field khusus
	Status        string `json:"status"` // Finished/Pending/etc
}
