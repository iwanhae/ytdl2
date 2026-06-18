import { useEffect, useRef, useState } from 'react';
import { usePlayer } from '../contexts/PlayerContext';

const BARS = 18;

function fmt(t: number): string {
    if (!isFinite(t) || t <= 0) return '0:00';
    const m = Math.floor(t / 60);
    const s = Math.floor(t % 60);
    return `${m}:${String(s).padStart(2, '0')}`;
}

/** Amber LED ladder driven by the live audio analyser. */
function LevelMeter({ analyser, active }: { analyser: AnalyserNode | null; active: boolean }) {
    const reduced = useRef(
        typeof window !== 'undefined' &&
            window.matchMedia?.('(prefers-reduced-motion: reduce)').matches,
    ).current;
    const [levels, setLevels] = useState<number[]>(() =>
        new Array(BARS).fill(reduced ? 0.1 : 0),
    );
    const raf = useRef<number | null>(null);

    useEffect(() => {
        if (!analyser || !active || reduced) {
            if (raf.current) cancelAnimationFrame(raf.current);
            setLevels(new Array(BARS).fill(reduced ? 0.1 : 0));
            return;
        }

        const bins = analyser.frequencyBinCount;
        const data = new Uint8Array(bins);

        const loop = () => {
            analyser.getByteFrequencyData(data);
            const out = new Array(BARS);
            // sample the lower 3/4 of the spectrum, where the music lives
            for (let i = 0; i < BARS; i++) {
                const idx = Math.floor((i / BARS) * (bins * 0.75));
                out[i] = data[idx] / 255;
            }
            setLevels(out);
            raf.current = requestAnimationFrame(loop);
        };
        raf.current = requestAnimationFrame(loop);

        return () => {
            if (raf.current) cancelAnimationFrame(raf.current);
        };
    }, [analyser, active, reduced]);

    return (
        <div className="flex h-6 items-end gap-[2px]" aria-hidden>
            {levels.map((v, i) => {
                const lit = v > 0.02;
                return (
                    <span
                        key={i}
                        className="w-[3px] rounded-sm"
                        style={{
                            height: `${Math.max(8, v * 100)}%`,
                            background: lit ? 'var(--color-amber)' : 'var(--color-line-bright)',
                            opacity: lit ? 0.45 + v * 0.55 : 0.5,
                        }}
                    />
                );
            })}
        </div>
    );
}

export default function Player() {
    const { currentFile, isPlaying, toggle, next, prev, progress, duration, seek, analyser } =
        usePlayer();

    if (!currentFile) return null;

    const pct = duration ? (progress / duration) * 100 : 0;
    const title = currentFile.name.replace(/\.[^.]+$/, '');

    const onScrub = (e: React.MouseEvent<HTMLDivElement>) => {
        const rect = e.currentTarget.getBoundingClientRect();
        const ratio = (e.clientX - rect.left) / rect.width;
        seek(ratio * duration);
    };

    return (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-void/92 backdrop-blur-lg">
            <div className="mx-auto max-w-2xl px-4 py-3 sm:px-6">
                {/* scrubber */}
                <div className="flex items-center gap-3">
                    <span className="w-10 text-right font-mono text-[11px] tabular-nums text-ash">
                        {fmt(progress)}
                    </span>
                    <div
                        onClick={onScrub}
                        onKeyDown={(e) => {
                            if (e.key === 'ArrowRight') seek(Math.min(duration, progress + 5));
                            else if (e.key === 'ArrowLeft') seek(Math.max(0, progress - 5));
                        }}
                        role="slider"
                        aria-label="Seek"
                        aria-valuenow={Math.round(pct)}
                        aria-valuemin={0}
                        aria-valuemax={100}
                        tabIndex={0}
                        className="group relative w-full cursor-pointer py-2"
                    >
                        <div className="h-[3px] rounded-full bg-line">
                            <div
                                className="relative h-full rounded-full bg-amber"
                                style={{ width: `${pct}%` }}
                            >
                                <span className="absolute right-0 top-1/2 h-3 w-3 -translate-y-1/2 translate-x-1/2 rounded-full bg-amber-soft opacity-0 shadow-[0_0_8px_rgba(255,176,0,0.7)] transition-opacity group-hover:opacity-100" />
                            </div>
                        </div>
                    </div>
                    <span className="w-10 font-mono text-[11px] tabular-nums text-ash">
                        {fmt(duration)}
                    </span>
                </div>

                {/* transport */}
                <div className="mt-1 flex items-center justify-between gap-3">
                    <div className="min-w-0 flex-1">
                        <div className="silkscreen text-dust">Now playing</div>
                        <div className="truncate font-mono text-[13px] text-ink">{title}</div>
                    </div>

                    <div className="flex items-center gap-1">
                        <button onClick={prev} className="btn-ghost" aria-label="Previous">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><polygon points="19 20 9 12 19 4 19 20" /><rect x="5" y="5" width="1.6" height="14" /></svg>
                        </button>
                        <button
                            onClick={toggle}
                            className="flex h-10 w-10 items-center justify-center rounded-full bg-amber text-void shadow-[0_0_14px_rgba(255,176,0,0.4)] transition-colors hover:bg-amber-soft"
                            aria-label={isPlaying ? 'Pause' : 'Play'}
                        >
                            {isPlaying ? (
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="5" width="4" height="14" /><rect x="14" y="5" width="4" height="14" /></svg>
                            ) : (
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><polygon points="6 4 20 12 6 20 6 4" /></svg>
                            )}
                        </button>
                        <button onClick={next} className="btn-ghost" aria-label="Next">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 4 15 12 5 20 5 4" /><rect x="17.4" y="5" width="1.6" height="14" /></svg>
                        </button>
                    </div>

                    <div className="hidden w-28 shrink-0 sm:block">
                        <LevelMeter analyser={analyser} active={isPlaying} />
                    </div>
                </div>
            </div>
        </div>
    );
}
