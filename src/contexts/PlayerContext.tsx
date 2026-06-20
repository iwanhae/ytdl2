import React, { createContext, useContext, useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { type FileInfo, type Scope, getFileUrl } from '../lib/api';

interface PlayerContextType {
    currentFile: FileInfo | null;
    isPlaying: boolean;
    playlist: FileInfo[];
    queue: FileInfo[];
    scope: Scope;
    setScope: (scope: Scope) => void;
    play: (file: FileInfo) => void;
    pause: () => void;
    toggle: () => void;
    next: () => void;
    prev: () => void;
    setPlaylist: (files: FileInfo[]) => void;
    audioRef: React.RefObject<HTMLAudioElement | null>;
    progress: number;
    duration: number;
    seek: (time: number) => void;
    analyser: AnalyserNode | null;
}

/**
 * Touch-primary device (phone/tablet). These platforms suspend the
 * AudioContext in the background, so we keep a plain media element there to
 * preserve background/lock-screen playback. Desktops — including touch-screen
 * laptops, which report a fine primary pointer — get the real analyser graph.
 */
function isMobileDevice(): boolean {
    if (typeof window === 'undefined') return false;
    const coarse = window.matchMedia?.('(pointer: coarse)')?.matches ?? false;
    const ua = navigator.userAgent || '';
    return coarse || /Mobi|Android|iPhone|iPod/i.test(ua);
}

const PlayerContext = createContext<PlayerContextType | undefined>(undefined);

export function PlayerProvider({ children }: { children: React.ReactNode }) {
    const [currentFile, setCurrentFile] = useState<FileInfo | null>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [playlist, setPlaylist] = useState<FileInfo[]>([]);
    const [scope, setScope] = useState<Scope>('all');
    const [progress, setProgress] = useState(0);
    const [duration, setDuration] = useState(0);
    const [analyser, setAnalyser] = useState<AnalyserNode | null>(null);
    const audioRef = useRef<HTMLAudioElement>(null);
    const audioCtxRef = useRef<AudioContext | null>(null);

    // The play queue is the playlist filtered to the active scope. next/prev
    // and auto-advance walk this, so listening never crosses categories.
    const queue = useMemo(
        () => (scope === 'all' ? playlist : playlist.filter((f) => f.category === scope)),
        [playlist, scope],
    );

    /**
     * Build the Web Audio graph (element -> analyser -> output) lazily, on the
     * first user-initiated play — desktop only. On touch devices we skip this
     * entirely and keep a plain media element: createMediaElementSource
     * captures the element's output into the AudioContext, and mobile browsers
     * suspend that context in the background (WebKit #231105), which kills
     * background/lock-screen playback. Desktop keeps the real analyser meter.
     */
    const ensureGraph = useCallback((): AudioContext | null => {
        if (audioCtxRef.current) return audioCtxRef.current;
        if (isMobileDevice()) return null;
        const el = audioRef.current;
        if (!el) return null;
        try {
            const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
            if (!Ctor) return null;
            const ctx = new Ctor();
            const source = ctx.createMediaElementSource(el);
            const an = ctx.createAnalyser();
            an.fftSize = 128;
            an.smoothingTimeConstant = 0.82;
            source.connect(an);
            an.connect(ctx.destination);
            audioCtxRef.current = ctx;
            setAnalyser(an);
            return ctx;
        } catch (e) {
            console.error('Audio graph init failed:', e);
            return null;
        }
    }, []);

    const play = useCallback((file: FileInfo) => {
        const ctx = ensureGraph();
        if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => {});
        if (currentFile?.name === file.name) {
            audioRef.current?.play();
        } else {
            setCurrentFile(file);
            // Auto-play is handled by useEffect when currentFile changes
        }
    }, [currentFile, ensureGraph]);

    const pause = useCallback(() => {
        audioRef.current?.pause();
    }, []);

    const toggle = useCallback(() => {
        if (isPlaying) {
            pause();
        } else if (currentFile) {
            const ctx = ensureGraph();
            if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => {});
            audioRef.current?.play();
        }
    }, [isPlaying, currentFile, pause, ensureGraph]);

    const next = useCallback(() => {
        if (queue.length === 0) return;
        const currentIndex = currentFile ? queue.findIndex((f) => f.name === currentFile.name) : -1;
        // If the current track is outside the active scope, jump to the top of
        // the queue. We don't interrupt mid-play; this fires on Next/end-of-track.
        if (currentIndex === -1) {
            play(queue[0]);
            return;
        }
        if (currentIndex === queue.length - 1) return;
        play(queue[currentIndex + 1]);
    }, [currentFile, queue, play]);

    const prev = useCallback(() => {
        if (queue.length === 0) return;
        const currentIndex = currentFile ? queue.findIndex((f) => f.name === currentFile.name) : -1;
        if (currentIndex <= 0) return; // nothing previous in scope
        play(queue[currentIndex - 1]);
    }, [currentFile, queue, play]);

    const seek = useCallback((time: number) => {
        if (audioRef.current) {
            audioRef.current.currentTime = time;
        }
    }, []);

    // Handle file change
    useEffect(() => {
        if (currentFile && audioRef.current) {
            audioRef.current.src = getFileUrl(currentFile.name);
            audioRef.current.play().catch(e => console.error("Play failed:", e));

            // Update MediaSession
            if ('mediaSession' in navigator) {
                navigator.mediaSession.metadata = new MediaMetadata({
                    title: currentFile.name.replace(/\.[^/.]+$/, ""),
                    artist: 'ytdl2',
                    artwork: [
                        { src: '/icon-512.png', sizes: '512x512', type: 'image/png' }
                    ]
                });
            }
        }
    }, [currentFile]);

    // Handle MediaSession actions
    useEffect(() => {
        if ('mediaSession' in navigator) {
            navigator.mediaSession.setActionHandler('play', () => {
                audioRef.current?.play();
            });
            navigator.mediaSession.setActionHandler('pause', () => {
                audioRef.current?.pause();
            });
            navigator.mediaSession.setActionHandler('previoustrack', prev);
            navigator.mediaSession.setActionHandler('nexttrack', next);
        }
    }, [prev, next]);

    // Audio event listeners
    useEffect(() => {
        const audio = audioRef.current;
        if (!audio) return;

        const onPlay = () => setIsPlaying(true);
        const onPause = () => setIsPlaying(false);
        const onTimeUpdate = () => setProgress(audio.currentTime);
        const onDurationChange = () => setDuration(audio.duration);
        const onEnded = () => {
            setIsPlaying(false);
            next(); // Auto-play next
        };

        audio.addEventListener('play', onPlay);
        audio.addEventListener('pause', onPause);
        audio.addEventListener('timeupdate', onTimeUpdate);
        audio.addEventListener('durationchange', onDurationChange);
        audio.addEventListener('ended', onEnded);

        return () => {
            audio.removeEventListener('play', onPlay);
            audio.removeEventListener('pause', onPause);
            audio.removeEventListener('timeupdate', onTimeUpdate);
            audio.removeEventListener('durationchange', onDurationChange);
            audio.removeEventListener('ended', onEnded);
        };
    }, [next]);

    return (
        <PlayerContext.Provider value={{
            currentFile,
            isPlaying,
            playlist,
            queue,
            scope,
            setScope,
            play,
            pause,
            toggle,
            next,
            prev,
            setPlaylist,
            audioRef,
            progress,
            duration,
            seek,
            analyser
        }}>
            <audio ref={audioRef} />
            {children}
        </PlayerContext.Provider>
    );
}

export function usePlayer() {
    const context = useContext(PlayerContext);
    if (context === undefined) {
        throw new Error('usePlayer must be used within a PlayerProvider');
    }
    return context;
}
