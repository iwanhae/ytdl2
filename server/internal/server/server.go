package server

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"

	"github.com/iwanhae/ytdl2/internal/command"
)

type Server struct {
	*http.ServeMux

	DownloadDirectory string
}

func NewServer(downloadDirectory string) *Server {
	mux := http.NewServeMux()
	s := &Server{mux, downloadDirectory}
	s.HandleFunc("/api/yt-dlp", s.handleYtDlp)
	return s
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

	go func() {
		for line := range cmd.StdoutChannel() {
			fmt.Println(line)
		}
	}()

	w.WriteHeader(http.StatusOK)
	w.Write([]byte("ok"))
}
