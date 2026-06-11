import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { apiCreateAnalysis, apiGetDefaultConfig, type RunConfig } from '@/api';

const MATERIALS = ['铝', '国标', '钢', '塑料', '不锈钢', '铜', '纸', '电子'];
const QUICK_TAGS = ['不锈钢板', '铝合金型材', '注塑模具', '电子元器件', '包装材料'];

interface GeoResult {
  display_name: string;
  lat: string;
  lon: string;
}

const NOMINATIM = 'https://nominatim.openstreetmap.org/search';

async function searchLocation(query: string): Promise<GeoResult[]> {
  const url = `${NOMINATIM}?q=${encodeURIComponent(query)}&format=json&limit=5&accept-language=zh&countrycodes=cn`;
  const res = await fetch(url, {
    headers: {
      'Accept': 'application/json',
      'User-Agent': 'ProcureMap/1.0 (supplier-intelligence)',
    },
  });
  if (!res.ok) return [];
  return res.json();
}

export const NewAnalysisForm: React.FC = () => {
  const navigate = useNavigate();
  const [keyword, setKeyword] = useState('');
  const [region, setRegion] = useState('芜湖');
  const [regionInput, setRegionInput] = useState('芜湖');
  const [distance, setDistance] = useState(300);
  const [distanceInput, setDistanceInput] = useState('300');
  const [material, setMaterial] = useState('铝');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // geocoding
  const [geoResults, setGeoResults] = useState<GeoResult[]>([]);
  const [geoOpen, setGeoOpen] = useState(false);
  const [geoLoading, setGeoLoading] = useState(false);
  const geoTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const geoContainer = useRef<HTMLDivElement>(null);

  const doSearch = useCallback((q: string) => {
    if (q.trim().length < 2) {
      setGeoResults([]);
      setGeoOpen(false);
      return;
    }
    setGeoLoading(true);
    searchLocation(q.trim()).then((results) => {
      setGeoResults(results);
      setGeoOpen(results.length > 0);
      setGeoLoading(false);
    }).catch(() => {
      setGeoLoading(false);
    });
  }, []);

  // close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (geoContainer.current && !geoContainer.current.contains(e.target as Node)) {
        setGeoOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleSubmit = async () => {
    setError('');
    setSubmitting(true);

    try {
      const taskId = crypto.randomUUID();
      const defaultConfig = await apiGetDefaultConfig().catch(() => null);

      const config: RunConfig = {
        origin_name: region || defaultConfig?.origin_name || '芜湖',
        material_label: material || defaultConfig?.material_label || '铝',
        keywords: [keyword.trim()],
        areas: defaultConfig?.areas || ['安徽', '江苏', '浙江', '上海'],
        radius_km: distance || defaultConfig?.radius_km || 300,
        max_details: defaultConfig?.max_details || 20,
        enrich_limit: defaultConfig?.enrich_limit || 3,
        pages: defaultConfig?.pages || 2,
        search_limit: defaultConfig?.search_limit || 10,
        output_dir: defaultConfig?.output_dir || '',
        lat: defaultConfig?.lat ?? null,
        lng: defaultConfig?.lng ?? null,
        industry_name3: defaultConfig?.industry_name3 || '',
        internal_token: defaultConfig?.internal_token || '',
        pause: defaultConfig?.pause ?? 0.16,
        timeout: defaultConfig?.timeout ?? 14.0,
      };

      await apiCreateAnalysis(taskId, config);
      navigate(`/processing/${taskId}`);
    } catch {
      const taskId = 'task-' + Date.now();
      navigate(`/processing/${taskId}`);
    } finally {
      setSubmitting(false);
    }
  };

  /* ---- shared mini-components ---- */

  const SectionLabel: React.FC<{ icon: string; label: string }> = ({ icon, label }) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
      <span style={{ fontSize: 15, lineHeight: 1 }}>{icon}</span>
      <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.3 }}>
        {label}
      </span>
    </div>
  );

  /* ---- styles ---- */

  const cardStyle: React.CSSProperties = {
    background: 'var(--bg-elevated)',
    borderRadius: 18,
    boxShadow: '0 0 0 1px rgba(0,0,0,0.04), 0 2px 8px rgba(0,0,0,0.04), 0 8px 24px rgba(0,0,0,0.04)',
    overflow: 'hidden',
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    minHeight: 0,
  };

  const cardBody: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: 30,
    flex: 1,
    minHeight: 0,
    padding: '40px 48px',
    overflowY: 'auto',
  };

  const keywordWrap: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
  };

  const inputRow: React.CSSProperties = {
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
  };

  const searchIcon: React.CSSProperties = {
    position: 'absolute',
    left: 16,
    fontSize: 16,
    color: 'var(--text-muted)',
    pointerEvents: 'none',
    lineHeight: 1,
    zIndex: 1,
  };

  const keywordInput: React.CSSProperties = {
    width: '100%',
    height: 56,
    borderRadius: 14,
    background: 'var(--bg-tertiary)',
    border: '2px solid transparent',
    padding: '0 48px 0 42px',
    fontSize: 15,
    fontWeight: 500,
    color: 'var(--text-primary)',
    fontFamily: 'var(--font-sans)',
    outline: 'none',
    lineHeight: 1.3,
  };

  const quickTagsRow: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  };

  const quickLabel: React.CSSProperties = {
    fontSize: 12,
    color: 'var(--text-muted)',
    fontWeight: 500,
  };

  const configRow: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: 20,
    alignItems: 'start',
  };

  const textInputStyle: React.CSSProperties = {
    width: '100%',
    height: 46,
    borderRadius: 12,
    background: 'var(--bg-tertiary)',
    border: '2px solid transparent',
    padding: '0 14px',
    fontSize: 14,
    fontWeight: 600,
    color: 'var(--text-primary)',
    fontFamily: 'var(--font-sans)',
    outline: 'none',
    lineHeight: 1.3,
  };

  const summaryCard: React.CSSProperties = {
    background: 'var(--bg-elevated)',
    borderRadius: 14,
    padding: '16px 18px',
    border: '1px solid var(--border-subtle)',
    marginBottom: 18,
  };

  const summaryHeader: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 7,
    marginBottom: 10,
  };

  const summaryParams: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: 5,
  };

  const summaryRow: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    fontSize: 13,
    lineHeight: 1.45,
  };

  const summaryLabel: React.CSSProperties = {
    color: 'var(--text-muted)',
    flexShrink: 0,
    fontSize: 12,
  };

  const summaryValue: React.CSSProperties = {
    color: 'var(--text-primary)',
    fontWeight: 600,
    fontSize: 13,
  };

  const errorStyle: React.CSSProperties = {
    fontSize: 13,
    color: 'var(--error)',
    lineHeight: 1.4,
    padding: '10px 14px',
    background: 'var(--error-bg)',
    borderRadius: 10,
    marginBottom: 12,
  };

  return (
    <div style={cardStyle}>
      <div style={{ height: 3, background: 'linear-gradient(90deg, var(--accent), var(--accent) 60%, transparent)', flexShrink: 0 }} />

      <div style={cardBody}>
        {/* ── 物料关键词 ── */}
        <div style={keywordWrap}>
          <SectionLabel icon="📦" label="物料关键词" />
          <div style={inputRow}>
            <span style={searchIcon}>🔍</span>
            <input
              id="na-keyword"
              name="keyword"
              className="na-keyword-input"
              style={keywordInput}
              placeholder="输入产品/物料名称，例如铝合金型材、不锈钢板..."
              value={keyword}
              onChange={(event) => {
                setKeyword(event.target.value);
                if (error) setError('');
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  void handleSubmit();
                }
              }}
              autoFocus
            />
          </div>
          <div style={quickTagsRow}>
            <span style={quickLabel}>快速填入</span>
            {QUICK_TAGS.map((tag) => (
              <OptionChip
                key={tag}
                label={tag}
                active={keyword === tag}
                onClick={() => {
                  setKeyword(tag);
                  setError('');
                }}
              />
            ))}
          </div>
        </div>

        <div style={{ height: 1, background: 'var(--border-subtle)' }} />

        {/* ── 搜索配置 ── */}
        <div>
          <SectionLabel icon="⚙️" label="搜索配置" />
          <div style={configRow}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label htmlFor="na-region" style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>
                位置锚点
              </label>
              <div ref={geoContainer} style={{ position: 'relative' }}>
                <div style={{ position: 'relative' }}>
                  <input
                    id="na-region"
                    name="region"
                    className="na-keyword-input"
                    style={textInputStyle}
                    placeholder="输入城市名或具体地址搜索..."
                    value={regionInput}
                    autoComplete="off"
                    onChange={(event) => {
                      const v = event.target.value;
                      setRegionInput(v);
                      setRegion(v);
                      clearTimeout(geoTimer.current);
                      if (v.trim().length >= 2) {
                        geoTimer.current = setTimeout(() => doSearch(v), 350);
                      } else {
                        setGeoResults([]);
                        setGeoOpen(false);
                      }
                    }}
                    onFocus={() => {
                      if (geoResults.length > 0) setGeoOpen(true);
                    }}
                  />
                  {geoLoading && (
                    <span style={{
                      position: 'absolute', right: 12, top: '50%',
                      transform: 'translateY(-50%)', fontSize: 14, color: 'var(--text-muted)',
                    }}>
                      ⏳
                    </span>
                  )}
                </div>
                {geoOpen && geoResults.length > 0 && (
                  <div style={{
                    position: 'absolute',
                    top: '100%',
                    left: 0,
                    right: 0,
                    marginTop: 4,
                    background: 'var(--bg-elevated)',
                    borderRadius: 12,
                    boxShadow: '0 4px 20px rgba(0,0,0,0.12), 0 0 0 1px rgba(0,0,0,0.06)',
                    zIndex: 20,
                    overflow: 'hidden',
                  }}>
                    {geoResults.map((r, i) => (
                      <button
                        key={i}
                        type="button"
                        className="na-geo-item"
                        style={{
                          display: 'block',
                          width: '100%',
                          textAlign: 'left',
                          padding: '10px 14px',
                          border: 'none',
                          background: 'transparent',
                          fontSize: 13,
                          fontWeight: 500,
                          color: 'var(--text-primary)',
                          cursor: 'pointer',
                          fontFamily: 'var(--font-sans)',
                          lineHeight: 1.4,
                          borderBottom: i < geoResults.length - 1 ? '1px solid var(--border-subtle)' : 'none',
                        }}
                        onClick={() => {
                          setRegionInput(r.display_name);
                          setRegion(r.display_name);
                          setGeoOpen(false);
                        }}
                      >
                        <span style={{ fontSize: 11, color: 'var(--text-muted)', marginRight: 6 }}>
                          📍
                        </span>
                        {r.display_name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label htmlFor="na-material" style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>
                材料类别
              </label>
              <input
                id="na-material"
                name="material"
                className="na-keyword-input"
                list="na-materials"
                style={textInputStyle}
                placeholder="选择或输入材料类别..."
                value={material}
                autoComplete="off"
                onChange={(event) => setMaterial(event.target.value)}
              />
              <datalist id="na-materials">
                {MATERIALS.map((item) => (
                  <option key={item} value={item} />
                ))}
              </datalist>
              <span style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.4 }}>
                可从列表选择，也可自行输入
              </span>
            </div>
          </div>
        </div>

        <div style={{ height: 1, background: 'var(--border-subtle)' }} />

        {/* ── 搜索半径 ── */}
        <div>
          <SectionLabel icon="📏" label="搜索半径" />
          <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
            <div style={{ flex: 1, position: 'relative' }}>
              <input
                type="range"
                className="na-range"
                min={10}
                max={1000}
                step={10}
                value={distance}
                onChange={(event) => {
                  const v = Number(event.target.value);
                  setDistance(v);
                  setDistanceInput(String(v));
                }}
                style={{
                  width: '100%',
                  height: 6,
                  appearance: 'none',
                  background: `linear-gradient(to right, var(--primary-button) 0%, var(--primary-button) ${((distance - 10) / 990) * 100}%, var(--border-subtle) ${((distance - 10) / 990) * 100}%, var(--border-subtle) 100%)`,
                  borderRadius: 3,
                  outline: 'none',
                  cursor: 'pointer',
                  margin: 0,
                }}
              />
              {/* tick labels */}
              <div style={{
                display: 'flex', justifyContent: 'space-between',
                marginTop: 6, padding: '0 2px',
              }}>
                {[10, 50, 100, 200, 300, 500, 1000].map((v) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => {
                      setDistance(v);
                      setDistanceInput(String(v));
                    }}
                    style={{
                      fontSize: 10,
                      fontWeight: distance === v ? 700 : 500,
                      color: distance === v ? 'var(--primary-button)' : 'var(--text-muted)',
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      padding: 0,
                      fontFamily: 'var(--font-sans)',
                    }}
                  >
                    {v >= 1000 ? `${v / 1000}k` : v}
                  </button>
                ))}
              </div>
            </div>
            <div style={{ position: 'relative', width: 88, flexShrink: 0 }}>
              <input
                id="na-distance"
                name="distance"
                className="na-keyword-input"
                type="number"
                min={1}
                max={2000}
                style={{ ...textInputStyle, paddingRight: 36, textAlign: 'center' }}
                placeholder="自定义"
                value={distanceInput}
                onChange={(event) => {
                  const raw = event.target.value;
                  setDistanceInput(raw);
                  const n = parseInt(raw, 10);
                  if (!isNaN(n) && n > 0) {
                    setDistance(Math.min(n, 2000));
                  }
                }}
              />
              <span style={{
                position: 'absolute',
                right: 12,
                top: '50%',
                transform: 'translateY(-50%)',
                fontSize: 12,
                color: 'var(--text-muted)',
                pointerEvents: 'none',
                fontWeight: 500,
              }}>
                km
              </span>
            </div>
          </div>
          <span style={{ display: 'block', marginTop: 4, fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.4 }}>
            拖动滑块或输入数值 —— 半径越大覆盖供应商越多，耗时也会增加
          </span>
        </div>

        {/* ── Spacer pushes everything below it to the bottom ── */}
        <div style={{ flex: 1 }} />

        <div style={{ height: 1, background: 'var(--border-subtle)' }} />

        {/* ── Summary + Action ── */}
        <div style={summaryCard}>
          <div style={summaryHeader}>
            <span style={{ fontSize: 13 }}>📋</span>
            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>
              分析概要
            </span>
          </div>
          <div style={summaryParams}>
            <div style={summaryRow}>
              <span style={summaryLabel}>锚点</span>
              <span style={summaryValue}>{region}</span>
              <span style={{ ...summaryLabel, marginLeft: 'auto' }}>半径</span>
              <span style={summaryValue}>{distance} km</span>
            </div>
            <div style={summaryRow}>
              <span style={summaryLabel}>物料</span>
              <span style={summaryValue}>
                {keyword.trim() || '不限'}
              </span>
              <span style={{ ...summaryLabel, marginLeft: 'auto' }}>类别</span>
              <span style={summaryValue}>{material}</span>
            </div>
          </div>
        </div>

        {error && <div style={errorStyle}>{error}</div>}

        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <Button
            variant="primary"
            size="lg"
            className="na-submit-btn"
            style={{
              width: 320,
              height: 52,
              borderRadius: 14,
              fontSize: 16,
              fontWeight: 700,
              letterSpacing: '0.03em',
            }}
            onClick={handleSubmit}
            disabled={submitting}
          >
            {submitting ? '⏳  创建中...' : '开始分析'}
          </Button>
        </div>
      </div>
    </div>
  );
};

/* ── OptionChip ── */

const OptionChip: React.FC<{
  label: string;
  active: boolean;
  onClick: () => void;
}> = ({ label, active, onClick }) => (
  <button
    type="button"
    className={`na-chip${active ? ' na-chip-active' : ''}`}
    onClick={onClick}
    style={{
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      height: 30,
      padding: '0 12px',
      borderRadius: 20,
      border: active ? '1px solid var(--primary-button)' : '1px solid var(--border-subtle)',
      background: active ? 'var(--primary-button)' : 'transparent',
      color: active ? '#FFFFFF' : 'var(--text-secondary)',
      fontSize: 12,
      fontWeight: active ? 600 : 500,
      cursor: 'pointer',
      lineHeight: 1.3,
      fontFamily: 'var(--font-sans)',
      whiteSpace: 'nowrap',
    }}
  >
    {label}
  </button>
);
