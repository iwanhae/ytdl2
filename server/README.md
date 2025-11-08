# YouTube Downloader Server

YouTube 동영상을 다운로드하는 웹 서버입니다.

## 기능

- YouTube URL을 통한 동영상 다운로드
- 실시간 다운로드 상태 모니터링 (SSE)
- 다운로드된 파일 목록 및 관리
- 파일 다운로드 및 삭제

## 요구사항

- Go 1.24+
- yt-dlp
- ffmpeg (비디오/오디오 병합용)

## 로컬 실행

```bash
# 의존성 설치
go mod download

# 서버 실행
go run main.go
```

서버는 `http://localhost:8080`에서 실행됩니다.

## Docker로 실행

### Dockerfile 사용

```bash
# 이미지 빌드
docker build -t ytdl2-server .

# 컨테이너 실행
docker run -d \
  -p 8080:8080 \
  -v $(pwd)/data:/app/data \
  -e DOWNLOAD_DIRECTORY=/app/data \
  --name ytdl2-server \
  ytdl2-server
```

### docker-compose 사용

```bash
# 빌드 및 실행
docker-compose up -d

# 로그 확인
docker-compose logs -f

# 중지
docker-compose down
```

## 환경 변수

- `DOWNLOAD_DIRECTORY`: 다운로드 파일 저장 디렉토리 (기본값: `./data`)

## API 엔드포인트

- `POST /api/yt-dlp` - 다운로드 시작
- `GET /api/commands` - 커맨드 목록 조회
- `GET /api/commands/stream` - 커맨드 상태 실시간 스트리밍 (SSE)
- `GET /api/commands/{id}/logs` - 커맨드 로그 조회
- `GET /api/commands/{id}/logs/stream` - 커맨드 로그 실시간 스트리밍 (SSE)
- `GET /api/files` - 파일 목록 조회
- `GET /api/files/{filename}` - 파일 다운로드
- `DELETE /api/files/{filename}` - 파일 삭제

## 라이선스

MIT

