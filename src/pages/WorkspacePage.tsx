import React, { useEffect } from 'react';
import { useTaskStore } from '@/store/taskStore';
import { StatCard } from '@/components/ui/StatCard';

export const WorkspacePage: React.FC = () => {
  const { recentTasks, loadRecentTasks } = useTaskStore();

  useEffect(() => {
    loadRecentTasks();
  }, [loadRecentTasks]);

  const containerStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: 28,
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

  const subtitleRow: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
  };

  const pageSubtitle: React.CSSProperties = {
    fontSize: 14,
    color: 'var(--text-secondary)',
    lineHeight: 1.3,
  };

  const statsRow: React.CSSProperties = {
    display: 'flex',
    gap: 14,
  };

  const sectionStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
    padding: 24,
    borderRadius: 16,
    background: 'var(--bg-elevated)',
    boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
  };

  const sectionTitle: React.CSSProperties = {
    fontSize: 16,
    fontWeight: 600,
    color: 'var(--text-primary)',
    lineHeight: 1.3,
  };

  const sectionText: React.CSSProperties = {
    fontSize: 13,
    color: 'var(--text-secondary)',
    lineHeight: 1.65,
    maxWidth: 600,
  };

  const highlight: React.CSSProperties = {
    fontWeight: 600,
    color: 'var(--text-primary)',
  };

  const statIcons = ['⚡', '🌎', '📊', '📈'];
  const statIconColors = ['#0066FF', '#16A34A', '#8B5CF6', '#0066FF'];

  const totalAnalyses = recentTasks.length > 0 ? 47 : 0;
  const completedAnalyses = recentTasks.filter((t) => t.status === 'completed').length;

  return (
    <div style={containerStyle}>
      <div style={subtitleRow}>
        <h1 style={pageTitle}>工作台</h1>
        <span style={pageSubtitle}>供应商分析概览</span>
      </div>

      {/* Stats Row */}
      <div style={statsRow}>
        <StatCard
          icon={<span style={{ fontSize: 20, lineHeight: 1 }}>{statIcons[0]}</span>}
          iconColor={statIconColors[0]}
          label="总分析次数"
          value={totalAnalyses}
        />
        <StatCard
          icon={<span style={{ fontSize: 20, lineHeight: 1 }}>{statIcons[1]}</span>}
          iconColor={statIconColors[1]}
          label="覆盖地区"
          value={23}
        />
        <StatCard
          icon={<span style={{ fontSize: 20, lineHeight: 1 }}>{statIcons[2]}</span>}
          iconColor={statIconColors[2]}
          label="本月新增"
          value={5}
        />
        <StatCard
          icon={<span style={{ fontSize: 20, lineHeight: 1 }}>{statIcons[3]}</span>}
          iconColor={statIconColors[3]}
          label="已完成分析"
          value={completedAnalyses || totalAnalyses}
        />
      </div>

      {/* Overview Section */}
      <div style={sectionStyle}>
        <span style={sectionTitle}>采购雷达 供应商智能检索</span>
        <span style={sectionText}>
          通过 <span style={highlight}>工商数据 + AI 语义匹配</span>，快速定位目标区域内的潜在供应商。
          支持自然语言查询输入，自动解析物料、地区、距离等参数，
          结合企业工商信息、联系方式、主营产品等数据，生成完整的供应商雷达报告。
        </span>
        <span style={sectionText}>
          点击左侧边栏的 <span style={highlight}>新建分析</span> 开始一次供应商搜索，
          或在 <span style={highlight}>我的分析</span> 中查看历史记录。
        </span>
      </div>

      {/* Quick stats */}
      {recentTasks.length > 0 && (
        <div style={sectionStyle}>
          <span style={sectionTitle}>最近分析概览</span>
          <div style={{ display: 'flex', gap: 32 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span style={{ fontSize: 28, fontWeight: 700, color: 'var(--accent)' }}>{totalAnalyses}</span>
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>累计分析</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span style={{ fontSize: 28, fontWeight: 700, color: 'var(--success)' }}>{completedAnalyses}</span>
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>已完成</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span style={{ fontSize: 28, fontWeight: 700, color: '#8B5CF6' }}>{23}</span>
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>覆盖城市</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
