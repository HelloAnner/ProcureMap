import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ActivityLog } from '@/components/analysis/ActivityLog';
import { LiveResultsFeed } from '@/components/analysis/LiveResultsFeed';
import { useTauriEvent } from '@/hooks/useTauriEvent';
import { useTaskStore, type LogEntry, type CompanyResult } from '@/store/taskStore';
import { apiCancelTask, type ProgressEvent } from '@/api';
import { isTauriRuntime } from '@/tauriRuntime';

// --------------- mock data (browser dev fallback) ---------------

const mockLogs: LogEntry[] = [
  { timestamp: '15:32:01', message: '查询解析完成 → 物料:不锈钢板, 产地:无锡, 距离:100km', level: 'info' },
  { timestamp: '15:32:02', message: '工商数据库搜索中... 匹配到 47 条原始记录', level: 'info' },
  { timestamp: '15:32:08', message: 'AI 语义匹配筛选完成，保留 14 条高相关结果', level: 'success' },
  { timestamp: '15:32:15', message: '正在获取企业联系方式... 已完成 8/14', level: 'info' },
  { timestamp: '15:32:22', message: '无锡市不锈钢制品有限公司 - 联系方式获取成功', level: 'success' },
  { timestamp: '15:32:28', message: '江苏大明金属制品有限公司 - 邮箱已验证', level: 'success' },
];

const mockCompanies: CompanyResult[] = [
  { id: 'c1', name: '无锡市不锈钢制品有限公司', creditCode: '91320200551234A', category: 'M', city: '无锡市', province: '江苏', distance: 32, capital: '5000万', staffCount: 280, score: 94, hasEmail: true, hasCoordinate: true, hasContact: true },
  { id: 'c2', name: '江苏大明金属制品有限公司', creditCode: '91320281561234B', category: 'M', city: '无锡市', province: '江苏', distance: 45, capital: '1.2亿', staffCount: 450, score: 91, hasEmail: true, hasCoordinate: true, hasContact: true },
  { id: 'c3', name: '无锡华生金属材料有限公司', creditCode: '91320200551234C', category: 'M', city: '无锡市', province: '江苏', distance: 58, capital: '8000万', staffCount: 180, score: 88, hasEmail: true, hasCoordinate: true, hasContact: true },
  { id: 'c4', name: '无锡浦新不锈钢有限公司', creditCode: '91320281561234D', category: 'M', city: '无锡市', province: '江苏', distance: 67, capital: '3.5亿', staffCount: 620, score: 85, hasEmail: true, hasCoordinate: true, hasContact: true },
];

// ---------------------------------------------------------------------------

const PIPELINE_STEPS = [
  { key: 'parse', label: '解析查询' },
  { key: 'search', label: '工商搜索' },
  { key: 'detail', label: '详情获取' },
  { key: 'enrich', label: '数据补全' },
  { key: 'report', label: '生成报告' },
];

const StatTile: React.FC<{ label: string; value: number | string; color?: string }> = ({
  label,
  value,
  color = 'var(--text-primary)',
}) => (
  <div
    style={{
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      background: 'var(--bg-elevated)',
      borderRadius: 12,
      padding: '16px 12px',
      boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
    }}
  >
    <span style={{ fontSize: 28, fontWeight: 700, color, lineHeight: 1.1 }}>{value}</span>
    <span style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.2 }}>{label}</span>
  </div>
);

