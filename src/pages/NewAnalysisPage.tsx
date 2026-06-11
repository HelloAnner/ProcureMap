import React from 'react';
import { NewAnalysisForm } from '@/components/form/NewAnalysisForm';
import '@/styles/new-analysis.css';

export const NewAnalysisPage: React.FC = () => {
  const containerStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: 28,
    padding: '36px 40px',
    flex: 1,
    minHeight: 0,
  };

  const headerStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    flexShrink: 0,
  };

  const titleRow: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
  };

  const accentDot: React.CSSProperties = {
    width: 10,
    height: 10,
    borderRadius: '50%',
    background: 'var(--accent)',
    flexShrink: 0,
  };

  const titleStyle: React.CSSProperties = {
    fontSize: 26,
    fontWeight: 700,
    color: 'var(--text-primary)',
    lineHeight: 1.25,
    letterSpacing: '-0.01em',
  };

  const subtitleStyle: React.CSSProperties = {
    fontSize: 14,
    color: 'var(--text-secondary)',
    lineHeight: 1.5,
    paddingLeft: 22,
  };

  const stepsRow: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    paddingLeft: 22,
    marginTop: 2,
  };

  const stepStyle = (active: boolean): React.CSSProperties => ({
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    fontSize: 12,
    fontWeight: active ? 600 : 500,
    color: active ? 'var(--text-primary)' : 'var(--text-muted)',
  });

  const stepDot = (active: boolean): React.CSSProperties => ({
    width: 6,
    height: 6,
    borderRadius: '50%',
    background: active ? 'var(--accent)' : 'var(--border-subtle)',
  });

  const stepDash: React.CSSProperties = {
    width: 20,
    height: 1,
    background: 'var(--border-subtle)',
    margin: '0 2px',
  };

  return (
    <div style={containerStyle}>
      <div style={headerStyle}>
        <div style={titleRow}>
          <div style={accentDot} className="na-accent-dot" />
          <h1 style={titleStyle}>新建供应商分析</h1>
        </div>
        <p style={subtitleStyle}>配置搜索参数，系统将自动匹配最合适的供应商。</p>
        <div style={stepsRow}>
          <div style={stepStyle(true)}>
            <div style={stepDot(true)} />
            配置参数
          </div>
          <div style={stepDash} />
          <div style={stepStyle(false)}>
            <div style={stepDot(false)} />
            实时搜索
          </div>
          <div style={stepDash} />
          <div style={stepStyle(false)}>
            <div style={stepDot(false)} />
            查看结果
          </div>
        </div>
      </div>
      <NewAnalysisForm />
    </div>
  );
};
