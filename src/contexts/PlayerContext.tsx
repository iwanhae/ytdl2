import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { type FileInfo, getFileUrl } from '../lib/api';

interface PlayerContextType {
    currentFile: FileInfo | null;
    isPlaying: boolean;
    playlist: FileInfo[];
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

const PlayerContext = createContext<PlayerContextType | undefined>(undefined);

export function PlayerProvider({ children }: { children: React.ReactNode }) {
    const [currentFile, setCurrentFile] = useState<FileInfo | null>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [playlist, setPlaylist] = useState<FileInfo[]>([]);
    const [progress, setProgress] = useState(0);
    const [duration, setDuration] = useState(0);
    const [analyser, setAnalyser] = useState<AnalyserNode | null>(null);
    const audioRef = useRef<HTMLAudioElement>(null);
    const audioCtxRef = useRef<AudioContext | null>(null);

    /**
     * Build the Web Audio graph (element -> analyser -> output) lazily, on the
     * first user-initiated play. The analyser drives the transport's level
     * meter. If anything throws, audio keeps playing through the element's
     * default output and the meter simply stays quiet.
     */
    const ensureGraph = useCallback((): AudioContext | null => {
        if (audioCtxRef.current) return audioCtxRef.current;
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
        if (!currentFile || playlist.length === 0) return;
        const currentIndex = playlist.findIndex(f => f.name === currentFile.name);
        if (currentIndex === -1 || currentIndex === playlist.length - 1) return;
        play(playlist[currentIndex + 1]);
    }, [currentFile, playlist, play]);

    const prev = useCallback(() => {
        if (!currentFile || playlist.length === 0) return;
        const currentIndex = playlist.findIndex(f => f.name === currentFile.name);
        if (currentIndex <= 0) return;
        play(playlist[currentIndex - 1]);
    }, [currentFile, playlist, play]);

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
