package server

import (
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

// Integration coverage for the music/podcast category feature: the sidecar
// store, list enrichment, the override endpoint, and the safePath guard. Runs
// via httptest so it needs no ffprobe/yt-dlp and no free :8080.

func newTestServer(t *testing.T) (*Server, string) {
	t.Helper()
	dir := t.TempDir()
	if err := os.WriteFile(filepath.Join(dir, "song.mp3"), []byte("fake audio"), 0o644); err != nil {
		t.Fatalf("seed file: %v", err)
	}
	return NewServer(dir, dir, 360), dir
}

func do(t *testing.T, s *Server, method, target, body string) *httptest.ResponseRecorder {
	t.Helper()
	var r io.Reader
	if body != "" {
		r = strings.NewReader(body)
	}
	req := httptest.NewRequest(method, target, r)
	if body != "" {
		req.Header.Set("Content-Type", "application/json")
	}
	rec := httptest.NewRecorder()
	s.ServeHTTP(rec, req) // promoted from embedded *http.ServeMux
	return rec
}

type fileItem struct {
	Name     string  `json:"name"`
	Category string  `json:"category"`
	Duration float64 `json:"duration"`
}
type listResp struct {
	Files []fileItem `json:"files"`
}

func TestListFilesNoCategoryWithoutProbe(t *testing.T) {
	s, _ := newTestServer(t)
	rec := do(t, s, http.MethodGet, "/api/files", "")
	if rec.Code != 200 {
		t.Fatalf("list status = %d, want 200", rec.Code)
	}
	var lr listResp
	if err := json.Unmarshal(rec.Body.Bytes(), &lr); err != nil {
		t.Fatal(err)
	}
	if len(lr.Files) != 1 || lr.Files[0].Name != "song.mp3" || lr.Files[0].Category != "" {
		t.Fatalf("unexpected files: %+v", lr.Files)
	}
}

func TestSetCategoryAndPersist(t *testing.T) {
	s, dir := newTestServer(t)
	rec := do(t, s, http.MethodPost, "/api/files/song.mp3/category", `{"category":"music"}`)
	if rec.Code != 200 {
		t.Fatalf("set status = %d body=%s", rec.Code, rec.Body.String())
	}
	var set struct {
		Category string `json:"category"`
		Source   string `json:"source"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &set); err != nil {
		t.Fatal(err)
	}
	if set.Category != "music" || set.Source != "manual" {
		t.Fatalf("set resp = %+v", set)
	}

	// Enrichment reflects the manual category.
	rec = do(t, s, http.MethodGet, "/api/files", "")
	var lr listResp
	json.Unmarshal(rec.Body.Bytes(), &lr)
	if lr.Files[0].Category != "music" {
		t.Fatalf("enriched category = %q want music", lr.Files[0].Category)
	}

	// Sidecar was written atomically to disk and round-trips.
	data, err := os.ReadFile(filepath.Join(dir, ".ytdl2", "library.json"))
	if err != nil {
		t.Fatalf("sidecar read: %v", err)
	}
	if !strings.Contains(string(data), "song.mp3") || !strings.Contains(string(data), "manual") {
		t.Fatalf("sidecar missing entry: %s", data)
	}
}

func TestSetCategoryInvalid(t *testing.T) {
	s, _ := newTestServer(t)
	rec := do(t, s, http.MethodPost, "/api/files/song.mp3/category", `{"category":"noise"}`)
	if rec.Code != 400 {
		t.Fatalf("invalid category status = %d, want 400", rec.Code)
	}
}

func TestSafePath(t *testing.T) {
	s, dir := newTestServer(t)
	if p, err := s.safePath("song.mp3"); err != nil || !strings.HasPrefix(p, dir) {
		t.Fatalf("normal file: p=%q err=%v", p, err)
	}
	for _, bad := range []string{"../etc/passwd", "../../etc/os-release", ".ytdl2", ".ytdl2/library.json", ""} {
		if _, err := s.safePath(bad); err == nil {
			t.Fatalf("safePath(%q) should reject", bad)
		}
	}
}

func TestMetaFileNotServable(t *testing.T) {
	s, _ := newTestServer(t)
	rec := do(t, s, http.MethodGet, "/api/files/.ytdl2/library.json", "")
	if rec.Code == 200 {
		t.Fatalf("meta file served! status=%d body=%s", rec.Code, rec.Body.String())
	}
}

func TestDeleteRemovesStoreEntry(t *testing.T) {
	s, _ := newTestServer(t)
	do(t, s, http.MethodPost, "/api/files/song.mp3/category", `{"category":"podcast"}`)
	rec := do(t, s, http.MethodDelete, "/api/files/song.mp3", "")
	if rec.Code != 200 {
		t.Fatalf("delete status = %d", rec.Code)
	}
	// Re-list: empty.
	rec = do(t, s, http.MethodGet, "/api/files", "")
	var lr listResp
	json.Unmarshal(rec.Body.Bytes(), &lr)
	if len(lr.Files) != 0 {
		t.Fatalf("expected empty list after delete, got %+v", lr.Files)
	}
	// Store entry pruned.
	if t2, ok := s.library.Get("song.mp3"); ok {
		t.Fatalf("store still has entry: %+v", t2)
	}
}
