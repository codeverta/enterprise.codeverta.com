package controller

import (
	"strings"
	"testing"

	"github.com/google/uuid"
)

func TestSplitRAGChunksPreservesBoundedOverlap(t *testing.T) {
	content := strings.Repeat("Dokumentasi aplikasi dan aturan penggunaan. ", 150)
	chunks := splitRAGChunks(content)
	if len(chunks) < 2 {
		t.Fatalf("expected multiple chunks, got %d", len(chunks))
	}
	for _, chunk := range chunks {
		if len([]rune(chunk)) > ragChunkRunes {
			t.Fatalf("chunk exceeded rune limit: %d", len([]rune(chunk)))
		}
	}
}

func TestBoundRAGChunksNeverExceedsTokenBudget(t *testing.T) {
	chunks := []ragRetrievedChunk{
		{DocumentID: uuid.New(), Title: "A", Content: strings.Repeat("isi dokumentasi ", 500)},
		{DocumentID: uuid.New(), Title: "B", Content: strings.Repeat("isi lain ", 500)},
	}
	result := boundRAGChunks(chunks, 120)
	if !result.Found {
		t.Fatal("expected bounded context")
	}
	if result.TokenCount > 120 || estimateTokens(result.Text) > 120 {
		t.Fatalf("context exceeded token budget: stored=%d estimated=%d", result.TokenCount, estimateTokens(result.Text))
	}
}

func TestRAGKeywordsAreBoundedAndSanitized(t *testing.T) {
	keywords := ragKeywords("' OR 1=1; DROP TABLE users; bagaimana reset password dokumentasi aplikasi tambahan")
	if len(keywords) > 6 {
		t.Fatalf("expected at most six keywords, got %d", len(keywords))
	}
	for _, keyword := range keywords {
		if strings.ContainsAny(keyword, "';=") {
			t.Fatalf("unsafe keyword: %q", keyword)
		}
	}
}

func TestNormalizeRAGAudienceRolesOnlyAllowsKnownRoles(t *testing.T) {
	roles := normalizeRAGAudienceRoles([]string{"student", "admin", "ADMIN", "100", "owner", "20"})
	joined := strings.Join(roles, ",")
	if joined != "student,admin,superadmin" {
		t.Fatalf("unexpected normalized roles: %q", joined)
	}
}
