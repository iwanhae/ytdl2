import type React from 'react';
import Player from './Player';
import { useNow } from '../lib/useNow';

function Clock() {
    const now = useNow(1000);
    const t = new Date(now);
    const hh = String(t.getHours()).padStart(2, '0');
    const mm = String(t.getMinutes()).padStart(2, '0');
    const ss = String(t.getSeconds()).padStart(2, '0');
    return <span className="tabular-nums">{hh}:{mm}:{ss}</span>;
}

export default function Layout({ children }: { children: React.ReactNode }) {
    return (
        <div className="min-h-screen bg-void text-ink pb-36">
            <header className="sticky top-0 z-20 border-b border-line bg-void/85 backdrop-blur-md">
                <div className="mx-auto flex h-14 max-w-2xl items-center justify-between px-4 sm:px-6">
                    <div className="flex min-w-0 items-center gap-2.5">
                        <span className="h-2 w-2 shrink-0 rounded-full bg-amber shadow-[0_0_8px_rgba(255,176,0,0.7)]" />
                        <span className="font-mono text-[15px] font-semibold tracking-tight text-ink">
                            ytdl<span className="text-amber">2</span>
                        </span>
                        <span className="silkscreen hidden text-dust sm:inline">yt-dlp deck</span>
                    </div>
                    <div className="flex items-center gap-2 font-mono text-xs text-ash">
                        <span className="silkscreen hidden text-dust sm:inline">local</span>
                        <Clock />
                    </div>
                </div>
            </header>

            <main className="mx-auto max-w-2xl px-4 pb-8 pt-8 sm:px-6">{children}</main>

            <Player />
        </div>
    );
}
