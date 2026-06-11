import React from 'react';
import { useNavigate } from 'react-router-dom';
import type { TaskInfo } from '@/store/taskStore';

interface AnalysisCardProps {
  task: TaskInfo;
}

export const AnalysisCard: React.FC<AnalysisCardProps> = ({ task }) => {
  const navigate = useNavigate();

  const title = `${task.origin} · ${task.radius}km · ${task.material}`;

  const cardStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 18,
    background: 'var(--bg-elevated)',
    borderRadius: 14,
    padding: '0 20px',
    height: 68,
    width: '100%',
    cursor: 'pointer',
    boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
    transition: 'box-shadow 0.15s',
  };

  const iconBox: React.CSSProperties = {
    width: 40,
    height: 40,
    borderRadius: 10,
    background: '#0066FF0D',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    color: 'var(--accent)',
    fontSize: 18,
  };

  const infoStyle: React.CSSProperties = {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
    minWidth: 0,
  };

  const titleRow: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
  };

  const titleStyle: React.CSSProperties = {
    fontSize: 14,
    fontWeight: 600,
    color: 'var(--text-primary)',
    lineHeight: 1.3,
  };

  const countStyle: React.CSSProperties = {
    fontSize: 12,
    fontWeight: 600,
    color: 'var(--accent)',
    lineHeight: 1.3,
  };

  const metaStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
  };

  const metaText: React.CSSProperties = {
    fontSize: 12,
    color: 'var(--text-secondary)',
    lineHeight: 1.3,
  };

  const rightStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-end',
    gap: 4,
    flexShrink: 0,
  };

  const dateStyle: React.CSSProperties = {
    fontSize: 12,
    fontWeight: 500,
    color: 'var(--text-primary)',
    lineHeight: 1.3,
  };

  const timeStyle: React.CSSProperties = {
    fontSize: 11,
    fontWeight: 400,
    color: 'var(--text-muted)',
    lineHeight: 1.3,
  };

  const viewBtn: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    padding: '0 8px',
    height: 24,
    borderRadius: 6,
    background: '#0066FF0D',
    color: 'var(--accent)',
    fontSize: 11,
    fontWeight: 500,
    cursor: 'pointer',
    border: 'none',
    lineHeight: 1.3,
  };

  const dateObj = new Date(task.createdAt);
  const dateStr = dateObj.toLocaleDateString('zh-CN');
  const timeStr = dateObj.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });

  return (
    <div
      style={cardStyle}
      onClick={() => navigate(`/results/${task.id}`)}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLDivElement).style.boxShadow = '0 2px 8px rgba(0,0,0,0.08)';
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLDivElement).style.boxShadow = '0 1px 3px rgba(0,0,0,0.04)';
      }}
    >
      <div style={iconBox}>&#128269;</div>
      <div style={infoStyle}>
        <div style={titleRow}>
          <span style={titleStyle}>{task.query}供应商</span>
          <span style={countStyle}>
            {task.stats.matched}家
          </span>
        </div>
        <div style={metaStyle}>
          <span style={metaText}>{task.origin}市</span>
          <span style={metaText}>{task.radius}km</span>
          <span style={metaText}>{task.material}</span>
        </div>
      </div>
      <div style={rightStyle}>
        <span style={dateStyle}>{dateStr}</span>
        <span style={timeStyle}>{timeStr}</span>
        <button
          style={viewBtn}
          onClick={(e) => {
            e.stopPropagation();
            navigate(`/results/${task.id}`);
          }}
        >
          查看结果
        </button>
      </div>
    </div>
  );
};
