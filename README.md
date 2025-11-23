# YouTube Downloader Server

A modern web application for downloading YouTube videos, built with Go and React.

## Features

-   **Video Download**: Download YouTube videos in high quality.
-   **Audio Extraction**: Extract audio from videos as MP3.
-   **Real-time Updates**: Monitor download progress via Server-Sent Events (SSE).
-   **File Management**: View, download, and delete downloaded files.
-   **PWA Support**: Installable as a Progressive Web App.
-   **Responsive UI**: Modern interface built with TailwindCSS.

## Tech Stack

-   **Backend**: Go 1.24+, `yt-dlp`, `ffmpeg`
-   **Frontend**: React 19, Vite, TailwindCSS, TypeScript
-   **Database**: In-memory (for command tracking)

## Prerequisites

-   [Go](https://go.dev/) 1.24 or higher
-   [Node.js](https://nodejs.org/) 20+ (for frontend development)
-   [yt-dlp](https://github.com/yt-dlp/yt-dlp) (must be in PATH)
-   [ffmpeg](https://ffmpeg.org/) (must be in PATH)

## Getting Started

### Local Development

1.  **Backend**:
    ```bash
    # Install Go dependencies
    go mod download

    # Run the server
    go run main.go
    ```
    The server will start at `http://localhost:8080`.

2.  **Frontend**:
    ```bash
    # Install Node dependencies
    npm install

    # Start development server
    npm run dev
    ```
    The frontend development server will start at `http://localhost:5173`.
    *Note: You may need to configure a proxy in `vite.config.ts` to forward API requests to the backend if running separately.*

### Production Build

To run the application in production mode, you need to build the frontend and serve it via the Go backend.

1.  **Build Frontend**:
    ```bash
    npm run build
    ```
    This will create a `dist` directory with the compiled assets.

2.  **Prepare Static Files**:
    The Go server expects static files in the `static` directory.
    ```bash
    # Remove existing static files
    rm -rf static/*

    # Copy build artifacts
    cp -r dist/* static/
    ```

3.  **Run Server**:
    ```bash
    go run main.go
    ```
    Access the application at `http://localhost:8080`.

## Docker Deployment

The Dockerfile assumes the frontend has been built and placed in the `static` directory **before** building the image.

1.  **Build Frontend** (as described above).
2.  **Build Docker Image**:
    ```bash
    docker build -t ytdl2-server .
    ```
3.  **Run Container**:
    ```bash
    docker run -d \
      -p 8080:8080 \
      -v $(pwd)/data:/app/data \
      -e DOWNLOAD_DIRECTORY=/app/data \
      --name ytdl2-server \
      ytdl2-server
    ```

## API Documentation

### Commands

-   **Start Download**: `POST /api/yt-dlp`
    ```json
    { "url": "https://youtube.com/watch?v=..." }
    ```
-   **List Commands**: `GET /api/commands`
-   **Command Stream**: `GET /api/commands/stream` (SSE)
-   **Command Logs**: `GET /api/commands/{id}/logs`
-   **Log Stream**: `GET /api/commands/{id}/logs/stream` (SSE)

### Files

-   **List Files**: `GET /api/files`
-   **Download File**: `GET /api/files/{filename}`
-   **Delete File**: `DELETE /api/files/{filename}`
-   **Extract Audio**: `POST /api/files/{filename}/extract-audio`
    *   Extracts audio to MP3 format.
    *   Returns job ID for tracking progress.

## License

MIT
