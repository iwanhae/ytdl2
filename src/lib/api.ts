export const API_BASE = '/api';

export interface Command {
    id: string;
    url: string;
    status: 'running' | 'completed' | 'failed';
    started_at: string;
    exit_code?: number;
}

export interface FileInfo {
    name: string;
    size: number;
    mod_time: string;
}

export interface AudioExtractionResponse {
    status: string;
    message?: string;
    filename?: string;
    download_url?: string;
    error?: string;
}

export async function startDownload(url: string): Promise<{ status: string; id: string }> {
    const response = await fetch(`${API_BASE}/yt-dlp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
    });

    if (!response.ok) {
        const error = await response.text();
        throw new Error(error || 'Failed to start download');
    }

    return response.json();
}

export async function getFiles(): Promise<FileInfo[]> {
    const response = await fetch(`${API_BASE}/files`);
    if (!response.ok) throw new Error('Failed to fetch files');
    const data = await response.json();
    return data.files || [];
}

export async function deleteFile(filename: string): Promise<void> {
    const response = await fetch(`${API_BASE}/files/${encodeURIComponent(filename)}`, {
        method: 'DELETE',
    });
    if (!response.ok) throw new Error('Failed to delete file');
}

export async function extractAudio(filename: string): Promise<AudioExtractionResponse> {
    const response = await fetch(`${API_BASE}/files/${encodeURIComponent(filename)}/extract-audio`, {
        method: 'POST',
    });
    return response.json();
}

export function getFileUrl(filename: string): string {
    return `${API_BASE}/files/${encodeURIComponent(filename)}`;
}
