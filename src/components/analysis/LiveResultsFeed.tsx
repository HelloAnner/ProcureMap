import React from 'react';
import type { CompanyResult } from '@/store/taskStore';
import { Badge } from '@/components/ui/Badge';

interface LiveResultsFeedProps {
  companies: CompanyResult[];
}

export const LiveResultsFeed: React.FC<LiveResultsFeedProps> = ({ companies }) => {
  const cardStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
    background: 'var(--bg-elevated)',
    borderRadius: 18,
    padding: 22,
    boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
  };

  const headerStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 26,
  };

  const titleStyle: React.CSSProperties = {
    fontSize: 15,
    fontWeight: 600,
    color: 'var(--text-primary)',
    lineHeight: 1.3,
  };

  const liveBadge: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 5,
    padding: '0 10px',
    height: 24,
    borderRadius: 8,
    background: 'var(--success-bg)',
  };

  const liveDot: React.CSSProperties = {
    width: 6,
    height: 6,
    borderRadius: '50%',
    background: 'var(--success)',
    animation: 'pulse 2s infinite',
  };

  const liveText: React.CSSProperties = {
    fontSize: 11,
    fontWeight: 600,
    color: 'var(--success)',
    lineHeight: 1.3,
  };

  const listStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  };

  if (companies.length === 0) {
    return (
      <div style={cardStyle}>
        <div style={headerStyle}>
          <span style={titleStyle}>实时匹配结果</span>
          <div style={liveBadge}>
            <span style={liveDot} />
            <span style={liveText}>等待中</span>
          </div>
        </div>
        <div style={{ padding: '20px 0', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
          分析开始后，匹配结果将在此实时展示
        </div>
      </div>
    );
  }

  return (
    <div style={cardStyle}>
      <div style={headerStyle}>
        <span style={titleStyle}>实时匹配结果</span>
        <div style={liveBadge}>
          <span style={liveDot} />
          <span style={liveText}>实时更新</span>
        </div>
      </div>
      <div style={listStyle}>
        {companies.map((company, i) => (
          <div
            key={company.id}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              padding: '0 14px',
              height: 44,
              borderRadius: 10,
              background: 'var(--bg-tertiary)',
              animation: `fadeIn 0.3s ease ${i * 0.05}s both`,
            }}
          >
            <span
              style={{
                fontSize: 13,
                fontWeight: 500,
                color: 'var(--text-primary)',
                flex: 1,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {company.name}
            </span>
            <Badge type={company.category} />
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--success)' }}>
              {company.score}%
            </span>
            <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
              {company.distance}km
            </span>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              {company.capital}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

// Inject animations
if (typeof document !== 'undefined') {
  const existing = document.getElementById('live-feed-styles');
  if (!existing) {
    const styleEl = document.createElement('style');
    styleEl.id = 'live-feed-styles';
    styleEl.textContent = `
      @keyframes fadeIn {
        from { opacity: 0; transform: translateY(8px); }
        to { opacity: 1; transform: translateY(0); }
      }
      @keyframes pulse {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.4; }
      }
    `;
    document.head.appendChild(styleEl);
  }
}
