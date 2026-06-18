import { useState } from 'react';
import type { FormEvent } from 'react';
import { startDownload } from '../lib/api';

type Notice = { kind: 'ok' | 'err'; msg: string };

export default function DownloadForm() {
    const [url, setUrl] = useState('');
    const [loading, setLoading] = useState(false);
    const [notice, setNotice] = useState<Notice | null>(null);

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        if (!url.trim()) return;

        setLoading(true);
        setNotice(null);

        try {
            await startDownload(url);
            setNotice({ kind: 'ok', msg: 'Download started' });
            setUrl('');
            setTimeout(() => setNotice(null), 3000);
        } catch (err) {
            setNotice({
                kind: 'err',
                msg: err instanceof Error ? err.message : 'Failed to start download',
            });
        } finally {
            setLoading(false);
        }
    };

    return (
        <section className="mb-10">
            <div className="flex items-center justify-between">
                <span className="silkscreen">Input</span>
                <span className="silkscreen text-dust">source · url</span>
            </div>

            <form onSubmit={handleSubmit} className="mt-2">
                <div className="field-shell flex items-center gap-2 rounded pl-3 pr-1.5">
                    <span aria-hidden className="select-none font-mono text-amber">❯</span>
                    <input
                        type="url"
                        value={url}
                        onChange={(e) => setUrl(e.target.value)}
                        placeholder="paste a youtube url"
                        disabled={loading}
                        autoCapitalize="off"
                        autoCorrect="off"
                        spellCheck={false}
                        className="flex-1 bg-transparent py-3 font-mono text-sm text-ink placeholder:text-dust focus:outline-none"
                    />
                    <button
                        type="submit"
                        disabled={loading || !url.trim()}
                        className="btn-run my-1.5"
                    >
                        {loading ? '···' : 'Download'}
                    </button>
                </div>

                {notice && (
                    <div
                        className={`mt-2 inline-flex items-center gap-1.5 chip ${
                            notice.kind === 'ok'
                                ? 'border-teal/30 bg-teal/10 text-teal'
                                : 'border-rust/30 bg-rust/10 text-rust'
                        }`}
                    >
                        <span
                            className={`h-1.5 w-1.5 rounded-full ${
                                notice.kind === 'ok' ? 'bg-teal' : 'bg-rust'
                            }`}
                        />
                        {notice.msg}
                    </div>
                )}
            </form>
        </section>
    );
}
