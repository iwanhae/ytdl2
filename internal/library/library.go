// Package library persists per-track metadata (category + duration) in a sidecar
// JSON file on the download volume, so the music/podcast split survives restarts
// and is shared across browsers. It also owns duration probing (ffprobe) and the
// auto-classification heuristic.
package library

import (
	"encoding/json"
	"fmt"
	"io/fs"
	"log"
	"os"
	"os/exec"
	"path/filepath"
	"strconv"
	"strings"
	"sync"
)

// Category is the coarse kind of a track.
type Category string

const (
	CategoryMusic   Category = "music"
	CategoryPodcast Category = "podcast"
)

// Valid reports whether c is one of the known categories.
func (c Category) Valid() bool {
	return c == CategoryMusic || c == CategoryPodcast
}

// Source records how a track got its category.
type Source string

const (
	SourceGuessed Source = "guessed" // derived from duration
	SourceManual  Source = "manual"  // set by the user, never overwritten
)

// Track is the per-file metadata we persist.
type Track struct {
	Category Category `json:"category"`
	Source   Source   `json:"source"`
	Duration float64  `json:"duration,omitempty"` // seconds
}

// Store is a concurrency-safe map of filename -> Track backed by a JSON file.
// The in-memory map is the source of truth for the process; every mutation is
// flushed atomically (write tmp + rename) so a crash can't leave a half file.
type Store struct {
	mu     sync.RWMutex
	path   string
	tracks map[string]Track
}

type fileFormat struct {
	Version int              `json:"version"`
	Tracks  map[string]Track `json:"tracks"`
}

// Load reads the sidecar at path, returning an empty in-memory store if the
// file is missing or unreadable (never returns an error — callers can always
// use the returned store).
func Load(path string) *Store {
	s := &Store{path: path, tracks: make(map[string]Track)}

	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		log.Printf("library: create dir %s: %v", filepath.Dir(path), err)
		return s // in-memory only; save() will retry
	}

	data, err := os.ReadFile(path)
	if err != nil {
		if !os.IsNotExist(err) {
			log.Printf("library: read %s: %v", path, err)
		}
		return s
	}

	var f fileFormat
	if err := json.Unmarshal(data, &f); err != nil {
		log.Printf("library: parse %s: %v — starting empty", path, err)
		return s
	}
	if f.Tracks != nil {
		s.tracks = f.Tracks
	}
	return s
}

// Get returns the track for name and whether it existed.
func (s *Store) Get(name string) (Track, bool) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	t, ok := s.tracks[name]
	return t, ok
}

// Set stores t for name and persists.
func (s *Store) Set(name string, t Track) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.tracks[name] = t
	return s.saveLocked()
}

// Delete removes name and persists. Removing a missing key is a no-op.
func (s *Store) Delete(name string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	if _, ok := s.tracks[name]; !ok {
		return nil
	}
	delete(s.tracks, name)
	return s.saveLocked()
}

// saveLocked persists the current map. Caller must hold s.mu.
func (s *Store) saveLocked() error {
	data, err := json.MarshalIndent(fileFormat{Version: 1, Tracks: s.tracks}, "", "  ")
	if err != nil {
		return err
	}
	dir := filepath.Dir(s.path)
	tmp, err := os.CreateTemp(dir, ".library-*.json.tmp")
	if err != nil {
		return err
	}
	tmpName := tmp.Name()
	cleanup := func() { os.Remove(tmpName) }

	if _, err := tmp.Write(data); err != nil {
		tmp.Close()
		cleanup()
		return err
	}
	if err := tmp.Close(); err != nil {
		cleanup()
		return err
	}
	if err := os.Rename(tmpName, s.path); err != nil {
		cleanup()
		return err
	}
	return nil
}

// Classify guesses a category from duration. Tracks at or above the threshold
// (seconds) are podcasts; shorter ones are music. The threshold is configurable
// so callers can tune it to their library; anything guessed is overridable.
func Classify(durationSeconds, thresholdSeconds float64) Category {
	if durationSeconds >= thresholdSeconds {
		return CategoryPodcast
	}
	return CategoryMusic
}

// ProbeDuration returns the media duration in seconds via ffprobe.
// A non-media file or a missing ffprobe yields an error; callers should skip.
func ProbeDuration(path string) (float64, error) {
	out, err := exec.Command("ffprobe",
		"-v", "error",
		"-show_entries", "format=duration",
		"-of", "default=noprint_wrappers=1:nokey=1",
		path,
	).Output()
	if err != nil {
		return 0, fmt.Errorf("ffprobe %q: %w", path, err)
	}
	d, err := strconv.ParseFloat(strings.TrimSpace(string(out)), 64)
	if err != nil {
		return 0, fmt.Errorf("parse duration %q: %w", strings.TrimSpace(string(out)), err)
	}
	return d, nil
}

// ScanAndProbe walks dir and, for every file that has no store entry yet, probes
// its duration and stores a guessed category. Dotfiles (and the .ytdl2 sidecar
// dir) are skipped. Failures and zero-length durations are skipped so the track
// simply stays untagged until a manual override. Idempotent, so it doubles as a
// one-time migration of pre-existing files and as the per-download classifier.
func (s *Store) ScanAndProbe(dir string, thresholdSeconds float64) {
	_ = filepath.WalkDir(dir, func(path string, d fs.DirEntry, err error) error {
		if err != nil || d == nil {
			return nil // tolerate unreadable entries
		}
		if d.IsDir() {
			return nil
		}
		if strings.HasPrefix(d.Name(), ".") {
			return nil
		}

		rel, err := filepath.Rel(dir, path)
		if err != nil {
			return nil
		}
		if _, ok := s.Get(rel); ok {
			return nil // already classified (manual or guessed)
		}

		dur, err := ProbeDuration(path)
		if err != nil {
			return nil // not media, or ffprobe missing — leave untagged
		}
		if dur <= 0 {
			return nil
		}
		_ = s.Set(rel, Track{
			Category: Classify(dur, thresholdSeconds),
			Source:   SourceGuessed,
			Duration: dur,
		})
		return nil
	})
}
