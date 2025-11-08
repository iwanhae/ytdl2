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

	DownloadDirectory   string
	commands            map[string]*CommandInfo
	commandsMu          sync.RWMutex
	commandCounter      int
	counterMu           sync.Mutex
	commandsSubscribers map[chan string]bool
	commandsSubMu       sync.RWMutex
}

func NewServer(downloadDirectory string) *Server {
	mux := http.NewServeMux()
	s := &Server{
		ServeMux:            mux,
		DownloadDirectory:   downloadDirectory,
		commands:            make(map[string]*CommandInfo),
		commandsSubscribers: make(map[chan string]bool),
	}
	// API routes (must be registered before static file server)
	s.HandleFunc("/api/yt-dlp", s.handleYtDlp)
	s.HandleFunc("/api/commands", s.handleCommands)
	s.HandleFunc("/api/commands/stream", s.handleCommandsStream)
	s.HandleFunc("/api/commands/", s.handleCommandLogs)
	s.HandleFunc("/api/files", s.handleFiles)
	s.HandleFunc("/api/files/", s.handleFileOperation)

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

	// Broadcast new command
	s.broadcastCommandUpdate()

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

		// Broadcast command completion
		s.broadcastCommandUpdate()
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

	// Check if path ends with /logs or /logs/stream
	if len(parts) > 1 {
		if parts[1] == "logs" {
			if len(parts) > 2 && parts[2] == "stream" {
				// Handle SSE streaming
				s.handleCommandLogsStream(w, r, cmdID)
				return
			}
			// Continue with regular logs
		} else {
			w.WriteHeader(http.StatusBadRequest)
			json.NewEncoder(w).Encode(map[string]string{
				"error": "Invalid path. Expected /api/commands/{id}/logs or /api/commands/{id}/logs/stream",
			})
			return
		}
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

// handleFileOperation handles file download, deletion, and audio extraction
// GET /api/files/{filename} - Download file
// DELETE /api/files/{filename} - Delete file
// POST /api/files/{filename}/extract-audio - Extract audio to MP3
func (s *Server) handleFileOperation(w http.ResponseWriter, r *http.Request) {
	// Extract filename from path: /api/files/{filename}
	path := strings.TrimPrefix(r.URL.Path, "/api/files/")
	if path == "" {
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(map[string]string{
			"error": "Filename is required",
		})
		return
	}

	// Check if this is an extract-audio request
	if strings.HasSuffix(path, "/extract-audio") {
		filename := strings.TrimSuffix(path, "/extract-audio")
		s.handleExtractAudio(w, r, filename)
		return
	}

	// Security: prevent directory traversal
	if strings.Contains(path, "..") {
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(map[string]string{
			"error": "Invalid filename",
		})
		return
	}

	filePath := filepath.Join(s.DownloadDirectory, path)

	switch r.Method {
	case http.MethodGet:
		// Download file
		// Check if file exists
		info, err := os.Stat(filePath)
		if os.IsNotExist(err) {
			w.WriteHeader(http.StatusNotFound)
			json.NewEncoder(w).Encode(map[string]string{
				"error": "File not found",
			})
			return
		}
		// Serve the file
		f, err := os.Open(filePath)
		if err != nil {
			w.WriteHeader(http.StatusInternalServerError)
			json.NewEncoder(w).Encode(map[string]string{
				"error": fmt.Sprintf("Failed to open file: %v", err),
			})
			return
		}
		defer f.Close()
		http.ServeContent(w, r, info.Name(), info.ModTime(), f)

	case http.MethodDelete:
		// Delete file
		// Check if file exists
		if _, err := os.Stat(filePath); os.IsNotExist(err) {
			w.WriteHeader(http.StatusNotFound)
			json.NewEncoder(w).Encode(map[string]string{
				"error": "File not found",
			})
			return
		}

		// Delete the file
		if err := os.Remove(filePath); err != nil {
			log.Printf("Failed to delete file %s: %v", filePath, err)
			w.WriteHeader(http.StatusInternalServerError)
			json.NewEncoder(w).Encode(map[string]string{
				"error": fmt.Sprintf("Failed to delete file: %v", err),
			})
			return
		}

		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		json.NewEncoder(w).Encode(map[string]string{
			"message": "File deleted successfully",
		})

	default:
		w.WriteHeader(http.StatusMethodNotAllowed)
		json.NewEncoder(w).Encode(map[string]string{
			"error": "Method not allowed",
		})
	}
}

// broadcastCommandUpdate sends current commands state to all subscribers
func (s *Server) broadcastCommandUpdate() {
	s.commandsMu.RLock()
	commands := make([]*CommandInfo, 0, len(s.commands))
	for _, cmdInfo := range s.commands {
		commands = append(commands, &CommandInfo{
			ID:        cmdInfo.ID,
			URL:       cmdInfo.URL,
			Status:    cmdInfo.Status,
			StartedAt: cmdInfo.StartedAt,
			ExitCode:  cmdInfo.ExitCode,
		})
	}
	s.commandsMu.RUnlock()

	data, err := json.Marshal(map[string]interface{}{
		"commands": commands,
	})
	if err != nil {
		log.Printf("Failed to marshal commands: %v", err)
		return
	}

	message := fmt.Sprintf("data: %s\n\n", string(data))

	s.commandsSubMu.RLock()
	for ch := range s.commandsSubscribers {
		select {
		case ch <- message:
		default:
			// Client is slow, skip
		}
	}
	s.commandsSubMu.RUnlock()
}

// GET /api/commands/stream
// SSE endpoint for real-time command updates
func (s *Server) handleCommandsStream(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		w.WriteHeader(http.StatusMethodNotAllowed)
		return
	}

	// Set SSE headers
	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")
	w.Header().Set("Access-Control-Allow-Origin", "*")

	// Create a channel for this client
	messageChan := make(chan string, 10)

	// Register subscriber
	s.commandsSubMu.Lock()
	s.commandsSubscribers[messageChan] = true
	s.commandsSubMu.Unlock()

	// Send initial state
	s.commandsMu.RLock()
	commands := make([]*CommandInfo, 0, len(s.commands))
	for _, cmdInfo := range s.commands {
		commands = append(commands, &CommandInfo{
			ID:        cmdInfo.ID,
			URL:       cmdInfo.URL,
			Status:    cmdInfo.Status,
			StartedAt: cmdInfo.StartedAt,
			ExitCode:  cmdInfo.ExitCode,
		})
	}
	s.commandsMu.RUnlock()

	initialData, _ := json.Marshal(map[string]interface{}{
		"commands": commands,
	})
	fmt.Fprintf(w, "data: %s\n\n", string(initialData))
	if f, ok := w.(http.Flusher); ok {
		f.Flush()
	}

	// Listen for updates
	notify := r.Context().Done()
	for {
		select {
		case <-notify:
			// Client disconnected
			s.commandsSubMu.Lock()
			delete(s.commandsSubscribers, messageChan)
			s.commandsSubMu.Unlock()
			close(messageChan)
			return
		case msg := <-messageChan:
			fmt.Fprint(w, msg)
			if f, ok := w.(http.Flusher); ok {
				f.Flush()
			}
		}
	}
}

// GET /api/commands/{id}/logs/stream
// SSE endpoint for real-time log streaming
func (s *Server) handleCommandLogsStream(w http.ResponseWriter, r *http.Request, cmdID string) {
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

	// Set SSE headers
	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")
	w.Header().Set("Access-Control-Allow-Origin", "*")

	// Get log channel from command
	logChan := cmdInfo.Command.StdoutChannel()

	// Stream logs
	notify := r.Context().Done()
	for {
		select {
		case <-notify:
			// Client disconnected
			return
		case line, ok := <-logChan:
			if !ok {
				// Command finished, send completion event
				fmt.Fprintf(w, "event: done\ndata: {}\n\n")
				if f, ok := w.(http.Flusher); ok {
					f.Flush()
				}
				return
			}
			data, _ := json.Marshal(map[string]string{
				"line": line,
			})
			fmt.Fprintf(w, "data: %s\n\n", string(data))
			if f, ok := w.(http.Flusher); ok {
				f.Flush()
			}
		}
	}
}

// POST /api/files/{filename}/extract-audio
// Extracts audio from video file to MP3 format
// If MP3 already exists, returns its info
// Process is tracked like download commands with SSE
func (s *Server) handleExtractAudio(w http.ResponseWriter, r *http.Request, filename string) {
	if r.Method != http.MethodPost {
		w.WriteHeader(http.StatusMethodNotAllowed)
		json.NewEncoder(w).Encode(map[string]string{
			"error": "Method not allowed",
		})
		return
	}

	// Security: prevent directory traversal
	if strings.Contains(filename, "..") {
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(map[string]string{
			"error": "Invalid filename",
		})
		return
	}

	// Get source file path
	sourceFilePath := filepath.Join(s.DownloadDirectory, filename)

	// Check if source file exists
	if _, err := os.Stat(sourceFilePath); os.IsNotExist(err) {
		w.WriteHeader(http.StatusNotFound)
		json.NewEncoder(w).Encode(map[string]string{
			"error": "Source file not found",
		})
		return
	}

	// Generate MP3 filename (replace extension with .mp3)
	ext := filepath.Ext(filename)
	mp3Filename := strings.TrimSuffix(filename, ext) + ".mp3"
	mp3FilePath := filepath.Join(s.DownloadDirectory, mp3Filename)

	// Check if MP3 already exists
	if info, err := os.Stat(mp3FilePath); err == nil {
		// MP3 exists, return its info
		log.Printf("MP3 file already exists: %s", mp3Filename)
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		json.NewEncoder(w).Encode(map[string]interface{}{
			"status":       "exists",
			"message":      "MP3 file already exists",
			"filename":     mp3Filename,
			"size":         info.Size(),
			"download_url": fmt.Sprintf("/api/files/%s", mp3Filename),
		})
		return
	}

	// MP3 doesn't exist, extract audio using ffmpeg
	log.Printf("Extracting audio from %s to %s...", filename, mp3Filename)

	// Run ffmpeg command
	// ffmpeg -i input.mp4 -vn -acodec libmp3lame -q:a 2 output.mp3
	cmd := command.
		New("ffmpeg", "-i", sourceFilePath, "-vn", "-acodec", "libmp3lame", "-q:a", "2", mp3FilePath, "-y")

	if err := cmd.Execute(); err != nil {
		w.WriteHeader(http.StatusInternalServerError)
		log.Printf("Error executing ffmpeg: %v", err)
		json.NewEncoder(w).Encode(map[string]string{
			"error": fmt.Sprintf("Failed to extract audio: %v", err),
		})
		return
	}

	// Register command
	cmdID := s.nextCommandID()
	cmdInfo := &CommandInfo{
		ID:        cmdID,
		URL:       fmt.Sprintf("Extract audio: %s", filename),
		Status:    "running",
		StartedAt: time.Now(),
		Command:   cmd,
	}

	s.commandsMu.Lock()
	s.commands[cmdID] = cmdInfo
	s.commandsMu.Unlock()

	// Broadcast new command
	s.broadcastCommandUpdate()

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

		// Broadcast command completion
		s.broadcastCommandUpdate()
	}()

	w.WriteHeader(http.StatusOK)
	response := map[string]string{
		"status": "ok",
		"id":     cmdID,
	}
	json.NewEncoder(w).Encode(response)
}
