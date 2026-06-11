import React from 'react';

type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  children: React.ReactNode;
}

const variantStyles: Record<ButtonVariant, React.CSSProperties> = {
  primary: {
    background: 'var(--primary-button)',
    color: '#FFFFFF',
    border: 'none',
  },
  secondary: {
    background: 'var(--interactive-default)',
    color: 'var(--text-primary)',
    border: 'none',
  },
  outline: {
    background: 'transparent',
    color: 'var(--text-primary)',
    border: '1px solid var(--border-subtle)',
  },
  ghost: {
    background: 'transparent',
    color: 'var(--text-secondary)',
    border: 'none',
  },
};

const sizeStyles: Record<ButtonSize, React.CSSProperties> = {
  sm: {
    padding: '4px 10px',
    fontSize: 11,
    borderRadius: 8,
    height: 28,
  },
  md: {
    padding: '8px 16px',
    fontSize: 13,
    borderRadius: 12,
    height: 38,
  },
  lg: {
    padding: '12px 22px',
    fontSize: 15,
    borderRadius: 12,
    height: 46,
  },
};

export const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  size = 'md',
  style,
  children,
  ...rest
}) => {
  const merged = {
    ...sizeStyles[size],
    ...variantStyles[variant],
    fontWeight: 600,
    lineHeight: 1.3,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    cursor: 'pointer',
    transition: 'opacity 0.15s',
    ...style,
  };

  return (
    <button style={merged} {...rest}>
      {children}
    </button>
  );
};
