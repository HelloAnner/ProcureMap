import React from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';

export const AppShell: React.FC = () => {
  const shellStyle: React.CSSProperties = {
    display: 'flex',
    height: '100vh',
    overflow: 'hidden',
  };

  const contentStyle: React.CSSProperties = {
    flex: 1,
    overflowY: 'auto',
    overflowX: 'hidden',
    background: 'var(--bg-primary)',
    height: '100vh',
  };

  return (
    <div style={shellStyle}>
      <Sidebar />
      <main style={contentStyle}>
        <Outlet />
      </main>
    </div>
  );
};
