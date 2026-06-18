import { useEffect, useState, useRef } from 'react';
import type { MouseEvent } from 'react';
import { API_BASE, type Command } from '../lib/api';
import { useNow } from '../lib/useNow';

interface CommandListProps {
    onCommandComplete?: () => void;
}

function fmtElapsed(secs: number): string {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export default function CommandList({ onCommandComplete }: CommandListProps) {
    const [commands, setCommands] = useState<Command[]>([]);
    const [expandedLogs, setExpandedLogs] = useState<Set<string>>(new Set());
    const prevCommandsRef = useRef<Map<string, string>>(new Map());
    const now = useNow(1000);

    useEffect(() => {
        const eventSource = new EventSource(`${API_BASE}/commands/stream`);

        eventSource.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                const allCommands: Command[] = data.commands || [];

                allCommands.forEach((cmd) => {
                    const prevStatus = prevCommandsRef.current.get(cmd.id);
                    if (
                        prevStatus === 'running' &&
                        (cmd.status === 'completed' || cmd.status === 'failed')
                    ) {
                        onCommandComplete?.();
                    }
                    prevCommandsRef.current.set(cmd.id, cmd.status);
                });

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
        setExpandedLogs((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    if (commands.length === 0) return null;

    return (
        <section className="mb-10">
            <div className="flex items-center justify-between">
                <span className="silkscreen">Active</span>
                <span className="silkscreen text-dust">
                    {commands.length} running
                </span>
            </div>

            <div className="mt-3 space-y-3">
                {commands.map((cmd) => {
                    const elapsed = Math.max(
                        0,
                        Math.floor((now - new Date(cmd.started_at).getTime()) / 1000),
                    );
                    return (
                        <article key={cmd.id} className="deck overflow-hidden">
                            <div className="p-3.5">
                                <div className="flex items-center justify-between gap-2">
                                    <div className="flex min-w-0 items-center gap-2">
                                        <span className="rec-dot shrink-0" />
                                        <span className="truncate font-mono text-[11px] text-ash">
                                            {cmd.id.slice(0, 8)}
                                        </span>
                                    </div>
                                    <span className="chip border-amber/30 bg-amber/10 text-amber">
                                        RUNNING
                                    </span>
                                </div>

                                <div className="mt-2 truncate font-mono text-xs text-ink">
                                    <span className="text-dust">❯ </span>
                                    {cmd.url}
                                </div>

                                <div className="mt-2 flex items-center justify-between font-mono text-[11px] text-dust">
                                    <span>
                                        START{' '}
                                        {new Date(cmd.started_at).toLocaleTimeString([], {
                                            hour12: false,
                                        })}
                                    </span>
                                    <span className="text-ash">T+{fmtElapsed(elapsed)}</span>
                                </div>

                                <button
                                    onClick={() => toggleLogs(cmd.id)}
                                    className="btn-ghost mt-2 inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-wider"
                                >
                                    {expandedLogs.has(cmd.id) ? 'Hide log' : 'Show log'}
                                </button>
                            </div>

                            {expandedLogs.has(cmd.id) && <CrtLog commandId={cmd.id} />}
                        </article>
                    );
                })}
            </div>
        </section>
    );
}

function CrtLog({ commandId }: { commandId: string }) {
    const [logs, setLogs] = useState<string[]>([]);
    const [live, setLive] = useState(true);
    const logsEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const eventSource = new EventSource(
            `${API_BASE}/commands/${commandId}/logs/stream`,
        );

        eventSource.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                if (data.line) {
                    setLogs((prev) => [...prev, data.line]);
                }
            } catch (error) {
                console.error('Failed to parse log stream:', error);
            }
        };

        eventSource.addEventListener('done', () => {
            setLive(false);
            eventSource.close();
        });

        eventSource.onerror = () => {
            setLive(false);
            eventSource.close();
        };

        return () => {
            eventSource.close();
        };
    }, [commandId]);

    useEffect(() => {
        logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [logs]);

    // keep the click from reaching deck-level handlers (none today, but safe)
    const stop = (e: MouseEvent) => e.stopPropagation();

    return (
        <div className="crt border-t border-line" onClick={stop}>
            <div className="relative max-h-56 overflow-y-auto px-4 py-3 text-[11.5px] leading-relaxed">
                {logs.length === 0 && <div className="opacity-60">▒ awaiting output…</div>}
                {logs.map((line, i) => (
                    <div key={i} className="whitespace-pre-wrap break-all">
                        {line}
                    </div>
                ))}
                {live && <span className="caret">▮</span>}
                <div ref={logsEndRef} />
            </div>
        </div>
    );
}
