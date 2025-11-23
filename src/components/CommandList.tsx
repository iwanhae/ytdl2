import { useEffect, useState, useRef } from 'react';
import { API_BASE, type Command } from '../lib/api';

interface CommandListProps {
    onCommandComplete?: () => void;
}

export default function CommandList({ onCommandComplete }: CommandListProps) {
    const [commands, setCommands] = useState<Command[]>([]);
    const [expandedLogs, setExpandedLogs] = useState<Set<string>>(new Set());
    const prevCommandsRef = useRef<Map<string, string>>(new Map());

    useEffect(() => {
        const eventSource = new EventSource(`${API_BASE}/commands/stream`);

        eventSource.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                const allCommands: Command[] = data.commands || [];

                // Check for completions
                allCommands.forEach(cmd => {
                    const prevStatus = prevCommandsRef.current.get(cmd.id);
                    if (prevStatus === 'running' && (cmd.status === 'completed' || cmd.status === 'failed')) {
                        if (onCommandComplete) {
                            onCommandComplete();
                        }
                    }
                    prevCommandsRef.current.set(cmd.id, cmd.status);
                });

                // Filter only running commands or commands that just finished (optional, but requirement says "running commands list")
                // Actually, user wants to see progress, so keeping running ones is key.
                // We might want to keep completed ones for a bit or just show running.
                // Let's stick to running for the main list, but maybe we should show recent completions too?
                // The requirement says "see list of downloaded video... progress of download".
                // Let's show running commands.
                const running = allCommands.filter((cmd: Command) => cmd.status === 'running');
                setCommands(running);
            } catch (error) {
                console.error('Failed to parse command stream:', error);
            }
        };

        eventSource.onerror = (error) => {
            console.error('Command stream error:', error);
            eventSource.close();
        };

        return () => {
            eventSource.close();
        };
    }, [onCommandComplete]);

    const toggleLogs = (id: string) => {
        const newExpanded = new Set(expandedLogs);
        if (newExpanded.has(id)) {
            newExpanded.delete(id);
        } else {
            newExpanded.add(id);
        }
        setExpandedLogs(newExpanded);
    };

    if (commands.length === 0) return null;

    return (
        <div className="mb-8">
            <h2 className="text-lg font-bold mb-4 text-text">Active Downloads</h2>
            <div className="space-y-3">
                {commands.map((cmd) => (
                    <div key={cmd.id} className="bg-surface border border-border rounded-lg overflow-hidden">
                        <div className="p-4">
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-sm font-mono text-text-secondary">{cmd.id}</span>
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => toggleLogs(cmd.id)}
                                        className="text-xs px-2 py-1 bg-border rounded hover:bg-primary/20 transition-colors text-text-secondary hover:text-primary"
                                    >
                                        {expandedLogs.has(cmd.id) ? 'Hide Logs' : 'Show Logs'}
                                    </button>
                                    <span className="px-2 py-1 bg-green-500/10 text-green-500 text-xs rounded-full animate-pulse">
                                        Running
                                    </span>
                                </div>
                            </div>
                            <div className="text-sm text-primary truncate">{cmd.url}</div>
                            <div className="mt-2 text-xs text-text-secondary">
                                Started: {new Date(cmd.started_at).toLocaleTimeString()}
                            </div>
                        </div>

                        {expandedLogs.has(cmd.id) && (
                            <LogViewer commandId={cmd.id} />
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
}

function LogViewer({ commandId }: { commandId: string }) {
    const [logs, setLogs] = useState<string[]>([]);
    const logsEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const eventSource = new EventSource(`${API_BASE}/commands/${commandId}/logs/stream`);

        eventSource.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                if (data.line) {
                    setLogs(prev => [...prev, data.line]);
                }
            } catch (error) {
                console.error('Failed to parse log stream:', error);
            }
        };

        eventSource.addEventListener('done', () => {
            eventSource.close();
        });

        return () => {
            eventSource.close();
        };
    }, [commandId]);

    useEffect(() => {
        logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [logs]);

    return (
        <div className="bg-black p-4 border-t border-border font-mono text-xs text-green-400 max-h-48 overflow-y-auto">
            {logs.map((line, i) => (
                <div key={i} className="whitespace-pre-wrap break-all">{line}</div>
            ))}
            <div ref={logsEndRef} />
        </div>
    );
}
