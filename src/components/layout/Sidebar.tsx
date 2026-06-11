import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

interface NavItem {
  path: string;
  label: string;
  icon: string;
}

const navItems: NavItem[] = [
  { path: '/workspace', label: '工作台', icon: '◫' },
  { path: '/my-analyses', label: '我的分析', icon: '☰' },
];

export const Sidebar: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const sidebarStyle: React.CSSProperties = {
    width: 'var(--sidebar-width)',
    background: 'var(--bg-elevated)',
    display: 'flex',
    flexDirection: 'column',
    padding: '18px 14px',
    gap: 6,
    height: '100vh',
    flexShrink: 0,
    boxShadow: '1px 0 0 var(--border-faint)',
  };

  const brandStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '0 4px',
    height: 40,
  };

  const logoBox: React.CSSProperties = {
    width: 32,
    height: 32,
    borderRadius: 9,
    background: 'var(--primary-button)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  };

  const brandName: React.CSSProperties = {
    fontSize: 16,
    fontWeight: 700,
    color: 'var(--text-primary)',
    lineHeight: 1.3,
  };

  const newAnalysisBtn: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 42,
    marginTop: 18,
    marginBottom: 4,
    borderRadius: 12,
    background: 'var(--primary-button)',
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: 600,
    cursor: 'pointer',
    border: 'none',
    fontFamily: 'var(--font-sans)',
  };

  const navItemBase: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    height: 38,
    padding: '0 10px',
    borderRadius: 10,
    cursor: 'pointer',
    transition: 'background 0.15s',
    width: '100%',
  };

  const navIconBase: React.CSSProperties = {
    fontSize: 17,
    width: 17,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  };

  const navLabel: React.CSSProperties = {
    fontSize: 13,
    fontWeight: 500,
    lineHeight: 1.3,
  };

  const spacer: React.CSSProperties = {
    flex: 1,
  };

  const userSection: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '0 12px',
    height: 46,
    borderRadius: 12,
    background: 'var(--bg-tertiary)',
    width: '100%',
  };

  const avatar: React.CSSProperties = {
    width: 30,
    height: 30,
    borderRadius: 8,
    background: 'var(--accent)',
    color: '#FFFFFF',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 13,
    fontWeight: 700,
    flexShrink: 0,
  };

  const userInfo: React.CSSProperties = {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
  };

  const userName: React.CSSProperties = {
    fontSize: 13,
    fontWeight: 600,
    color: 'var(--text-primary)',
    lineHeight: 1.3,
  };

  const userRole: React.CSSProperties = {
    fontSize: 11,
    fontWeight: 400,
    color: 'var(--text-muted)',
    lineHeight: 1.3,
  };

  return (
    <nav style={sidebarStyle}>
      {/* Brand */}
      <div style={brandStyle}>
        <div style={logoBox}>
          <span style={{ color: '#FFFFFF', fontSize: 10, fontWeight: 700 }}>PM</span>
        </div>
        <span style={brandName}>采购雷达</span>
      </div>

      {/* New Analysis button */}
      <button
        style={newAnalysisBtn}
        onClick={() => navigate('/new-analysis')}
      >
        <span style={{ fontSize: 16 }}>+</span>
        新建分析
      </button>

      {/* Nav items */}
      {navItems.map((item) => {
        const isActive = location.pathname.startsWith(item.path);
        return (
          <div
            key={item.path}
            style={{
              ...navItemBase,
              background: isActive ? 'var(--selected-bg)' : 'transparent',
            }}
            onClick={() => navigate(item.path)}
          >
            <span
              style={{
                ...navIconBase,
                color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
              }}
            >
              {item.icon}
            </span>
            <span
              style={{
                ...navLabel,
                fontWeight: isActive ? 600 : 500,
                color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
              }}
            >
              {item.label}
            </span>
          </div>
        );
      })}

      {/* Spacer */}
      <div style={spacer} />

      {/* User section */}
      <div style={userSection}>
        <div style={avatar}>A</div>
        <div style={userInfo}>
          <span style={userName}>Anner</span>
          <span style={userRole}>采购经理</span>
        </div>
        <span style={{ fontSize: 16, color: 'var(--text-secondary)', cursor: 'pointer' }}>&#9881;</span>
      </div>
    </nav>
  );
};
