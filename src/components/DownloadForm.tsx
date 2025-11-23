import React, { useState } from 'react';
import { startDownload } from '../lib/api';

export default function DownloadForm() {
    const [url, setUrl] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!url.trim()) return;

        setLoading(true);
        setError(null);
        setSuccess(null);

        try {
            await startDownload(url);
            setSuccess('Download started successfully');
            setUrl('');
            setTimeout(() => setSuccess(null), 3000);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to start download');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="mb-8">
            <form onSubmit={handleSubmit} className="relative">
                <input
                    type="url"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    placeholder="Paste YouTube URL..."
                    className="input-field pr-24"
                    disabled={loading}
                />
                <button
                    type="submit"
                    disabled={loading || !url.trim()}
                    className="absolute right-2 top-1/2 -translate-y-1/2 btn-primary text-sm py-1.5"
                >
                    {loading ? 'Adding...' : 'Download'}
                </button>
            </form>

            {error && (
                <div className="mt-2 text-red-500 text-sm bg-red-500/10 p-2 rounded">
                    {error}
                </div>
            )}
            {success && (
                <div className="mt-2 text-green-500 text-sm bg-green-500/10 p-2 rounded">
                    {success}
                </div>
            )}
        </div>
    );
}
