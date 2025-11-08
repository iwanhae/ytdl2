package server

import (
	"encoding/json"
	"fmt"
	"io/fs"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"github.com/iwanhae/ytdl2/internal/command"
)

type CommandInfo struct {
	ID        string           `json:"id"`
	URL       string           `json:"url"`
	Status    string           `json:"status"` // "running", "completed", "failed"
	StartedAt time.Time        `json:"started_at"`
	ExitCode  int              `json:"exit_code,omitempty"`
	Command   *command.Command `json:"-"`
}

type Server struct {
	*http.ServeMux

	DownloadDirectory string
	commands          map[string]*CommandInfo
	commandsMu        sync.RWMutex
	commandCounter    int
	counterMu         sync.Mutex
}

func NewServer(downloadDirectory string) *Server {
	mux := http.NewServeMux()
	s := &Server{
		ServeMux:          mux,
		DownloadDirectory: downloadDirectory,
		commands:          make(map[string]*CommandInfo),
	}
	// API routes (must be registered before static file server)
	s.HandleFunc("/api/yt-dlp", s.handleYtDlp)
	s.HandleFunc("/api/commands", s.handleCommands)
	s.HandleFunc("/api/commands/", s.handleCommandLogs)
	s.HandleFunc("/api/files", s.handleFiles)
	s.HandleFunc("/api/files/", s.handleFileDownload)

	// Serve static files for non-API routes
	staticFS := http.FileServer(http.Dir("./static"))
	s.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		// Only serve static files if it's not an API route
		if !strings.HasPrefix(r.URL.Path, "/api/") {
			staticFS.ServeHTTP(w, r)
		} else {
			http.NotFound(w, r)
		}
	})

	return s
}

func (s *Server) nextCommandID() string {
	s.counterMu.Lock()
	defer s.counterMu.Unlock()
	s.commandCounter++
	return fmt.Sprintf("cmd-%d", s.commandCounter)
}

// POST /api/yt-dlp
// Body: {"url": string}
// Response: ok
// This endpoint will execute `yt-dlp` command with the given url and return "ok" if successful.
// It will be executed in background and the response will be sent immediately.
func (s *Server) handleYtDlp(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		w.WriteHeader(http.StatusMethodNotAllowed)
		return
	}

	var body struct {
		URL string `json:"url"`
	}

	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		w.WriteHeader(http.StatusBadRequest)
		log.Printf("Error decoding body: %v", err)
		w.Write([]byte(fmt.Sprintf("Error decoding body: %v", err)))
		return
	}
	log.Printf("Downloading %s...", body.URL)

	cmd := command.
		New("yt-dlp", "-f", "bestvideo*+bestaudio/best", body.URL).
		SetWorkingDirectory(s.DownloadDirectory)

	if err := cmd.Execute(); err != nil {
		w.WriteHeader(http.StatusInternalServerError)
		log.Printf("Error executing yt-dlp: %v", err)
		w.Write([]byte(fmt.Sprintf("Error executing yt-dlp: %v", err)))
		return
	}

	// Register command
	cmdID := s.nextCommandID()
	cmdInfo := &CommandInfo{
		ID:        cmdID,
		URL:       body.URL,
		Status:    "running",
		StartedAt: time.Now(),
		Command:   cmd,
	}

	s.commandsMu.Lock()
	s.commands[cmdID] = cmdInfo
	s.commandsMu.Unlock()

	// Monitor command completion
	go func() {
		for line := range cmd.StdoutChannel() {
			fmt.Println(line)
		}
		// Wait for command to finish
		cmd.Wait()
		exitCode := cmd.ExitCode()

		s.commandsMu.Lock()
		if exitCode == 0 {
			cmdInfo.Status = "completed"
		} else {
			cmdInfo.Status = "failed"
		}
		cmdInfo.ExitCode = exitCode
		s.commandsMu.Unlock()
	}()

	w.WriteHeader(http.StatusOK)
	response := map[string]string{
		"status": "ok",
		"id":     cmdID,
	}
	json.NewEncoder(w).Encode(response)
}

