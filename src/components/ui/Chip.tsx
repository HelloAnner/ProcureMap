import React from 'react';

interface ChipProps {
  label: string;
  active?: boolean;
  color?: string;
  bgColor?: string;
  onClick?: () => void;
  onRemove?: () => void;
  size?: 'sm' | 'md';
  pill?: boolean;
}

export const Chip: React.FC<ChipProps> = ({
  label,
  active = false,
  color,
  bgColor,
  onClick,
  onRemove,
  size = 'md',
  pill = false,
}) => {
  const isSm = size === 'sm';

  const chipStyle: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
    padding: isSm ? '0 8px' : '0 10px',
    height: isSm ? 24 : 28,
    borderRadius: pill ? 999 : 8,
    fontSize: isSm ? 11 : 12,
    fontWeight: active ? 600 : 500,
    lineHeight: 1.3,
    cursor: onClick ? 'pointer' : 'default',
    transition: 'background 0.15s',
    background: active
      ? (bgColor || 'var(--primary-button)')
      : (bgColor || 'var(--interactive-default)'),
    color: active
      ? (color || '#FFFFFF')
      : (color || 'var(--text-secondary)'),
    border: 'none',
  };

  return (
    <span style={chipStyle} onClick={onClick}>
      {label}
      {onRemove && (
        <span
          onClick={(e) => { e.stopPropagation(); onRemove(); }}
          style={{ cursor: 'pointer', fontSize: 14, lineHeight: 1, opacity: 0.6 }}
        >
          x
        </span>
      )}
    </span>
  );
};
