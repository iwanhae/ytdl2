package main

import (
	"log"
	"net/http"
	"os"
	"strconv"

	"github.com/iwanhae/ytdl2/internal/server"
)

var (
	downloadDirectory   = getEnv("DOWNLOAD_DIRECTORY", "./data")
	staticDirectory     = getEnv("STATIC_DIRECTORY", "./static")
	categoryThreshold   = getEnvInt("CATEGORY_THRESHOLD_SECONDS", 360) // >= this many seconds is guessed "podcast"
)

func main() {
	log.Printf("Download directory: %s", downloadDirectory)
	if err := os.MkdirAll(downloadDirectory, 0755); err != nil {
		log.Fatalf("Failed to create download directory: %v", err)
	}

	s := server.NewServer(downloadDirectory, staticDirectory, float64(categoryThreshold))
	// Migrate a pre-existing library: probe durations and guess categories in
	// the background so startup isn't blocked.
	s.ScanLibrary()

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

func getEnvInt(key string, defaultValue int) int {
	value := os.Getenv(key)
	if value == "" {
		return defaultValue
	}
	n, err := strconv.Atoi(value)
	if err != nil {
		log.Printf("Invalid %s=%q, using default %d: %v", key, value, defaultValue, err)
		return defaultValue
	}
	return n
}

