import React, { useState } from 'react';

interface InputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'> {
  label?: string;
  icon?: React.ReactNode;
}

export const Input: React.FC<InputProps> = ({
  label,
  icon,
  style,
  onFocus,
  onBlur,
  ...rest
}) => {
  const [focused, setFocused] = useState(false);

  const containerStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
    width: '100%',
  };

  const labelStyle: React.CSSProperties = {
    fontSize: 12,
    fontWeight: 500,
    color: 'var(--text-secondary)',
    lineHeight: 1.3,
  };

  const wrapperStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    background: 'var(--bg-tertiary)',
    borderRadius: 14,
    padding: '0 16px',
    height: 42,
    transition: 'box-shadow 0.15s',
    boxShadow: focused ? '0 0 0 2px var(--accent)' : 'none',
  };

  const inputStyle: React.CSSProperties = {
    flex: 1,
    border: 'none',
    outline: 'none',
    background: 'transparent',
    fontSize: 14,
    color: 'var(--text-primary)',
    fontFamily: 'var(--font-sans)',
    lineHeight: 1.3,
    ...style,
  };

  return (
    <div style={containerStyle}>
      {label && <span style={labelStyle}>{label}</span>}
      <div style={wrapperStyle}>
        {icon && (
          <span style={{ display: 'flex', alignItems: 'center', color: 'var(--text-placeholder)' }}>
            {icon}
          </span>
        )}
        <input
          style={inputStyle}
          placeholder=" "
          onFocus={(e) => { setFocused(true); onFocus?.(e); }}
          onBlur={(e) => { setFocused(false); onBlur?.(e); }}
          {...rest}
        />
      </div>
    </div>
  );
};
