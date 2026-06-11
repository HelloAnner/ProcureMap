import React from 'react';

interface StatCardProps {
  icon: React.ReactNode;
  iconBg?: string;
  iconColor?: string;
  label: string;
  value: string | number;
}

export const StatCard: React.FC<StatCardProps> = ({
  icon,
  iconBg = '#0066FF14',
  iconColor = '#0066FF',
  label,
  value,
}) => {
  const cardStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 14,
    background: 'var(--bg-elevated)',
    borderRadius: 16,
    padding: '0 20px',
    height: 80,
    flex: 1,
    boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
  };

  const iconBoxStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 44,
    height: 44,
    borderRadius: 12,
    background: iconBg,
    color: iconColor,
    flexShrink: 0,
  };

  const textColStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
  };

  const valueStyle: React.CSSProperties = {
    fontSize: 24,
    fontWeight: 700,
    color: 'var(--text-primary)',
    lineHeight: 1.1,
  };

  const labelStyle: React.CSSProperties = {
    fontSize: 12,
    fontWeight: 400,
    color: 'var(--text-muted)',
    lineHeight: 1.3,
  };

  return (
    <div style={cardStyle}>
      <div style={iconBoxStyle}>{icon}</div>
      <div style={textColStyle}>
        <span style={valueStyle}>{value}</span>
        <span style={labelStyle}>{label}</span>
      </div>
    </div>
  );
};
