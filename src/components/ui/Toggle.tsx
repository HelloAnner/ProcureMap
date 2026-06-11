import React from 'react';

interface ToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
}

export const Toggle: React.FC<ToggleProps> = ({ checked, onChange, label }) => {
  const rowStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 36,
    cursor: 'pointer',
  };

  const labelStyle: React.CSSProperties = {
    fontSize: 12,
    color: 'var(--text-secondary)',
    lineHeight: 1.3,
  };

  const trackStyle: React.CSSProperties = {
    width: 36,
    height: 20,
    borderRadius: 10,
    background: checked ? 'var(--accent)' : 'var(--border-subtle)',
    position: 'relative',
    transition: 'background 0.2s',
    flexShrink: 0,
  };

  const knobStyle: React.CSSProperties = {
    width: 16,
    height: 16,
    borderRadius: '50%',
    background: '#FFFFFF',
    position: 'absolute',
    top: 2,
    left: checked ? 18 : 2,
    transition: 'left 0.2s',
    boxShadow: '0 1px 2px rgba(0,0,0,0.15)',
  };

  return (
    <div style={rowStyle} onClick={() => onChange(!checked)}>
      <span style={labelStyle}>{label}</span>
      <div style={trackStyle}>
        <div style={knobStyle} />
      </div>
    </div>
  );
};
