package main

import (
	"log"
	"net/http"
	"os"

	"github.com/iwanhae/ytdl2/internal/server"
)

var (
	downloadDirectory = getEnv("DOWNLOAD_DIRECTORY", "./data")
	staticDirectory   = getEnv("STATIC_DIRECTORY", "./static")
)

func main() {
	log.Printf("Download directory: %s", downloadDirectory)
	if err := os.MkdirAll(downloadDirectory, 0755); err != nil {
		log.Fatalf("Failed to create download directory: %v", err)
	}

	s := server.NewServer(downloadDirectory, staticDirectory)

	log.Println("Starting server with SPA support...")
	log.Println("Server is running on :8080")
	http.ListenAndServe(":8080", s)
}

func getEnv(key string, defaultValue string) string {
	value := os.Getenv(key)
	if value == "" {
		return defaultValue
	}
	return value
}
