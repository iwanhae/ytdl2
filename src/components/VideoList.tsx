import React, { useEffect, useState } from 'react';
import { type FileInfo, getFiles, deleteFile, extractAudio } from '../lib/api';
import { usePlayer } from '../contexts/PlayerContext';

export default function VideoList({ refreshKey }: { refreshKey?: number }) {
    const [files, setFiles] = useState<FileInfo[]>([]);
    const { play, currentFile, setPlaylist } = usePlayer();
    const [loading, setLoading] = useState(true);

    const loadFiles = async () => {
        setLoading(true);
        try {
            const data = await getFiles();
            // Sort by mod_time desc
            const sorted = data.sort((a, b) => new Date(b.mod_time).getTime() - new Date(a.mod_time).getTime());
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

    const handleDelete = async (e: React.MouseEvent, filename: string) => {
        e.stopPropagation();
        if (!confirm(`Delete ${filename}?`)) return;
        try {
            await deleteFile(filename);
            loadFiles();
        } catch (error) {
            alert('Failed to delete file');
        }
    };

    const handleExtract = async (e: React.MouseEvent, filename: string) => {
        e.stopPropagation();
        try {
            await extractAudio(filename);
            alert('Extraction started');
        } catch (error) {
            alert('Failed to start extraction');
        }
    };

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold text-text">Downloaded Files</h2>
                <button
                    onClick={loadFiles}
                    className="p-2 text-primary hover:bg-primary/10 rounded-full transition-colors"
                    title="Refresh list"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.3" /></svg>
                </button>
            </div>

            {loading && files.length === 0 ? (
                <div className="text-center py-8 text-text-secondary">Loading files...</div>
            ) : files.length === 0 ? (
                <div className="text-center py-8 text-text-secondary">No files downloaded yet</div>
            ) : (
                <div className="space-y-2">
                    {files.map((file) => {
                        const isPlaying = currentFile?.name === file.name;
                        const isAudio = file.name.endsWith('.mp3');

                        return (
                            <div
                                key={file.name}
                                onClick={() => play(file)}
                                className={`
                  group flex items-center p-3 rounded-lg cursor-pointer transition-colors
                  ${isPlaying ? 'bg-primary/10' : 'hover:bg-surface'}
                `}
                            >
                                {/* Icon */}
                                <div className={`
                  w-10 h-10 rounded-full flex items-center justify-center mr-4
                  ${isPlaying ? 'bg-primary text-white' : 'bg-border text-text-secondary'}
                `}>
                                    {isPlaying ? (
                                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect></svg>
                                    ) : (
                                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
                                    )}
                                </div>

                                {/* Info */}
                                <div className="flex-1 min-w-0">
                                    <h3 className={`font-medium truncate ${isPlaying ? 'text-primary' : 'text-text'}`}>
                                        {file.name}
                                    </h3>
                                    <p className="text-xs text-text-secondary">
                                        {new Date(file.mod_time).toLocaleDateString()} • {(file.size / 1024 / 1024).toFixed(1)} MB
                                    </p>
                                </div>

                                {/* Actions */}
                                <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                    {!isAudio && (
                                        <button
                                            onClick={(e) => handleExtract(e, file.name)}
                                            className="p-2 text-text-secondary hover:text-primary"
                                            title="Extract Audio"
                                        >
                                            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18V5l12-2v13"></path><circle cx="6" cy="18" r="3"></circle><circle cx="18" cy="16" r="3"></circle></svg>
                                        </button>
                                    )}
                                    <button
                                        onClick={(e) => handleDelete(e, file.name)}
                                        className="p-2 text-text-secondary hover:text-red-500"
                                        title="Delete"
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
