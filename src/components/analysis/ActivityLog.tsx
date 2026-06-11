import React, { useEffect, useRef } from 'react';
import type { LogEntry } from '@/store/taskStore';

interface ActivityLogProps {
  logs: LogEntry[];
  maxHeight?: number;
}

export const ActivityLog: React.FC<ActivityLogProps> = ({ logs, maxHeight = 300 }) => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [logs]);

  const cardStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    background: 'var(--bg-elevated)',
    borderRadius: 18,
    padding: 20,
    boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
  };

  const titleStyle: React.CSSProperties = {
    fontSize: 14,
    fontWeight: 600,
    color: 'var(--text-primary)',
    lineHeight: 1.3,
    marginBottom: 4,
  };

  const logArea: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
    maxHeight,
    overflowY: 'auto',
  };

  const logLine: React.CSSProperties = {
    fontFamily: 'var(--font-mono)',
    fontSize: 11,
    lineHeight: 1.55,
    color: 'var(--text-secondary)',
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
  };

  const levelColors: Record<string, string> = {
    info: 'var(--text-secondary)',
    success: 'var(--success)',
    warning: 'var(--warning)',
    error: 'var(--error)',
  };

  return (
    <div style={cardStyle}>
      <span style={titleStyle}>执行日志</span>
      <div ref={containerRef} style={logArea}>
        {logs.length === 0 ? (
          <span style={logLine}>等待开始...</span>
        ) : (
          logs.map((log, i) => (
            <span key={i} style={{ ...logLine, color: levelColors[log.level] || logLine.color }}>
              {log.message}
            </span>
          ))
        )}
      </div>
    </div>
  );
};
