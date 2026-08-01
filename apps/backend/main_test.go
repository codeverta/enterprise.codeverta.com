package main

import (
	"gin-template/common"
	"net/http"
	"testing"
)

func TestGetPort(t *testing.T) {
	t.Setenv("PORT", "8088")
	if got := getPort(); got != "8088" {
		t.Fatalf("expected env port, got %q", got)
	}

	t.Setenv("PORT", "")
	old := *common.Port
	*common.Port = 9090
	t.Cleanup(func() { *common.Port = old })
	if got := getPort(); got != "9090" {
		t.Fatalf("expected flag port, got %q", got)
	}
}

func TestGracefulShutdown(t *testing.T) {
	server := &http.Server{}
	if err := gracefulShutdown(server); err != nil {
		t.Fatalf("expected shutdown on idle server to pass: %v", err)
	}
}
