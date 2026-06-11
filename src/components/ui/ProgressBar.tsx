import React from 'react';

interface ProgressBarProps {
  percent: number;
  label?: string;
  height?: number;
  color?: string;
  bgColor?: string;
}

export const ProgressBar: React.FC<ProgressBarProps> = ({
  percent,
  label,
  height = 6,
  color = 'var(--accent)',
  bgColor = 'var(--bg-tertiary)',
}) => {
  const clamped = Math.min(100, Math.max(0, percent));

  const containerStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
    width: '100%',
  };

  const labelRowStyle: React.CSSProperties = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    fontSize: 12,
  };

  const trackStyle: React.CSSProperties = {
    width: '100%',
    height,
    borderRadius: height / 2,
    background: bgColor,
    overflow: 'hidden',
  };

  const fillStyle: React.CSSProperties = {
    width: `${clamped}%`,
    height: '100%',
    borderRadius: height / 2,
    background: color,
    transition: 'width 0.4s ease',
  };

  return (
    <div style={containerStyle}>
      {label && (
        <div style={labelRowStyle}>
          <span style={{ color: 'var(--text-secondary)' }}>{label}</span>
          <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{clamped}%</span>
        </div>
      )}
      <div style={trackStyle}>
        <div style={fillStyle} />
      </div>
    </div>
  );
};
