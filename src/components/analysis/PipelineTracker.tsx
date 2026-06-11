import React from 'react';

interface PipelineStep {
  icon: string;
  label: string;
  time?: string;
  state: 'done' | 'active' | 'pending';
}

interface PipelineTrackerProps {
  steps: PipelineStep[];
}

const stateConfig = {
  done: { bg: 'var(--success-bg)', color: 'var(--success)', iconColor: 'var(--success)' },
  active: { bg: 'var(--accent-bg)', color: 'var(--accent)', iconColor: 'var(--accent)' },
  pending: {
    bg: 'var(--bg-elevated)',
    color: 'var(--text-muted)',
    iconColor: 'var(--text-placeholder)',
  },
};

const stepLabels: Record<string, string> = {
  parse: '解析查询',
  search: '工商搜索',
  match: 'AI 匹配',
  contact: '获取联系',
  report: '生成报告',
};

const stepIcons: Record<string, string> = {
  parse: '✓',
  search: '✓',
  match: '⟳',
  contact: '○',
  report: '○',
};

const activeIcons: Record<string, string> = {
  parse: '✓',
  search: '✓',
  match: '⟳',
  contact: '○',
  report: '○',
};

export const PipelineTracker: React.FC<PipelineTrackerProps> = ({ steps }) => {
  const rowStyle: React.CSSProperties = {
    display: 'flex',
    gap: 12,
    width: '100%',
  };

  return (
    <div style={rowStyle}>
      {steps.map((step, i) => {
        const config = stateConfig[step.state];
        const label = stepLabels[step.label] || step.label;
        const icon = step.state === 'active' ? (activeIcons[step.label] || '⟳') :
                     step.state === 'done' ? '✓' : '○';

        const stepStyle: React.CSSProperties = {
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 6,
          background: config.bg,
          borderRadius: 14,
          height: 72,
          transition: 'all 0.3s ease',
          animation: step.state === 'active' ? 'pulse 2s infinite' : undefined,
        };

        const iconStyle: React.CSSProperties = {
          fontSize: 22,
          color: config.iconColor,
          lineHeight: 1,
        };

        const labelStyle: React.CSSProperties = {
          fontSize: 11,
          fontWeight: step.state === 'active' ? 700 : 600,
          color: config.color,
          lineHeight: 1.3,
        };

        const timeStyle: React.CSSProperties = {
          fontSize: 10,
          fontFamily: 'var(--font-mono)',
          color: config.color,
          lineHeight: 1.3,
        };

        return (
          <div key={step.label + i} style={stepStyle}>
            <span style={iconStyle}>{icon}</span>
            <span style={labelStyle}>{label}</span>
            {step.time && <span style={timeStyle}>{step.time}</span>}
          </div>
        );
      })}
    </div>
  );
};

// Add keyframe animation for pulse
export const pipelineStyles = `
@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.7; }
}
`;

// Inject styles
if (typeof document !== 'undefined') {
  const styleEl = document.createElement('style');
  styleEl.textContent = pipelineStyles;
  document.head.appendChild(styleEl);
}