// GET /api/commands
// Response: {"commands": [{"id": string, "url": string, "status": string, "started_at": string, "exit_code": int}]}
// Returns a list of all commands (running, completed, and failed)
func (s *Server) handleCommands(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		w.WriteHeader(http.StatusMethodNotAllowed)
		return
	}

	s.commandsMu.RLock()
	commands := make([]*CommandInfo, 0, len(s.commands))
	for _, cmdInfo := range s.commands {
		// Create a copy without the Command field for JSON serialization
		commands = append(commands, &CommandInfo{
			ID:        cmdInfo.ID,
			URL:       cmdInfo.URL,
			Status:    cmdInfo.Status,
			StartedAt: cmdInfo.StartedAt,
			ExitCode:  cmdInfo.ExitCode,
		})
	}
	s.commandsMu.RUnlock()

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]interface{}{
		"commands": commands,
	})
}

// GET /api/commands/{id}/logs
// Response: {"id": string, "logs": [string]}
// Returns the logs for a specific command
func (s *Server) handleCommandLogs(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		w.WriteHeader(http.StatusMethodNotAllowed)
		return
	}

	// Extract command ID from path: /api/commands/{id}/logs
	// Path should be like: /api/commands/cmd-1/logs
	path := strings.TrimPrefix(r.URL.Path, "/api/commands/")
	parts := strings.Split(path, "/")

	if len(parts) == 0 || parts[0] == "" {
		// This is /api/commands, which should be handled by handleCommands
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(map[string]string{
			"error": "Command ID is required. Expected /api/commands/{id}/logs",
		})
		return
	}

	cmdID := parts[0]

	// Check if path ends with /logs (optional, but more explicit)
	if len(parts) > 1 && parts[1] != "logs" {
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(map[string]string{
			"error": "Invalid path. Expected /api/commands/{id}/logs",
		})
		return
	}

	s.commandsMu.RLock()
	cmdInfo, exists := s.commands[cmdID]
	s.commandsMu.RUnlock()

	if !exists {
		w.WriteHeader(http.StatusNotFound)
		json.NewEncoder(w).Encode(map[string]string{
			"error": fmt.Sprintf("Command %s not found", cmdID),
		})
		return
	}

	// Get logs from the command
	logs := cmdInfo.Command.Logs()

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]interface{}{
		"id":   cmdID,
		"logs": logs,
	})
}

// FileInfo represents file information
type FileInfo struct {
	Name    string    `json:"name"`
	Size    int64     `json:"size"`
	ModTime time.Time `json:"mod_time"`
}

// GET /api/files
// Response: {"files": [{"name": string, "size": int64, "mod_time": string}]}
// Returns a list of all files in the download directory
func (s *Server) handleFiles(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		w.WriteHeader(http.StatusMethodNotAllowed)
		return
	}

	var files []FileInfo

	err := filepath.WalkDir(s.DownloadDirectory, func(path string, d fs.DirEntry, err error) error {
		if err != nil {
			return err
		}
		if d.IsDir() {
			return nil
		}

		info, err := d.Info()
		if err != nil {
			return err
		}

		relPath, err := filepath.Rel(s.DownloadDirectory, path)
		if err != nil {
			return err
		}

		files = append(files, FileInfo{
			Name:    relPath,
			Size:    info.Size(),
			ModTime: info.ModTime(),
		})

		return nil
	})

	if err != nil {
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(map[string]string{
			"error": fmt.Sprintf("Failed to list files: %v", err),
		})
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]interface{}{
		"files": files,
	})
}

// GET /api/files/{filename}
// Serves the file for download
func (s *Server) handleFileDownload(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		w.WriteHeader(http.StatusMethodNotAllowed)
		return
	}

	// Extract filename from path: /api/files/{filename}
	path := strings.TrimPrefix(r.URL.Path, "/api/files/")
	if path == "" {
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(map[string]string{
			"error": "Filename is required",
		})
		return
	}

	// Security: prevent directory traversal
	if strings.Contains(path, "..") || strings.Contains(path, "/") {
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(map[string]string{
			"error": "Invalid filename",
		})
		return
	}

	filePath := filepath.Join(s.DownloadDirectory, path)

	// Check if file exists
	if _, err := os.Stat(filePath); os.IsNotExist(err) {
		w.WriteHeader(http.StatusNotFound)
		json.NewEncoder(w).Encode(map[string]string{
			"error": "File not found",
		})
		return
	}

	// Serve the file
	http.ServeFile(w, r, filePath)
}