export const ProcessingPage: React.FC = () => {
  const { taskId } = useParams<{ taskId: string }>();
  const navigate = useNavigate();
  const { activeTasks, addTask, updateTask } = useTaskStore();

  const [progress, setProgress] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [companies, setCompanies] = useState<CompanyResult[]>([]);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [cancelling, setCancelling] = useState(false);
  const [stepLabel, setStepLabel] = useState('初始化');
  const [currentStep, setCurrentStep] = useState(0);
  const [useMock, setUseMock] = useState(false);
  const [stats, setStats] = useState({
    totalFound: 0,
    matched: 0,
    withContact: 0,
    withCoordinate: 0,
    withEmail: 0,
  });

  const handleProgress = useCallback((event: ProgressEvent) => {
    const now = new Date().toLocaleTimeString('zh-CN', { hour12: false });

    switch (event.type) {
      case 'StepChanged': {
        setStepLabel(event.data.label);
        const stepMap: Record<string, number> = {
          token: 0, search: 1, detail: 2, enrich: 3, scoring: 4, building: 5, done: 5,
        };
        const stepNum = stepMap[event.data.step] ?? 0;
        setCurrentStep(stepNum);
        setProgress(stepNum * 20);
        if (taskId) updateTask(taskId, { step: stepNum });
        break;
      }
      case 'SearchProgress': {
        const pct = Math.min(95, (event.data.query_index / event.data.total_queries) * 40);
        setProgress(pct);
        setCurrentStep(1);
        setStats((s) => ({ ...s, totalFound: event.data.candidates }));
        setLogs((prev) => [...prev, { timestamp: now, message: `搜索进度: ${event.data.query_index}/${event.data.total_queries}, 候选 ${event.data.candidates} 条`, level: 'info' }]);
        break;
      }
      case 'DetailProgress': {
        setProgress(40 + (event.data.processed / event.data.total) * 20);
        setCurrentStep(2);
        setLogs((prev) => [...prev, { timestamp: now, message: `详情获取: ${event.data.processed}/${event.data.total}, 保留 ${event.data.kept} 条`, level: 'success' }]);
        break;
      }
      case 'EnrichProgress': {
        setProgress(60 + (event.data.processed / event.data.total) * 25);
        setCurrentStep(3);
        setLogs((prev) => [...prev, { timestamp: now, message: `数据补全: ${event.data.processed}/${event.data.total}`, level: 'info' }]);
        break;
      }
      case 'LogLine': {
        setLogs((prev) => [...prev, { timestamp: now, message: event.data.line, level: 'info' }]);
        break;
      }
      case 'TaskCompleted': {
        setProgress(100);
        setCurrentStep(5);
        setStepLabel('完成');
        setLogs((prev) => [...prev, { timestamp: now, message: `分析完成: ${event.data.company_count} 家企业, 耗时 ${event.data.duration_seconds.toFixed(1)}s`, level: 'success' }]);
        if (taskId) updateTask(taskId, { status: 'completed', progress: 100, step: 5 });
        setTimeout(() => navigate(`/results/${taskId || event.data.task_id}`), 1200);
        break;
      }
      case 'TaskError': {
        setLogs((prev) => [...prev, { timestamp: now, message: `错误: ${event.data.error}`, level: 'error' }]);
        if (taskId) updateTask(taskId, { status: 'failed' });
        break;
      }
    }
  }, [taskId, updateTask, navigate]);

  useTauriEvent(handleProgress);

  useEffect(() => {
    if (!taskId) return;
    if (!activeTasks.has(taskId)) {
      addTask({
        id: taskId, query: '', origin: '', material: '', radius: 200,
        status: 'running', progress: 0, step: 0, totalSteps: 5,
        createdAt: new Date().toISOString(), companies: [], logs: [],
        stats: { totalFound: 0, matched: 0, withContact: 0, withCoordinate: 0, withEmail: 0 },
      });
    }
    const timer = setInterval(() => setElapsed((prev) => prev + 1), 1000);
    return () => clearInterval(timer);
  }, [taskId]);

  useEffect(() => {
    if (isTauriRuntime()) return undefined;
    let interval: number | undefined;
    let completed = false;
    const timeout = window.setTimeout(() => {
      setUseMock(true);
      setCompanies(mockCompanies);
      setLogs(mockLogs);
      setStats({ totalFound: 47, matched: 14, withContact: 11, withCoordinate: 12, withEmail: 8 });
      interval = window.setInterval(() => {
        setProgress((prev) => {
          if (prev >= 100) return 100;
          const next = prev + Math.random() * 8 + 6;
          if (next >= 100 && !completed) {
            completed = true;
            window.setTimeout(() => navigate(`/results/${taskId}`), 800);
            return 100;
          }
          return Math.min(99, next);
        });
        setCurrentStep((s) => Math.min(4, s + (Math.random() > 0.7 ? 1 : 0)));
      }, 900);
    }, 800);
    return () => {
      window.clearTimeout(timeout);
      if (interval) window.clearInterval(interval);
    };
  }, [taskId, navigate]);

  const handleCancel = useCallback(async () => {
    setCancelling(true);
    if (taskId) {
      try { await apiCancelTask(taskId); updateTask(taskId, { status: 'cancelled' }); } catch { /* */ }
    }
    navigate('/workspace');
  }, [navigate, taskId, updateTask]);

  const visibleProgress = progress >= 100 ? 100 : Math.min(99, Math.round(progress));

  // --------------- layout styles ---------------

  const containerStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
    padding: '24px 40px',
    flex: 1,
    minHeight: 0,
  };

  const headerRow: React.CSSProperties = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    height: 40,
    flexShrink: 0,
  };

  const headerLeft: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
  };

  const pageTitle: React.CSSProperties = {
    fontSize: 20,
    fontWeight: 700,
    color: 'var(--text-primary)',
    lineHeight: 1.3,
  };

  const statusPill: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    padding: '0 10px',
    height: 26,
    borderRadius: 7,
    background: 'var(--accent-bg)',
    color: 'var(--accent)',
    fontSize: 11,
    fontWeight: 600,
  };

  const headerRight: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
  };

  const elapsedChip: React.CSSProperties = {
    fontFamily: 'var(--font-mono)',
    fontSize: 13,
    color: 'var(--text-secondary)',
  };

  const cancelBtn: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    padding: '0 14px',
    height: 30,
    borderRadius: 8,
    border: '1px solid var(--border-subtle)',
    background: 'var(--bg-elevated)',
    color: 'var(--text-secondary)',
    fontSize: 12,
    fontWeight: 500,
    cursor: 'pointer',
    fontFamily: 'var(--font-sans)',
  };

  // Stepper — fixed height
  const stepperWrap: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 0,
    borderRadius: 12,
    background: 'var(--bg-elevated)',
    padding: '0 24px',
    height: 64,
    flexShrink: 0,
    boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
  };

  // Stats tiles row — fixed height
  const statsRow: React.CSSProperties = {
    display: 'flex',
    gap: 12,
    flexShrink: 0,
  };

  // Live results section — fills remaining space, with pre-allocated card
  const resultsArea: React.CSSProperties = {
    flex: 1,
    minHeight: 0,
    display: 'flex',
    flexDirection: 'column',
  };

  // Log section — fixed height at bottom
  const logArea: React.CSSProperties = {
    flexShrink: 0,
  };

  return (
    <div style={containerStyle}>
      {/* ── Header ── */}
      <div style={headerRow}>
        <div style={headerLeft}>
          <h1 style={pageTitle}>分析进度</h1>
          {progress < 100 && (
            <div style={statusPill}>
              <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--accent)', animation: 'pulse 2s infinite' }} />
              分析中
            </div>
          )}
          {progress >= 100 && (
            <div style={{ ...statusPill, background: 'var(--success-bg)', color: 'var(--success)' }}>✓ 完成</div>
          )}
        </div>
        <div style={headerRight}>
          <span style={elapsedChip}>⏱ {elapsed}s</span>
          <button style={cancelBtn} onClick={handleCancel} disabled={cancelling}>
            {cancelling ? '取消中...' : '取消'}
          </button>
        </div>
      </div>

      {/* ── Pipeline Stepper ── */}
      <div style={stepperWrap}>
        {PIPELINE_STEPS.map((step, i) => {
          const isDone = i < currentStep;
          const isActive = i === currentStep;
          const isPending = i > currentStep;

          const circleStyle: React.CSSProperties = {
            width: 32,
            height: 32,
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 13,
            fontWeight: 600,
            background: isDone ? 'var(--success)' : isActive ? 'var(--accent)' : 'var(--bg-tertiary)',
            color: isDone || isActive ? '#FFF' : 'var(--text-muted)',
            transition: 'all 0.3s ease',
            flexShrink: 0,
          };

          const labelStyle: React.CSSProperties = {
            fontSize: 11,
            fontWeight: isActive ? 700 : 500,
            color: isPending ? 'var(--text-muted)' : 'var(--text-primary)',
            lineHeight: 1.3,
            opacity: isPending ? 0.5 : 1,
          };

          const lineStyle: React.CSSProperties = {
            flex: 1,
            height: 2,
            borderRadius: 1,
            background: isDone ? 'var(--success)' : 'var(--bg-tertiary)',
            margin: '0 6px',
            minWidth: 0,
            transition: 'background 0.3s ease',
          };

          return (
            <React.Fragment key={step.key}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                <div style={circleStyle}>{isDone ? '✓' : i + 1}</div>
                <span style={labelStyle}>{step.label}</span>
              </div>
              {i < PIPELINE_STEPS.length - 1 && <div style={lineStyle} />}
            </React.Fragment>
          );
        })}
      </div>

      {/* ── Stats Tiles Row ── */}
      <div style={statsRow}>
        <StatTile label="工商记录" value={stats.totalFound} />
        <StatTile label="AI 匹配" value={stats.matched} />
        <StatTile label="联系方式" value={stats.withContact} />
        <StatTile label="整体进度" value={`${visibleProgress}%`} color={progress >= 100 ? 'var(--success)' : 'var(--accent)'} />
      </div>

      {/* ── Live Results (fills remaining space) ── */}
      <div style={resultsArea}>
        <LiveResultsFeed companies={useMock ? mockCompanies : companies} />
      </div>

      {/* ── Activity Log (fixed bottom) ── */}
      <div style={logArea}>
        <ActivityLog logs={useMock ? mockLogs : logs} maxHeight={130} />
      </div>
    </div>
  );
};
