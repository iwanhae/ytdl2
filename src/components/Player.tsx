import { usePlayer } from '../contexts/PlayerContext';

export default function Player() {
    const { currentFile, isPlaying, toggle, next, prev, progress, duration, seek } = usePlayer();

    if (!currentFile) return null;

    const formatTime = (time: number) => {
        const minutes = Math.floor(time / 60);
        const seconds = Math.floor(time % 60);
        return `${minutes}:${seconds.toString().padStart(2, '0')}`;
    };

    return (
        <div className="fixed bottom-0 left-0 right-0 bg-surface border-t border-border p-4 backdrop-blur-lg bg-opacity-95">
            <div className="max-w-2xl mx-auto">
                {/* Progress Bar */}
                <div className="w-full h-1 bg-border rounded-full mb-4 cursor-pointer group"
                    onClick={(e) => {
                        const rect = e.currentTarget.getBoundingClientRect();
                        const x = e.clientX - rect.left;
                        const percentage = x / rect.width;
                        seek(percentage * duration);
                    }}>
                    <div className="h-full bg-primary rounded-full relative group-hover:bg-blue-400 transition-colors"
                        style={{ width: `${(progress / duration) * 100}%` }}>
                        <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full opacity-0 group-hover:opacity-100 shadow-md transition-opacity" />
                    </div>
                </div>

                <div className="flex items-center justify-between">
                    {/* Info */}
                    <div className="flex-1 min-w-0 pr-4">
                        <h3 className="text-sm font-bold text-text truncate">{currentFile.name}</h3>
                        <p className="text-xs text-text-secondary">{formatTime(progress)} / {formatTime(duration)}</p>
                    </div>

                    {/* Controls */}
                    <div className="flex items-center gap-4">
                        <button onClick={prev} className="text-text-secondary hover:text-text transition-colors">
                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="19 20 9 12 19 4 19 20"></polygon><line x1="5" y1="19" x2="5" y2="5"></line></svg>
                        </button>

                        <button onClick={toggle} className="w-10 h-10 flex items-center justify-center bg-primary rounded-full text-white hover:bg-blue-500 transition-colors shadow-lg">
                            {isPlaying ? (
                                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect></svg>
                            ) : (
                                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
                            )}
                        </button>

                        <button onClick={next} className="text-text-secondary hover:text-text transition-colors">
                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="5 4 15 12 5 20 5 4"></polygon><line x1="19" y1="5" x2="19" y2="19"></line></svg>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
