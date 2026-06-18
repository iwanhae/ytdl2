import { useEffect, useState } from 'react';
import type { MouseEvent } from 'react';
import { type FileInfo, getFiles, deleteFile, extractAudio, getFileUrl } from '../lib/api';
import { usePlayer } from '../contexts/PlayerContext';

function extOf(name: string): string {
    const i = name.lastIndexOf('.');
    return i >= 0 ? name.slice(i + 1).toUpperCase() : 'FILE';
}

function fmtSize(bytes: number): string {
    if (bytes >= 1e9) return `${(bytes / 1e9).toFixed(2)} GB`;
    if (bytes >= 1e6) return `${(bytes / 1e6).toFixed(1)} MB`;
    return `${Math.max(1, Math.round(bytes / 1e3))} KB`;
}

function EqIcon() {
    return (
        <span className="flex h-3.5 items-end gap-[2px]" aria-hidden>
            <span className="eq-bar h-3.5" style={{ animationDelay: '0ms' }} />
            <span className="eq-bar h-3.5" style={{ animationDelay: '180ms' }} />
            <span className="eq-bar h-3.5" style={{ animationDelay: '360ms' }} />
        </span>
    );
}

const ICON = {
    refresh: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.3" /></svg>
    ),
    download: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>
    ),
    note: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18V5l12-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" /></svg>
    ),
    trash: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>
    ),
};

export default function VideoList({ refreshKey }: { refreshKey?: number }) {
    const [files, setFiles] = useState<FileInfo[]>([]);
    const [loading, setLoading] = useState(true);
    const [status, setStatus] = useState<string | null>(null);
    const { play, currentFile, setPlaylist } = usePlayer();

    const loadFiles = async () => {
        setLoading(true);
        try {
            const data = await getFiles();
            // Sort by mod_time desc
            const sorted = data.sort(
                (a, b) => new Date(b.mod_time).getTime() - new Date(a.mod_time).getTime(),
            );
            setFiles(sorted);
            setPlaylist(sorted);
        } catch (error) {
            console.error('Failed to load files:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadFiles();
    }, [refreshKey]);

    const flash = (msg: string) => {
        setStatus(msg);
        setTimeout(() => setStatus(null), 3000);
    };

    const handleDelete = async (e: MouseEvent, filename: string) => {
        e.stopPropagation();
        if (!confirm(`Delete ${filename}?`)) return;
        try {
            await deleteFile(filename);
            loadFiles();
        } catch {
            flash('Failed to delete file');
        }
    };

    const handleExtract = async (e: MouseEvent, filename: string) => {
        e.stopPropagation();
        try {
            await extractAudio(filename);
            flash('Extracting audio — watch Active');
            setTimeout(loadFiles, 2500);
        } catch {
            flash('Failed to start extraction');
        }
    };

    return (
        <section>
            <div className="flex items-center justify-between">
                <span className="silkscreen">Library</span>
                <div className="flex items-center gap-3">
                    {files.length > 0 && (
                        <span className="silkscreen text-dust">
                            {files.length} file{files.length > 1 ? 's' : ''}
                        </span>
                    )}
                    <button
                        onClick={loadFiles}
                        className="btn-ghost"
                        title="Refresh library"
                        aria-label="Refresh library"
                    >
                        {ICON.refresh}
                    </button>
                </div>
            </div>

            {status && (
                <div className="mt-2 inline-flex items-center gap-1.5 chip border-amber/30 bg-amber/10 text-amber">
                    {status}
                </div>
            )}

            <div className="mt-3">
                {loading && files.length === 0 ? (
                    <div className="py-10 font-mono text-sm text-ash">▒ reading library…</div>
                ) : files.length === 0 ? (
                    <div className="rounded border border-dashed border-line px-4 py-10 text-center">
                        <div className="font-mono text-sm text-ash">▒ library empty</div>
                        <p className="mt-2 font-sans text-sm text-dust">
                            Paste a link above to record your first track.
                        </p>
                    </div>
                ) : (
                    <ul className="space-y-px">
                        {files.map((file, idx) => {
                            const isPlaying = currentFile?.name === file.name;
                            const isAudio = file.name.endsWith('.mp3');

                            return (
                                <li key={file.name}>
                                    <div
                                        onClick={() => play(file)}
                                        className={`group flex cursor-pointer items-center gap-3 rounded-md px-2.5 py-2.5 transition-colors ${
                                            isPlaying ? 'bg-recess' : 'hover:bg-recess'
                                        }`}
                                    >
                                        <div className="w-6 shrink-0 text-center">
                                            {isPlaying ? (
                                                <EqIcon />
                                            ) : (
                                                <span className="font-mono text-[11px] tabular-nums text-dust">
                                                    {String(idx + 1).padStart(2, '0')}
                                                </span>
                                            )}
                                        </div>

                                        <div className="min-w-0 flex-1">
                                            <div
                                                className={`truncate font-mono text-[13px] ${
                                                    isPlaying ? 'text-amber' : 'text-ink'
                                                }`}
                                            >
                                                {file.name}
                                            </div>
                                            <div className="mt-0.5 flex items-center gap-2 font-mono text-[11px] text-dust">
                                                <span>
                                                    {new Date(file.mod_time).toLocaleDateString()}
                                                </span>
                                                <span>·</span>
                                                <span>{fmtSize(file.size)}</span>
                                            </div>
                                        </div>

                                        <span className="chip hidden border-line text-ash sm:inline-flex">
                                            {extOf(file.name)}
                                        </span>

                                        <div className="flex items-center gap-0.5 transition-opacity sm:opacity-0 sm:focus-within:opacity-100 sm:group-hover:opacity-100">
                                            <a
                                                href={getFileUrl(file.name)}
                                                download
                                                onClick={(e) => e.stopPropagation()}
                                                className="btn-ghost"
                                                title="Download file"
                                                aria-label={`Download ${file.name}`}
                                            >
                                                {ICON.download}
                                            </a>
                                            {!isAudio && (
                                                <button
                                                    onClick={(e) => handleExtract(e, file.name)}
                                                    className="btn-ghost"
                                                    title="Extract audio"
                                                    aria-label={`Extract audio from ${file.name}`}
                                                >
                                                    {ICON.note}
                                                </button>
                                            )}
                                            <button
                                                onClick={(e) => handleDelete(e, file.name)}
                                                className="btn-ghost hover:!text-rust"
                                                title="Delete"
                                                aria-label={`Delete ${file.name}`}
                                            >
                                                {ICON.trash}
                                            </button>
                                        </div>
                                    </div>
                                </li>
                            );
                        })}
                    </ul>
                )}
            </div>
        </section>
    );
}
