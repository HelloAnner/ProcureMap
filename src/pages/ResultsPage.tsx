import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAnalysisStore, type CompanyDetailVM } from '@/store/analysisStore';
import { useFilterStore } from '@/store/filterStore';
import { apiExportHtmlFile } from '@/api';
import { Badge } from '@/components/ui/Badge';
import { Chip } from '@/components/ui/Chip';
import { Toggle } from '@/components/ui/Toggle';
import { isTauriRuntime } from '@/tauriRuntime';
import { SupplierMap } from '@/components/map/SupplierMap';

const PROVINCES = ['安徽', '江苏', '浙江', '上海', '湖北', '广东', '山东', '河北', '四川', '福建'];

export const ResultsPage: React.FC = () => {
  const { taskId, creditCode } = useParams<{ taskId: string; creditCode?: string }>();
  const navigate = useNavigate();
  const {
    companies,
    chartsData,
    activeCompany,
    loadAnalysis,
    loadCompanyDetail,
    setActiveCompany,
  } = useAnalysisStore();
  const filters = useFilterStore();

  const [exporting, setExporting] = useState(false);
  const [exportMessage, setExportMessage] = useState('');
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    if (taskId) loadAnalysis(taskId);
  }, [taskId, loadAnalysis]);

  useEffect(() => {
    if (!creditCode) {
      setActiveCompany(null);
      return;
    }

    const existing = companies.find((company) => company.creditCode === creditCode);
    if (existing) {
      setActiveCompany(existing);
    } else if (taskId) {
      void loadCompanyDetail(taskId, creditCode);
    }
  }, [companies, creditCode, loadCompanyDetail, setActiveCompany, taskId]);

  const filteredCompanies = companies.filter((c) => {
    if (!filters.category.M && c.category === 'M') return false;
    if (!filters.category.A && c.category === 'A') return false;
    if (filters.searchQuery && !c.name.includes(filters.searchQuery) && !c.city.includes(filters.searchQuery)) return false;
    if (filters.province && c.province !== filters.province) return false;
    if (c.distance < filters.distMin || c.distance > filters.distMax) return false;
    if (c.score < filters.scoreMin || c.score > filters.scoreMax) return false;
    if (filters.onlyCoordinate && !c.hasCoordinate) return false;
    if (filters.onlyEmail && !c.hasEmail) return false;
    if (filters.onlyActive && !c.isActive) return false;
    if (filters.onlyContact && !c.hasContact) return false;
    if (filters.onlyAboveScale && !c.isAboveScale) return false;
    return true;
  });

  const sortedCompanies = [...filteredCompanies].sort((a, b) => {
    switch (filters.sortBy) {
      case 'score': return b.score - a.score;
      case 'capital': return b.staffCount - a.staffCount;
      default: return a.distance - b.distance;
    }
  });

  const mCount = companies.filter((c) => c.category === 'M').length;
  const aCount = companies.filter((c) => c.category === 'A').length;
  const withCoord = companies.filter((c) => c.hasCoordinate).length;
  const withEmail = companies.filter((c) => c.hasEmail).length;
  const activeDetail = activeCompany;

  const handleCompanyClick = (company: CompanyDetailVM) => {
    if (!taskId) return;
    if (activeDetail?.id === company.id) {
      setActiveCompany(null);
      navigate(`/results/${taskId}`);
      return;
    }

    setActiveCompany(company);
    navigate(`/results/${taskId}/company/${company.creditCode}`);
  };

  const htmlEscape = (value: unknown) => {
    const text = String(value ?? '');
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  };

  const buildHtml = (rows: CompanyDetailVM[]) => {
    const generatedAt = new Date().toLocaleString('zh-CN', { hour12: false });
    const companiesJson = rows.map((c) => ({
      n: c.name,
      cc: c.creditCode,
      ca: c.category,
      pv: c.province,
      ct: c.city,
      dist: c.distance,
      rc: c.capital,
      ssn: c.staffCount,
      score: c.score,
      em: c.hasEmail ? (c.contacts[0]?.email || '') : '',
      tel: c.hasContact ? (c.contacts[0]?.phone || '') : '',
      op: c.contacts[0]?.name || '',
      la: c.coordinates?.lat ?? null,
      lo: c.coordinates?.lng ?? null,
      mp: c.products,
      desc: c.description,
      contacts: c.contacts,
    }));

    const originName = '检索锚点';
    const radius = '200';

    return `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>采购雷达 · 供应商雷达</title>
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css">
<style>
:root {
  --bg: #0b1020;
  --panel: rgba(15, 22, 41, 0.92);
  --panel-solid: #0f1629;
  --line: rgba(255,255,255,0.08);
  --text: #e8ecf4;
  --muted: #97a2bd;
  --accent: #4dd6ff;
  --mill: #ff7a59;
  --agent: #4dd6ff;
  --origin: #ffd45c;
  --good: #5ce58f;
}
* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; height: 100%; font-family: -apple-system, "PingFang SC", "Microsoft Yahei", sans-serif; background: var(--bg); color: var(--text); overflow: hidden; }
#app { display: grid; grid-template-columns: 1fr 340px; grid-template-rows: 56px 1fr; height: 100vh; }
header {
  grid-column: 1 / -1; display: flex; align-items: center; padding: 0 18px;
  background: linear-gradient(90deg, #0a1631 0%, #14254d 50%, #0a1631 100%);
  border-bottom: 1px solid var(--line); gap: 16px;
}
header .brand { font-weight: 700; font-size: 15px; letter-spacing: 0.5px; }
header .brand .accent { color: var(--accent); }
header .stats { display: flex; gap: 14px; margin-left: 20px; font-size: 12px; color: var(--muted); }
header .stats b { color: var(--text); font-weight: 600; }
header .stats .pill { background: rgba(255,255,255,0.06); padding: 4px 10px; border-radius: 999px; border: 1px solid var(--line); }
header .right { margin-left: auto; display: flex; gap: 8px; }
header .right a { color: var(--muted); text-decoration: none; font-size: 12px; padding: 6px 10px; border: 1px solid var(--line); border-radius: 6px; cursor: pointer; }
header .right a:hover { color: var(--text); background: rgba(255,255,255,0.04); }
#map { width: 100%; height: 100%; background: #0a0f1f; }
.leaflet-tile-pane { filter: brightness(0.85) contrast(1.05); }
.leaflet-control-attribution { background: rgba(0,0,0,0.4) !important; color: #888 !important; font-size: 10px; }
.leaflet-control-attribution a { color: #aaa !important; }
.legend { position: absolute; right: 12px; top: 12px; background: var(--panel); padding: 10px 14px; border-radius: 8px; border: 1px solid var(--line); font-size: 12px; color: var(--text); z-index: 500; backdrop-filter: blur(10px); }
.legend .dot { display: inline-block; width: 10px; height: 10px; border-radius: 50%; vertical-align: middle; margin-right: 6px; }
.demand-box { position: absolute; left: 12px; top: 12px; background: var(--panel); padding: 12px 14px; border-radius: 8px; border: 1px solid var(--line); font-size: 12px; color: var(--text); z-index: 500; backdrop-filter: blur(10px); max-width: 340px; }
.demand-box .h { font-size: 11px; color: var(--muted); text-transform: uppercase; letter-spacing: 0.6px; margin-bottom: 4px; }
.demand-box .small { font-size: 11px; color: var(--muted); margin-top: 6px; }
.map-shell { position: relative; }
.marker-mill, .marker-agent {
  display: flex; align-items: center; justify-content: center; border-radius: 50%;
  color: white; font-size: 10px; font-weight: 700; box-shadow: 0 0 0 2px rgba(0,0,0,0.4), 0 0 8px rgba(0,0,0,0.5);
  border: 2px solid white;
}
.marker-mill { background: var(--mill); }
.marker-agent { background: var(--agent); }
.leaflet-tooltip {
  background: var(--panel) !important; color: var(--text) !important;
  border: 1px solid var(--line) !important; box-shadow: 0 4px 16px rgba(0,0,0,0.4) !important;
  padding: 8px 10px !important; border-radius: 6px !important; font-size: 12px !important;
  backdrop-filter: blur(10px);
}
.leaflet-tooltip-top:before { border-top-color: rgba(15, 22, 41, 0.92) !important; }
.tt-name { font-weight: 600; margin-bottom: 4px; max-width: 280px; }
.tt-meta { color: var(--muted); font-size: 11px; }
.tt-meta span { margin-right: 8px; }
.tt-badge { display: inline-block; padding: 1px 5px; border-radius: 3px; font-size: 10px; font-weight: 700; }
.tt-badge.M { background: rgba(255,122,89,0.18); color: var(--mill); }
.tt-badge.A { background: rgba(77,214,255,0.18); color: var(--agent); }
.supplier-panel { display: flex; flex-direction: column; background: var(--panel-solid); border-left: 1px solid var(--line); min-height: 0; }
.list-meta { padding: 10px 14px; font-size: 12px; color: var(--muted); display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--line); }
.list-meta b { color: var(--text); }
.list-area { flex: 1; overflow-y: auto; padding: 6px; min-height: 0; }
.list-area::-webkit-scrollbar { width: 6px; }
.list-area::-webkit-scrollbar-thumb { background: #2a334b; border-radius: 4px; }
.list-item {
  padding: 10px 12px; border-radius: 8px; margin-bottom: 5px; cursor: pointer;
  border: 1px solid transparent; transition: all 0.15s;
}
.list-item:hover { background: rgba(255,255,255,0.04); border-color: var(--line); }
.list-item.active { background: rgba(77,214,255,0.08); border-color: var(--accent); }
.list-item .title-row { display: flex; align-items: center; gap: 6px; font-size: 13px; color: var(--text); margin-bottom: 4px; }
.list-item .badge { display: inline-block; padding: 1px 6px; border-radius: 4px; font-size: 10px; font-weight: 600; flex-shrink: 0; }
.list-item .badge.M { background: rgba(255,122,89,0.15); color: var(--mill); }
.list-item .badge.A { background: rgba(77,214,255,0.15); color: var(--agent); }
.list-item .name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; flex: 1; }
.list-item .meta { font-size: 11px; color: var(--muted); display: flex; gap: 10px; flex-wrap: wrap; }
.list-item .meta span { white-space: nowrap; }
.list-item .score { margin-left: auto; font-weight: 700; font-size: 11px; padding: 0 4px; border-radius: 4px; }
</style>
</head>
<body>
<div id="app">
  <header>
    <div class="brand">采购雷达 · <span class="accent">供应商雷达</span></div>
    <div class="stats">
      <span class="pill">原厂 <b id="stat-mill">${mCount}</b></span>
      <span class="pill">疑似代理 <b id="stat-agent">${aCount}</b></span>
      <span class="pill">已显示 <b id="stat-shown">${rows.length}</b></span>
      <span class="pill">带定位 <b id="stat-coord">${withCoord}</b></span>
      <span class="pill">带邮箱 <b id="stat-mail">${withEmail}</b></span>
    </div>
    <div class="right">
      <a id="search-input-trigger" onclick="document.getElementById('list-search').focus()">搜索</a>
    </div>
  </header>
  <div class="map-shell">
    <div id="map"></div>
    <div class="legend">
      <div><span class="dot" style="background: var(--mill)"></span> 原厂/加工厂</div>
      <div><span class="dot" style="background: var(--agent)"></span> 疑似一级代理</div>
      <div style="margin-top:4px; font-size:11px; color: var(--muted)">${htmlEscape(radius)}km 半径圈</div>
    </div>
    <div class="demand-box">
      <div class="h">数据口径</div>
      <div>检索锚点 · <b>${htmlEscape(radius)}km</b> 半径 · <b id="meta-total">${rows.length}</b> 家</div>
      <div class="small">数据源：工商企业数据平台 · 导出时间：${htmlEscape(generatedAt)}</div>
    </div>
  </div>
  <section class="supplier-panel">
    <div class="list-meta">
      <span>筛选结果 <b id="list-count">${rows.length}</b> 家</span>
      <input id="list-search" placeholder="搜索企业..." style="background:rgba(255,255,255,0.04);border:1px solid var(--line);color:var(--text);padding:4px 8px;border-radius:6px;font-size:12px;width:140px;outline:none" oninput="renderList()">
    </div>
    <div class="list-area" id="list"></div>
  </section>
</div>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<script>
var COMPANIES = ${JSON.stringify(companiesJson)};

(function() {
  var map = L.map('map', { zoomControl: true, preferCanvas: true }).setView([31, 117], 7);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 18 }).addTo(map);

  function escapeHtml(s) {
    return String(s||'').replace(/[<>&"]/g, function(c) { return {'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;'}[c]; });
  }

  function fmtCap(v) {
    if (!v && v !== 0) return '--';
    var n = Number(v);
    if (isNaN(n)) return String(v);
    if (n >= 10000) return (n/10000).toFixed(1).replace(/\\.0$/, '') + ' 亿';
    return n + ' 万';
  }

  var markers = [];

  function renderMap() {
    markers.forEach(function(m) { map.removeLayer(m); });
    markers = [];
    var bounds = [];
    COMPANIES.forEach(function(c, i) {
      if (c.la == null || c.lo == null) return;
      var cat = c.ca || 'M';
      var size = 14;
      var icon = L.divIcon({
        html: '<div class="marker-' + (cat === 'M' ? 'mill' : 'agent') + '" style="width:' + size + 'px;height:' + size + 'px;font-size:9px">' + cat + '</div>',
        className: '', iconSize: [size, size], iconAnchor: [size/2, size/2]
      });
      var m = L.marker([c.la, c.lo], { icon: icon });
      var tt = '<div class="tt-name">' + escapeHtml(c.n) + '</div>'
        + '<div class="tt-meta"><span class="tt-badge ' + cat + '">' + (cat === 'M' ? '原厂' : '代理') + '</span>'
        + '<span>' + (c.pv||'') + ' ' + (c.ct||'') + '</span>'
        + '<span>' + (c.dist != null ? c.dist : '?') + 'km</span></div>'
        + '<div class="tt-meta" style="margin-top:4px"><span>注册资本 ' + fmtCap(c.rc) + '</span><span>员工 ' + (c.ssn||0) + '</span><span>评分 ' + (c.score||'--') + '</span></div>'
        + (c.em ? '<div class="tt-meta" style="margin-top:4px;color:var(--good)">邮箱 ' + escapeHtml(c.em) + '</div>' : '');
      m.bindTooltip(tt, { direction: 'top', offset: [0, -8], opacity: 1 });
      markers.push(m);
      bounds.push([c.la, c.lo]);
    });
    markers.forEach(function(m) { m.addTo(map); });
    if (bounds.length > 0) {
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 13 });
    }
  }

  function renderList() {
    var search = (document.getElementById('list-search').value || '').toLowerCase();
    var filtered = COMPANIES.filter(function(c) {
      if (!search) return true;
      return (c.n||'').toLowerCase().indexOf(search) >= 0 || (c.ct||'').indexOf(search) >= 0 || (c.pv||'').indexOf(search) >= 0;
    });
    var list = document.getElementById('list');
    list.innerHTML = '';
    var top = filtered.slice(0, 300);
    top.forEach(function(c) {
      var el = document.createElement('div');
      el.className = 'list-item';
      var cat = c.ca || 'M';
      el.innerHTML = '<div class="title-row">'
        + '<span class="badge ' + cat + '">' + (cat === 'M' ? '原厂' : '代理') + '</span>'
        + '<span class="name" title="' + escapeHtml(c.n) + '">' + escapeHtml(c.n) + '</span>'
        + '<span class="score" style="color:' + (c.score >= 85 ? 'var(--good)' : c.score >= 70 ? '#ffb84d' : '#ff6b6b') + '">' + (c.score||'--') + '</span>'
        + '</div>'
        + '<div class="meta">'
        + '<span>' + (c.pv||'') + ' ' + (c.ct||'') + ' ' + (c.dist != null ? c.dist + 'km' : '') + '</span>'
        + '<span>资本 ' + fmtCap(c.rc) + '</span>'
        + '<span>人数 ' + (c.ssn||0) + '</span>'
        + (c.em ? '<span style="color:var(--good)">有邮箱</span>' : '')
        + '</div>';
      el.onclick = function() {
        if (c.la != null) map.flyTo([c.la, c.lo], 13);
      };
      list.appendChild(el);
    });
    document.getElementById('list-count').textContent = filtered.length + (top.length < filtered.length ? ' (前' + top.length + '条)' : '');
  }

  renderMap();
  renderList();
})();
</script>
</body>
</html>`;
  };

  const handleExport = async () => {
    if (exporting) return;
    setExporting(true);
    setExportMessage('');
    const html = buildHtml(sortedCompanies);
    const filename = `procuremap-${taskId || 'results'}-${new Date().toISOString().slice(0, 10)}.html`;

    try {
      if (isTauriRuntime()) {
        const { save } = await import('@tauri-apps/plugin-dialog');
        const filePath = await save({
          defaultPath: filename,
          filters: [{ name: 'HTML', extensions: ['html'] }],
        });
        if (!filePath) {
          setExportMessage('已取消导出');
          return;
        }

        await apiExportHtmlFile(filePath, html);
        setExportMessage(`已保存：${filePath}`);
      } else {
        const url = URL.createObjectURL(new Blob([html], { type: 'text/html;charset=utf-8' }));
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(url);
        setExportMessage(`已下载：${filename}`);
      }
    } catch (error) {
      setExportMessage(`导出失败：${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setExporting(false);
    }
  };

  const handleToggleFullscreen = () => {
    setIsFullscreen((value) => !value);
  };

  const pageStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    minHeight: 0,
    overflow: 'hidden',
    background: 'var(--bg-primary)',
    fontFamily: 'var(--font-sans)',
    ...(isFullscreen
      ? {
          position: 'fixed',
          inset: 0,
          zIndex: 1000,
          height: '100vh',
        }
      : {}),
  };

  // Header styles
  const headerStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
    padding: '0 20px',
    height: 60,
    background: 'var(--primary-button)',
    flexShrink: 0,
  };

  const brandStyle: React.CSSProperties = {
    fontSize: 15,
    fontWeight: 700,
    color: '#FFFFFF',
    letterSpacing: 0.5,
    lineHeight: 1.3,
  };

  const statsBar: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 14,
  };

  const headerRight: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    flexShrink: 0,
  };

  const headerButton: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '0 12px',
    height: 32,
    borderRadius: 8,
    background: 'rgba(255,255,255,0.12)',
    border: 'none',
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: 600,
    cursor: 'pointer',
    fontFamily: 'var(--font-sans)',
  };

  // Body styles
  const bodyStyle: React.CSSProperties = {
    display: 'flex',
    flex: 1,
    overflow: 'hidden',
  };

  // Filter Panel
  const filterPanel: React.CSSProperties = {
    width: 290,
    flexShrink: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
    padding: '16px 14px',
    background: 'var(--bg-elevated)',
    overflowY: 'auto',
    borderRight: '1px solid var(--border-faint)',
  };

  const sectionStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  };

  const sectionLabel: React.CSSProperties = {
    fontSize: 10,
    fontWeight: 600,
    color: 'var(--text-muted)',
    letterSpacing: 0.8,
    lineHeight: 1.3,
    textTransform: 'uppercase' as const,
    marginBottom: 2,
  };

  const rangeRow: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
  };

  const rangeInput: React.CSSProperties = {
    width: '100%',
    height: 32,
    borderRadius: 10,
    background: 'var(--bg-tertiary)',
    border: 'none',
    padding: '0 10px',
    fontSize: 12,
    color: 'var(--text-primary)',
    fontFamily: 'var(--font-sans)',
    outline: 'none',
  };

  const searchInput: React.CSSProperties = {
    width: '100%',
    height: 36,
    borderRadius: 12,
    background: 'var(--bg-tertiary)',
    border: 'none',
    padding: '0 12px',
    fontSize: 13,
    color: 'var(--text-primary)',
    fontFamily: 'var(--font-sans)',
    outline: 'none',
  };

  const chipsRow: React.CSSProperties = {
    display: 'flex',
    gap: 6,
    flexWrap: 'wrap',
  };

  // Map Area
  const mapArea: React.CSSProperties = {
    flex: 1,
    position: 'relative',
    background: 'var(--bg-secondary)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  };

  const legendOverlay: React.CSSProperties = {
    position: 'absolute',
    top: 8,
    right: 8,
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
    padding: '10px 14px',
    borderRadius: 10,
    background: 'var(--bg-elevated)',
    boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
    width: 170,
    zIndex: 10,
  };

  const legendItem: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    height: 20,
  };

  const legendDot: React.CSSProperties = {
    width: 10,
    height: 10,
    borderRadius: '50%',
    flexShrink: 0,
  };

  const legendText: React.CSSProperties = {
    fontSize: 11,
    color: 'var(--text-primary)',
    lineHeight: 1.3,
  };

  const legendRadius: React.CSSProperties = {
    fontSize: 10,
    color: 'var(--text-muted)',
    lineHeight: 1.3,
    paddingTop: 2,
  };

  const demandOverlay: React.CSSProperties = {
    position: 'absolute',
    top: 8,
    left: 6,
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
    padding: '12px 14px',
    borderRadius: 10,
    background: 'var(--bg-elevated)',
    boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
    width: 340,
    zIndex: 10,
  };

  const demandTitle: React.CSSProperties = {
    fontSize: 10,
    fontWeight: 600,
    color: 'var(--text-muted)',
    letterSpacing: 0.6,
    lineHeight: 1.3,
  };

  const demandDesc: React.CSSProperties = {
    fontSize: 12,
    color: 'var(--text-primary)',
    lineHeight: 1.4,
  };

  const demandSource: React.CSSProperties = {
    fontSize: 10,
    color: 'var(--text-muted)',
    lineHeight: 1.4,
  };

  // Supplier Panel
  const supplierPanel: React.CSSProperties = {
    width: 340,
    flexShrink: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    padding: 8,
    background: 'var(--bg-elevated)',
    overflowY: 'auto',
    borderLeft: '1px solid var(--border-faint)',
  };

  const listMeta: React.CSSProperties = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '0 6px',
    height: 32,
  };

  const listCount: React.CSSProperties = {
    fontSize: 12,
    color: 'var(--text-muted)',
    lineHeight: 1.3,
  };

  const sortStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    padding: '0 10px',
    height: 28,
    borderRadius: 8,
    background: 'var(--bg-tertiary)',
    fontSize: 11,
    color: 'var(--text-primary)',
    cursor: 'pointer',
    border: 'none',
    fontFamily: 'var(--font-sans)',
  };

  // Supplier Card styles
  const supplierItem: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
    padding: '8px 10px',
    borderRadius: 10,
    background: 'var(--bg-secondary)',
    cursor: 'pointer',
    transition: 'background 0.15s',
  };

  const supplierTitleRow: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
  };

  const supplierName: React.CSSProperties = {
    fontSize: 13,
    color: 'var(--text-primary)',
    flex: 1,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  };

  const supplierMeta: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
  };

  const supplierMetaText: React.CSSProperties = {
    fontSize: 11,
    color: 'var(--text-muted)',
    lineHeight: 1.3,
  };

  // Header pill
  const pillStyle = (color: string): React.CSSProperties => ({
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    padding: '0 10px',
    height: 26,
    borderRadius: 999,
    background: 'rgba(255,255,255,0.1)',
  });

  const pillLabel: React.CSSProperties = {
    fontSize: 11,
    color: 'rgba(255,255,255,0.6)',
    lineHeight: 1.3,
  };

  const exportBtn: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    padding: '0 14px',
    height: 32,
    borderRadius: 8,
    background: '#FFFFFF',
    border: 'none',
    cursor: 'pointer',
    fontFamily: 'var(--font-sans)',
    opacity: exporting ? 0.7 : 1,
  };

  const exportLabel: React.CSSProperties = {
    fontSize: 12,
    fontWeight: 600,
    color: 'var(--primary-button)',
    lineHeight: 1.3,
  };

  const exportMessageStyle: React.CSSProperties = {
    maxWidth: 260,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    fontSize: 11,
    color: exportMessage.startsWith('导出失败') ? '#FFD1D1' : 'rgba(255,255,255,0.72)',
    lineHeight: 1.3,
  };

  return (
    <div style={pageStyle}>
      {/* Header */}
      <div style={headerStyle}>
        <span style={brandStyle}>芜湖永康检索锚点 · 铝供应商雷达</span>
        <div style={statsBar}>
          <div style={pillStyle('')}>
            <span style={pillLabel}>原厂 </span>
            <span style={{ fontSize: 11, fontWeight: 700, color: '#ff7a59' }}>{mCount}</span>
          </div>
          <div style={pillStyle('')}>
            <span style={pillLabel}>疑似一级代理 </span>
            <span style={{ fontSize: 11, fontWeight: 700, color: '#4dd6ff' }}>{aCount}</span>
          </div>
          <div style={pillStyle('')}>
            <span style={pillLabel}>已显示 </span>
            <span style={{ fontSize: 11, fontWeight: 700, color: '#FFFFFF' }}>{filteredCompanies.length}</span>
          </div>
          <div style={pillStyle('')}>
            <span style={pillLabel}>带定位 </span>
            <span style={{ fontSize: 11, fontWeight: 700, color: '#FFFFFF' }}>{withCoord}</span>
          </div>
          <div style={pillStyle('')}>
            <span style={pillLabel}>带邮箱 </span>
            <span style={{ fontSize: 11, fontWeight: 700, color: '#FFFFFF' }}>{withEmail}</span>
          </div>
        </div>
        <div style={headerRight}>
          <button style={headerButton} onClick={() => navigate('/workspace')}>
            返回工作台
          </button>
          <button style={headerButton} onClick={filters.resetFilters}>
            重置筛选
          </button>
          <button style={headerButton} onClick={handleToggleFullscreen}>
            {isFullscreen ? '退出全屏' : '全屏查看'}
          </button>
          <button style={exportBtn} onClick={handleExport} disabled={exporting}>
            <span style={{ fontSize: 13, color: 'var(--primary-button)' }}>&#8615;</span>
            <span style={exportLabel}>{exporting ? '导出中...' : '导出 HTML'}</span>
          </button>
          {exportMessage && <span style={exportMessageStyle} title={exportMessage}>{exportMessage}</span>}
        </div>
      </div>

      {/* Body */}
      <div style={bodyStyle}>
        {/* LEFT: Filter Panel */}
        <div style={filterPanel}>
          {/* Category Filter */}
          <div style={sectionStyle}>
            <span style={sectionLabel}>企业类别</span>
            <div style={chipsRow}>
              <Chip
                label="原厂/加工厂"
                active={filters.category.M}
                color="#ff7a59"
                bgColor="#ff7a591a"
                onClick={() => filters.toggleCategory('M')}
                pill
                size="sm"
              />
              <Chip
                label="疑似一级代理"
                active={filters.category.A}
                color="#0066FF"
                bgColor="#0066FF1a"
                onClick={() => filters.toggleCategory('A')}
                pill
                size="sm"
              />
            </div>
          </div>

          {/* Search */}
          <div style={sectionStyle}>
            <span style={sectionLabel}>搜索</span>
            <input
              style={searchInput}
              placeholder="搜索企业名称..."
              value={filters.searchQuery}
              onChange={(e) => filters.setSearchQuery(e.target.value)}
            />
          </div>

          {/* Province */}
          <div style={sectionStyle}>
            <span style={sectionLabel}>省份</span>
            <div style={chipsRow}>
              {PROVINCES.map((prov) => (
                <Chip
                  key={prov}
                  label={prov}
                  active={filters.province === prov}
                  onClick={() => filters.setProvince(filters.province === prov ? null : prov)}
                  size="sm"
                />
              ))}
            </div>
          </div>

          {/* Distance Range */}
          <div style={sectionStyle}>
            <span style={sectionLabel}>距离范围 (km)</span>
            <div style={rangeRow}>
              <input
                style={rangeInput}
                type="number"
                placeholder="最小"
                value={filters.distMin || ''}
                onChange={(e) => filters.setDistRange(Number(e.target.value) || 0, filters.distMax)}
              />
              <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>-</span>
              <input
                style={rangeInput}
                type="number"
                placeholder="最大"
                value={filters.distMax || ''}
                onChange={(e) => filters.setDistRange(filters.distMin, Number(e.target.value) || 500)}
              />
            </div>
          </div>

          {/* Score Range */}
          <div style={sectionStyle}>
            <span style={sectionLabel}>匹配评分</span>
            <div style={rangeRow}>
              <input
                style={rangeInput}
                type="number"
                placeholder="最低分"
                value={filters.scoreMin || ''}
                onChange={(e) => filters.setScoreRange(Number(e.target.value) || 0, filters.scoreMax)}
              />
              <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>-</span>
              <input
                style={rangeInput}
                type="number"
                placeholder="最高分"
                value={filters.scoreMax || ''}
                onChange={(e) => filters.setScoreRange(filters.scoreMin, Number(e.target.value) || 100)}
              />
            </div>
          </div>

          {/* Toggles */}
          <div style={sectionStyle}>
            <span style={sectionLabel}>筛选条件</span>
            <Toggle label="仅显示有坐标" checked={filters.onlyCoordinate} onChange={(v) => filters.setFilter({ onlyCoordinate: v })} />
            <Toggle label="仅显示有邮箱" checked={filters.onlyEmail} onChange={(v) => filters.setFilter({ onlyEmail: v })} />
            <Toggle label="仅显示活跃企业" checked={filters.onlyActive} onChange={(v) => filters.setFilter({ onlyActive: v })} />
            <Toggle label="仅显示有联系方式" checked={filters.onlyContact} onChange={(v) => filters.setFilter({ onlyContact: v })} />
            <Toggle label="仅显示规上企业" checked={filters.onlyAboveScale} onChange={(v) => filters.setFilter({ onlyAboveScale: v })} />
          </div>
        </div>

        {/* CENTER: Map Area */}
        <div style={mapArea}>
          <SupplierMap
            suppliers={filteredCompanies
              .filter((c) => c.coordinates)
              .map((c) => ({
                creditCode: c.creditCode,
                name: c.name,
                lat: c.coordinates!.lat,
                lng: c.coordinates!.lng,
                score: c.score,
                category: c.category,
                capital: c.capital,
                staffCount: c.staffCount,
                city: c.city,
                province: c.province,
                distance: c.distance,
                hasEmail: c.hasEmail,
                email: c.contacts[0]?.email,
              }))}
            onSupplierClick={(creditCode) => {
              const company = companies.find((c) => c.creditCode === creditCode);
              if (company) handleCompanyClick(company);
            }}
          />

          {/* Demand Box Overlay */}
          <div style={demandOverlay}>
            <span style={demandTitle}>数据口径</span>
            <span style={demandDesc}>
              检索锚点 · 300km 半径 · 铝原厂/加工厂与疑似一级代理 · {filteredCompanies.length} 家
            </span>
            <span style={demandSource}>
              数据源：喜啦企业数据平台；补充展示工商、规模、产品、联系方式等接口信息。
            </span>
          </div>

          {/* Legend Overlay */}
          <div style={legendOverlay}>
            <div style={legendItem}>
              <div style={{ ...legendDot, background: '#ffd45c' }} />
              <span style={legendText}>芜湖永康锚点</span>
            </div>
            <div style={legendItem}>
              <div style={{ ...legendDot, background: '#ff7a59' }} />
              <span style={legendText}>原厂/加工厂</span>
            </div>
            <div style={legendItem}>
              <div style={{ ...legendDot, background: '#4dd6ff' }} />
              <span style={legendText}>疑似一级代理</span>
            </div>
            <span style={legendRadius}>300km 半径圈</span>
          </div>
        </div>

        {/* RIGHT: Supplier Panel */}
        <div style={supplierPanel}>
          {/* List Header */}
          <div style={listMeta}>
            <span style={listCount}>筛选结果 {filteredCompanies.length} 家</span>
            <button
              style={sortStyle}
              onClick={() => {
                const sortOptions = ['distance', 'score', 'capital'] as const;
                const idx = sortOptions.indexOf(filters.sortBy);
                filters.setFilter({ sortBy: sortOptions[(idx + 1) % 3] });
              }}
            >
              排序: {filters.sortBy === 'distance' ? '按距离' : filters.sortBy === 'score' ? '按评分' : '按规模'} ▼
            </button>
          </div>

          {/* Supplier List */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            {sortedCompanies.map((company) => (
              <div
                key={company.id}
                style={{
                  ...supplierItem,
                  background: activeDetail?.id === company.id ? 'var(--selected-bg)' : 'var(--bg-secondary)',
                }}
                onClick={() => handleCompanyClick(company)}
              >
                {/* Title Row */}
                <div style={supplierTitleRow}>
                  <Badge type={company.category} />
                  <span style={supplierName}>{company.name}</span>
                </div>

                {/* Meta Row */}
                <div style={supplierMeta}>
                  <span style={supplierMetaText}>{company.distance}km</span>
                  <span style={supplierMetaText}>{company.capital}</span>
                  <span style={supplierMetaText}>{company.staffCount}人</span>
                  {company.hasEmail && (
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        padding: '0 5px',
                        height: 18,
                        borderRadius: 4,
                        background: 'var(--success-bg)',
                        color: 'var(--success)',
                        fontSize: 10,
                        fontWeight: 500,
                      }}
                    >
                      &#9993;
                    </span>
                  )}
                  <span
                    style={{
                      marginLeft: 'auto',
                      display: 'inline-flex',
                      alignItems: 'center',
                      padding: '0 5px',
                      height: 18,
                      borderRadius: 4,
                      background: company.score >= 85 ? 'var(--success-bg)' : company.score >= 70 ? 'var(--warning-bg)' : 'var(--error-bg)',
                      color: company.score >= 85 ? 'var(--success)' : company.score >= 70 ? 'var(--warning)' : 'var(--error)',
                      fontSize: 10,
                      fontWeight: 700,
                    }}
                  >
                    {company.score}%
                  </span>
                </div>

                {/* Detail expansion */}
                {activeDetail?.id === company.id && (
                  <div style={{ paddingTop: 8, borderTop: '1px solid var(--border-faint)', marginTop: 4 }}>
                    <p style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: 8 }}>
                      {company.description}
                    </p>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 8 }}>
                      {company.products.map((p) => (
                        <span
                          key={p}
                          style={{
                            padding: '2px 8px',
                            borderRadius: 6,
                            background: 'var(--bg-tertiary)',
                            fontSize: 11,
                            color: 'var(--text-secondary)',
                          }}
                        >
                          {p}
                        </span>
                      ))}
                    </div>
                    {company.contacts.length > 0 && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        {company.contacts.map((c, i) => (
                          <div key={i} style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                            <span style={{ fontWeight: 600 }}>{c.name}</span>
                            {' · '}{c.phone}{' · '}
                            <span style={{ color: 'var(--accent)' }}>{c.email}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    <button
                      style={{
                        marginTop: 8,
                        padding: '4px 12px',
                        height: 28,
                        borderRadius: 8,
                        border: 'none',
                        background: 'var(--accent-bg)',
                        color: 'var(--accent)',
                        fontSize: 11,
                        fontWeight: 500,
                        cursor: 'pointer',
                        fontFamily: 'var(--font-sans)',
                      }}
                      onClick={(event) => {
                        event.stopPropagation();
                        if (taskId && company.creditCode) {
                          navigate(`/results/${taskId}/company/${company.creditCode}`);
                        }
                      }}
                    >
                      查看完整详情
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
