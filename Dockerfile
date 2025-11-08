# Build stage
FROM golang:1.24-alpine AS builder

WORKDIR /app

# Install build dependencies
RUN apk add --no-cache git

# Copy go mod files
COPY go.mod ./
RUN go mod download

# Copy source code
COPY . .

# Build the application
RUN CGO_ENABLED=0 GOOS=linux go build -a -installsuffix cgo -o ytdl2-server ./main.go

# Runtime stage
FROM alpine:latest

# Install runtime dependencies
RUN apk add --no-cache \
  ca-certificates \
  python3 \
  py3-pip \
  ffmpeg 

RUN pip3 install --no-cache-dir --break-system-packages yt-dlp

# Create app directory
WORKDIR /app

# Copy binary from builder
COPY --from=builder /app/ytdl2-server .

# Copy static files
COPY --from=builder /app/static ./static

# Create download directory
RUN mkdir -p /app/data && chmod 755 /app/data

# Expose port
EXPOSE 8080

# Set environment variables
ENV DOWNLOAD_DIRECTORY=/app/data
VOLUME /app/data

# Run the application
CMD ["./ytdl2-server"]

