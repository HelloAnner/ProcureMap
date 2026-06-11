import React from 'react';

type BadgeType = 'M' | 'A' | 'score' | 'success' | 'warning' | 'error';

interface BadgeProps {
  type: BadgeType;
  children?: React.ReactNode;
  score?: number;
}

const typeConfig: Record<BadgeType, { bg: string; color: string; label?: string }> = {
  M: { bg: '#ff7a591a', color: '#ff7a59', label: '原厂' },
  A: { bg: '#0066FF1a', color: '#0066FF', label: '代理' },
  score: { bg: 'transparent', color: 'var(--success)' },
  success: { bg: 'var(--success-bg)', color: 'var(--success)' },
  warning: { bg: 'var(--warning-bg)', color: 'var(--warning)' },
  error: { bg: 'var(--error-bg)', color: 'var(--error)' },
};

export const Badge: React.FC<BadgeProps> = ({ type, children, score }) => {
  const config = typeConfig[type];

  if (type === 'score' && score !== undefined) {
    const scoreColor = score >= 85 ? '#16A34A' : score >= 70 ? '#D97706' : '#DC2626';
    const scoreBg = score >= 85 ? '#16A34A0D' : score >= 70 ? '#D977060D' : '#DC26260D';

    return (
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '0 6px',
          height: 18,
          borderRadius: 4,
          fontSize: 11,
          fontWeight: 700,
          background: scoreBg,
          color: scoreColor,
          lineHeight: 1,
        }}
      >
        {score}%
      </span>
    );
  }

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '0 6px',
        height: 18,
        borderRadius: 4,
        fontSize: 11,
        fontWeight: 600,
        background: config.bg,
        color: config.color,
        lineHeight: 1,
      }}
    >
      {children || config.label}
    </span>
  );
};
