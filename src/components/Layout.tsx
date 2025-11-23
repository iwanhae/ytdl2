import React from 'react';
import Player from './Player';

export default function Layout({ children }: { children: React.ReactNode }) {
    return (
        <div className="min-h-screen bg-background text-text pb-24">
            <header className="sticky top-0 z-10 bg-background/80 backdrop-blur-md border-b border-border">
                <div className="max-w-2xl mx-auto px-4 py-4 flex items-center justify-between">
                    <h1 className="text-xl font-bold text-primary">YTDL2</h1>
                </div>
            </header>

            <main className="max-w-2xl mx-auto px-4 py-6">
                {children}
            </main>

            <Player />
        </div>
    );
}
