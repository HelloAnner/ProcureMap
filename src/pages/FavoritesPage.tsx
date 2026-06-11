import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTaskStore } from '@/store/taskStore';
import { AnalysisCard } from '@/components/analysis/AnalysisCard';
import { Button } from '@/components/ui/Button';

export const FavoritesPage: React.FC = () => {
  const navigate = useNavigate();
  const { recentTasks, favorites, loadRecentTasks, loadFavorites } = useTaskStore();

  useEffect(() => {
    loadRecentTasks();
    loadFavorites();
  }, [loadRecentTasks, loadFavorites]);

  const favTasks = recentTasks.filter((task) => favorites.includes(task.id));

  const containerStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: 24,
    padding: '40px 52px',
    flex: 1,
    minHeight: 0,
  };

  const pageTitle: React.CSSProperties = {
    fontSize: 26,
    fontWeight: 700,
    color: 'var(--text-primary)',
    lineHeight: 1.3,
  };

  const pageSubtitle: React.CSSProperties = {
    fontSize: 14,
    color: 'var(--text-secondary)',
    lineHeight: 1.3,
  };

  const titleCol: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
  };

  const listStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: 14,
  };

  const emptyStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    padding: '80px 20px',
    borderRadius: 16,
    background: 'var(--bg-elevated)',
  };

  return (
    <div style={containerStyle}>
      <div style={titleCol}>
        <h1 style={pageTitle}>收藏夹</h1>
        <span style={pageSubtitle}>已收藏的分析记录</span>
      </div>

      <div style={listStyle}>
        {favTasks.length === 0 ? (
          <div style={emptyStyle}>
            <span style={{ fontSize: 40 }}>&#9734;</span>
            <span style={{ fontSize: 14, color: 'var(--text-muted)' }}>
              暂无收藏的分析记录
            </span>
            <Button variant="outline" size="md" onClick={() => navigate('/workspace')}>
              浏览分析记录
            </Button>
          </div>
        ) : (
          favTasks.map((task) => (
            <AnalysisCard key={task.id} task={task} />
          ))
        )}
      </div>
    </div>
  );
};
