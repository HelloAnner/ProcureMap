import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTaskStore, type TaskInfo } from '@/store/taskStore';
import { Badge } from '@/components/ui/Badge';

const PAGE_SIZE = 10;

export const MyAnalysesPage: React.FC = () => {
  const navigate = useNavigate();
  const { recentTasks, loadRecentTasks, deleteTask } = useTaskStore();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [confirmTarget, setConfirmTarget] = useState<TaskInfo | null>(null);

  useEffect(() => {
    loadRecentTasks();
  }, [loadRecentTasks]);

  useEffect(() => {
    if (!confirmTarget) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setConfirmTarget(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [confirmTarget]);

  const filtered = useMemo(() => {
    if (!search.trim()) return recentTasks;
    const q = search.toLowerCase();
    return recentTasks.filter(
      (t) =>
        t.query.toLowerCase().includes(q) ||
        t.origin.toLowerCase().includes(q) ||
        t.material.toLowerCase().includes(q) ||
        t.id.toLowerCase().includes(q)
    );
  }, [recentTasks, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages - 1);
  const pageItems = filtered.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);

  const containerStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: 20,
    padding: '36px 40px',
    flex: 1,
    minHeight: 0,
  };

  const titleRow: React.CSSProperties = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  };

  const pageTitle: React.CSSProperties = {
    fontSize: 26,
    fontWeight: 700,
    color: 'var(--text-primary)',
    lineHeight: 1.3,
  };

  const searchInput: React.CSSProperties = {
    width: 260,
    height: 38,
    borderRadius: 12,
    background: 'var(--bg-elevated)',
    border: '1px solid var(--border-subtle)',
    padding: '0 14px',
    fontSize: 13,
    color: 'var(--text-primary)',
    fontFamily: 'var(--font-sans)',
    outline: 'none',
  };

  const tableWrap: React.CSSProperties = {
    background: 'var(--bg-elevated)',
    borderRadius: 16,
    overflow: 'hidden',
    boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
  };

  const tableStyle: React.CSSProperties = {
    width: '100%',
    borderCollapse: 'collapse',
  };

  const thStyle: React.CSSProperties = {
    textAlign: 'left',
    padding: '12px 16px',
    fontSize: 12,
    fontWeight: 600,
    color: 'var(--text-muted)',
    borderBottom: '1px solid var(--border-faint)',
    whiteSpace: 'nowrap',
  };

  const cellStyle: React.CSSProperties = {
    padding: '12px 16px',
    fontSize: 13,
    color: 'var(--text-primary)',
    borderBottom: '1px solid var(--border-faint)',
    verticalAlign: 'middle',
  };

  const actionBtn: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '0 12px',
    height: 30,
    borderRadius: 8,
    background: 'var(--accent-bg)',
    color: 'var(--accent)',
    fontSize: 12,
    fontWeight: 600,
    cursor: 'pointer',
    border: 'none',
    fontFamily: 'var(--font-sans)',
  };

  const deleteBtn: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '0 10px',
    height: 30,
    borderRadius: 8,
    background: 'var(--error-bg)',
    color: 'var(--error)',
    fontSize: 12,
    fontWeight: 600,
    cursor: 'pointer',
    border: 'none',
    fontFamily: 'var(--font-sans)',
    marginLeft: 6,
  };

  const paginationRow: React.CSSProperties = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '12px 16px',
    borderTop: '1px solid var(--border-faint)',
  };

  const pageBtn: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 32,
    height: 32,
    borderRadius: 8,
    border: '1px solid var(--border-subtle)',
    background: 'transparent',
    color: 'var(--text-primary)',
    fontSize: 12,
    fontWeight: 500,
    cursor: 'pointer',
    fontFamily: 'var(--font-sans)',
  };

  const pageBtnActive: React.CSSProperties = {
    ...pageBtn,
    background: 'var(--primary-button)',
    color: '#FFFFFF',
    borderColor: 'var(--primary-button)',
  };

  const statusStyle = (status: TaskInfo['status']): React.CSSProperties => {
    const map: Record<TaskInfo['status'], { bg: string; color: string; text: string }> = {
      completed: { bg: 'var(--success-bg)', color: 'var(--success)', text: '已完成' },
      running: { bg: 'var(--accent-bg)', color: 'var(--accent)', text: '进行中' },
      failed: { bg: 'var(--error-bg)', color: 'var(--error)', text: '失败' },
      cancelled: { bg: 'var(--warning-bg)', color: 'var(--warning)', text: '已取消' },
      pending: { bg: 'var(--bg-tertiary)', color: 'var(--text-muted)', text: '等待中' },
    };
    const s = map[status];
    return {
      display: 'inline-flex',
      alignItems: 'center',
      padding: '0 8px',
      height: 24,
      borderRadius: 6,
      background: s.bg,
      color: s.color,
      fontSize: 11,
      fontWeight: 600,
    };
  };

  const statusText = (status: TaskInfo['status']) => {
    const map: Record<TaskInfo['status'], string> = {
      completed: '已完成',
      running: '进行中',
      failed: '失败',
      cancelled: '已取消',
      pending: '等待中',
    };
    return map[status];
  };

  return (
    <div style={containerStyle}>
      <div style={titleRow}>
        <h1 style={pageTitle}>我的分析</h1>
        <input
          style={searchInput}
          placeholder="搜索分析记录..."
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(0);
          }}
        />
      </div>

      <div style={tableWrap}>
        <table style={tableStyle}>
          <thead>
            <tr>
              <th style={thStyle}>关键词</th>
              <th style={thStyle}>地区</th>
              <th style={thStyle}>物料</th>
              <th style={thStyle}>半径</th>
              <th style={thStyle}>结果</th>
              <th style={thStyle}>状态</th>
              <th style={thStyle}>创建时间</th>
              <th style={thStyle}>操作</th>
            </tr>
          </thead>
          <tbody>
            {pageItems.length === 0 ? (
              <tr>
                <td colSpan={8} style={{ ...cellStyle, textAlign: 'center', color: 'var(--text-muted)', padding: '40px 16px' }}>
                  暂无分析记录
                </td>
              </tr>
            ) : (
              pageItems.map((task) => (
                <tr key={task.id}>
                  <td style={cellStyle}>
                    <span style={{ fontWeight: 600 }}>{task.query}</span>
                  </td>
                  <td style={cellStyle}>{task.origin}</td>
                  <td style={cellStyle}>
                    <Badge type={task.material ? 'M' : 'A'}>{task.material}</Badge>
                  </td>
                  <td style={cellStyle}>{task.radius}km</td>
                  <td style={cellStyle}>{task.stats.matched} 家</td>
                  <td style={cellStyle}>
                    <span style={statusStyle(task.status)}>{statusText(task.status)}</span>
                  </td>
                  <td style={{ ...cellStyle, color: 'var(--text-muted)', fontSize: 12 }}>
                    {new Date(task.createdAt).toLocaleString('zh-CN', {
                      month: '2-digit',
                      day: '2-digit',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </td>
                  <td style={cellStyle}>
                    <button
                      style={actionBtn}
                      onClick={() => navigate(`/results/${task.id}`)}
                    >
                      查看结果
                    </button>
                    <button
                      style={deleteBtn}
                      onClick={() => setConfirmTarget(task)}
                    >
                      删除
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        <div style={paginationRow}>
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            共 {filtered.length} 条记录
          </span>
          <div style={{ display: 'flex', gap: 4 }}>
            <button
              style={{ ...pageBtn, opacity: safePage <= 0 ? 0.4 : 1, cursor: safePage <= 0 ? 'default' : 'pointer' }}
              onClick={() => setPage(Math.max(0, safePage - 1))}
              disabled={safePage <= 0}
            >
              ‹
            </button>
            {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
              let idx: number;
              if (totalPages <= 7) {
                idx = i;
              } else if (safePage < 4) {
                idx = i;
              } else if (safePage >= totalPages - 4) {
                idx = totalPages - 7 + i;
              } else {
                idx = safePage - 3 + i;
              }
              return (
                <button
                  key={idx}
                  style={idx === safePage ? pageBtnActive : pageBtn}
                  onClick={() => setPage(idx)}
                >
                  {idx + 1}
                </button>
              );
            })}
            <button
              style={{ ...pageBtn, opacity: safePage >= totalPages - 1 ? 0.4 : 1, cursor: safePage >= totalPages - 1 ? 'default' : 'pointer' }}
              onClick={() => setPage(Math.min(totalPages - 1, safePage + 1))}
              disabled={safePage >= totalPages - 1}
            >
              ›
            </button>
          </div>
        </div>
      </div>

      {/* Delete confirmation modal */}
      {confirmTarget && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(0,0,0,0.5)',
            backdropFilter: 'blur(4px)',
          }}
          onClick={() => setConfirmTarget(null)}
        >
          <div
            style={{
              background: 'var(--bg-elevated)',
              borderRadius: 16,
              padding: '28px 32px 24px',
              minWidth: 360,
              boxShadow: '0 8px 32px rgba(0,0,0,0.24)',
              display: 'flex',
              flexDirection: 'column',
              gap: 16,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)' }}>
                确认删除
              </span>
              <span style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                确定要删除分析记录「{confirmTarget.query}」吗？此操作不可撤销。
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  padding: '0 16px',
                  height: 34,
                  borderRadius: 8,
                  background: 'var(--bg-tertiary)',
                  color: 'var(--text-primary)',
                  fontSize: 13,
                  fontWeight: 500,
                  cursor: 'pointer',
                  border: 'none',
                  fontFamily: 'var(--font-sans)',
                }}
                onClick={() => setConfirmTarget(null)}
              >
                取消
              </button>
              <button
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  padding: '0 16px',
                  height: 34,
                  borderRadius: 8,
                  background: 'var(--error)',
                  color: '#FFFFFF',
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: 'pointer',
                  border: 'none',
                  fontFamily: 'var(--font-sans)',
                }}
                onClick={() => {
                  deleteTask(confirmTarget.id);
                  setConfirmTarget(null);
                }}
              >
                确认删除
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
