import { useEffect, useState } from 'react';
import { API_BASE, type Command } from '../lib/api';

export default function CommandList() {
    const [commands, setCommands] = useState<Command[]>([]);

    useEffect(() => {
        const eventSource = new EventSource(`${API_BASE}/commands/stream`);

        eventSource.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                const allCommands = data.commands || [];
                // Filter only running commands
                const running = allCommands.filter((cmd: Command) => cmd.status === 'running');
                setCommands(running);
            } catch (error) {
                console.error('Failed to parse command stream:', error);
            }
        };

        eventSource.onerror = (error) => {
            console.error('Command stream error:', error);
            eventSource.close();
            // Retry after 5s
            setTimeout(() => {
                // Re-init handled by useEffect re-run if we were to trigger it, 
                // but here we just let it fail for simplicity or could implement retry logic.
                // For now, just simple error logging.
            }, 5000);
        };

        return () => {
            eventSource.close();
        };
    }, []);

    if (commands.length === 0) return null;

    return (
        <div className="mb-8">
            <h2 className="text-lg font-bold mb-4 text-text">Active Downloads</h2>
            <div className="space-y-3">
                {commands.map((cmd) => (
                    <div key={cmd.id} className="bg-surface border border-border rounded-lg p-4">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-sm font-mono text-text-secondary">{cmd.id}</span>
                            <span className="px-2 py-1 bg-green-500/10 text-green-500 text-xs rounded-full animate-pulse">
                                Running
                            </span>
                        </div>
                        <div className="text-sm text-primary truncate">{cmd.url}</div>
                        <div className="mt-2 text-xs text-text-secondary">
                            Started: {new Date(cmd.started_at).toLocaleTimeString()}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
