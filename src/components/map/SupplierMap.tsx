import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

interface Supplier {
  creditCode: string;
  name: string;
  lat: number;
  lng: number;
  score?: number;
  category?: 'M' | 'A';
  capital?: string;
  staffCount?: number;
  city?: string;
  province?: string;
  distance?: number;
  hasEmail?: boolean;
  email?: string;
}

interface SupplierMapProps {
  suppliers: Supplier[];
  originLat?: number;
  originLng?: number;
  originLabel?: string;
  radiusKm?: number;
  onSupplierClick?: (creditCode: string) => void;
  style?: React.CSSProperties;
}

function fmtCap(v: unknown): string {
  if (!v && v !== 0) return '--';
  const n = Number(v);
  if (isNaN(n)) return String(v);
  if (n >= 10000) return (n / 10000).toFixed(1).replace(/\.0$/, '') + ' 亿';
  return n + ' 万';
}

export const SupplierMap: React.FC<SupplierMapProps> = ({
  suppliers,
  originLat,
  originLng,
  originLabel,
  radiusKm,
  onSupplierClick,
  style,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<L.Layer[]>([]);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, {
      zoomControl: true,
      attributionControl: true,
      preferCanvas: true,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 18,
      attribution: '&copy; <a href="https://openstreetmap.org/copyright">OSM</a>',
    }).addTo(map);

    mapRef.current = map;

    // ResizeObserver keeps the map responsive to container dimension changes
    const ro = new ResizeObserver(() => {
      map.invalidateSize();
    });
    ro.observe(containerRef.current);

    // Ensure correct size after initial layout
    requestAnimationFrame(() => {
      map.invalidateSize();
    });

    return () => {
      ro.disconnect();
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    const bounds: L.LatLngTuple[] = [];

    // Origin marker
    if (originLat && originLng) {
      const originIcon = L.divIcon({
        html: `<div class="na-marker-origin">${originLabel || '锚点'}</div>`,
        className: '',
        iconSize: [32, 32],
        iconAnchor: [16, 16],
      });
      const originMarker = L.marker([originLat, originLng], { icon: originIcon }).addTo(map);
      markersRef.current.push(originMarker);
      bounds.push([originLat, originLng]);
    }

    // Radius circle
    if (originLat && originLng && radiusKm) {
      const circle = L.circle([originLat, originLng], {
        radius: radiusKm * 1000,
        color: 'rgba(255,255,255,0.15)',
        fillColor: 'rgba(77,214,255,0.04)',
        fillOpacity: 1,
        weight: 1,
        dashArray: '6 4',
      }).addTo(map);
      markersRef.current.push(circle);
    }

    // Supplier markers
    const withCoords = suppliers.filter((s) => s.lat && s.lng);
    withCoords.forEach((s) => {
      const cat = s.category || 'M';
      const size = 16;

      const icon = L.divIcon({
        html: `<div class="na-marker-${cat === 'M' ? 'mill' : 'agent'}">${cat}</div>`,
        className: '',
        iconSize: [size, size],
        iconAnchor: [size / 2, size / 2],
      });

      const marker = L.marker([s.lat, s.lng], { icon });

      const parts: string[] = [];
      parts.push(`<div class="na-tt-name">${s.name}</div>`);
      parts.push(
        `<div class="na-tt-meta">` +
          `<span class="na-tt-badge na-tt-badge-${cat}">${cat === 'M' ? '原厂' : '代理'}</span>` +
          `<span>${s.province || ''} ${s.city || ''}</span>` +
          `<span>${s.distance != null ? s.distance + 'km' : ''}</span>` +
          `</div>`
      );
      parts.push(
        `<div class="na-tt-meta" style="margin-top:4px">` +
          `<span>注册资本 ${fmtCap(s.capital)}</span>` +
          `<span>员工 ${s.staffCount || 0}</span>` +
          `<span>评分 ${s.score ?? '--'}</span>` +
          `</div>`
      );
      if (s.hasEmail && s.email) {
        parts.push(`<div class="na-tt-meta na-tt-email">邮箱 ${s.email}</div>`);
      }

      marker.bindTooltip(parts.join(''), {
        direction: 'top',
        offset: [0, -(size / 2 + 4)],
        opacity: 1,
      });

      if (onSupplierClick) {
        marker.on('click', () => onSupplierClick(s.creditCode));
      }

      marker.addTo(map);
      markersRef.current.push(marker);
      bounds.push([s.lat, s.lng]);
    });

    if (bounds.length > 0) {
      map.fitBounds(L.latLngBounds(bounds), { padding: [50, 50], maxZoom: 13 });
    }
    map.invalidateSize();
  }, [suppliers, originLat, originLng, originLabel, radiusKm, onSupplierClick]);

  return (
    <div
      ref={containerRef}
      className="na-supplier-map"
      style={{
        width: '100%',
        height: '100%',
        minHeight: 300,
        ...style,
      }}
    />
  );
};
