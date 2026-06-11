import { create } from 'zustand';
import {
  apiGetAnalysis,
  apiGetCompanyDetail,
  apiGetFilteredCompanies,
  type CompanyDetail,
  type CompanyFilters,
  type ChartsData,
} from '@/api';

export type { CompanyDetail, ChartsData };

// Reuse the CompanyResult shape from taskStore for backward compat
import type { CompanyResult } from './taskStore';

// Extended view model for the results page
export interface CompanyDetailVM extends CompanyResult {
  description: string;
  products: string[];
  contacts: { name: string; phone: string; email: string }[];
  coordinates: { lat: number; lng: number } | null;
  riskScore: number;
  isActive: boolean;
  isAboveScale: boolean;
}

// Convert a backend CompanyDetail to the frontend view model
function companyToVM(c: CompanyDetail): CompanyDetailVM {
  const contacts: { name: string; phone: string; email: string }[] = [];
  const tel = c.tel || '';
  const emails = c.emails || '';
  if (tel || emails) {
    contacts.push({ name: c.operator || '联系人', phone: tel, email: emails });
  }

  return {
    id: c.credit_code,
    name: c.name,
    creditCode: c.credit_code,
    category: (c.category === 'M' ? 'M' : 'A') as 'M' | 'A',
    city: c.city,
    province: c.province,
    distance: c.distance_km,
    capital: c.registered_capital || '未知',
    staffCount: c.social_security_num || 0,
    score: c.score,
    hasEmail: !!c.emails,
    hasCoordinate: !!(c.lat && c.lng),
    hasContact: !!(c.tel || c.emails),
    description: c.scope?.slice(0, 120) || '',
    products: c.main_product || [],
    contacts,
    coordinates: c.lat && c.lng ? { lat: c.lat, lng: c.lng } : null,
    riskScore: Object.values(c.risk_counts || {}).reduce((a, b) => a + b, 0),
    isActive: !!(c.status && /在营|存续|开业/.test(c.status)),
    isAboveScale: !!c.enterprise_above_class,
  };
}

function chartsFromBackend(c: ChartsData) {
  return {
    categoryDistribution: [
      { name: '原厂/加工厂', value: c.role_counts?.M ?? c.role_counts?.factory ?? 0 },
      { name: '疑似一级代理', value: c.role_counts?.A ?? c.role_counts?.agent ?? 0 },
    ],
    provinceDistribution: Object.entries(c.province_counts || {}).map(([k, v]) => ({
      name: k,
      value: v,
    })),
    distanceDistribution: Object.entries(c.distance_buckets || {}).map(([k, v]) => ({
      name: k,
      value: v,
    })),
  };
}

// --------------- mock data (browser dev fallback) ---------------

const mockCompanies: CompanyDetailVM[] = [
  {
    id: 'c001', name: '安徽鑫铂铝业股份有限公司', creditCode: '91341100575123456A',
    category: 'M', city: '芜湖市', province: '安徽', distance: 47,
    capital: '4.2亿', staffCount: 820, score: 94,
    hasEmail: true, hasCoordinate: true, hasContact: true,
    description: '专业从事铝型材研发、生产和销售的高新技术企业',
    products: ['建筑铝型材', '工业铝型材', '新能源铝部件'],
    contacts: [{ name: '张经理', phone: '1390553****', email: 'zhang@xinbo-al.com' }],
    coordinates: { lat: 31.35, lng: 118.38 },
    riskScore: 12, isActive: true, isAboveScale: true,
  },
  // ... abbreviated mock — keep a few entries for fallback
];

// ---------------------------------------------------------------------------

interface AnalysisState {
  currentTaskId: string | null;
  companies: CompanyDetailVM[];
  chartsData: {
    categoryDistribution: { name: string; value: number }[];
    provinceDistribution: { name: string; value: number }[];
    distanceDistribution: { name: string; value: number }[];
  };
  activeCompany: CompanyDetailVM | null;
  loading: boolean;

  loadAnalysis: (taskId: string) => Promise<void>;
  loadCompanyDetail: (taskId: string, creditCode: string) => Promise<void>;
  loadFilteredCompanies: (taskId: string, filters: CompanyFilters) => Promise<void>;
  setActiveCompany: (company: CompanyDetailVM | null) => void;
}

export const useAnalysisStore = create<AnalysisState>((set) => ({
  currentTaskId: null,
  companies: [],
  chartsData: {
    categoryDistribution: [],
    provinceDistribution: [],
    distanceDistribution: [],
  },
  activeCompany: null,
  loading: false,

  loadAnalysis: async (taskId: string) => {
    set({ loading: true, currentTaskId: taskId });
    try {
      const [companies, snapshot] = await Promise.all([
        apiGetFilteredCompanies(taskId),
        apiGetAnalysis(taskId).catch(() => null),
      ]);
      set({
        companies: companies.map(companyToVM),
        chartsData: snapshot?.charts ? chartsFromBackend(snapshot.charts) : {
          categoryDistribution: [],
          provinceDistribution: [],
          distanceDistribution: [],
        },
        loading: false,
      });
    } catch {
      // Fallback to mock data for demo / browser dev
      set({ companies: mockCompanies, loading: false });
    }
  },

  loadCompanyDetail: async (taskId: string, creditCode: string) => {
    try {
      const c = await apiGetCompanyDetail(taskId, creditCode);
      set({ activeCompany: companyToVM(c) });
    } catch {
      // fallback: search mock
      const found = mockCompanies.find((c) => c.creditCode === creditCode) || null;
      set({ activeCompany: found });
    }
  },

  loadFilteredCompanies: async (taskId: string, filters: CompanyFilters) => {
    set({ loading: true });
    try {
      const companies = await apiGetFilteredCompanies(taskId, filters);
      set({ companies: companies.map(companyToVM), loading: false });
    } catch {
      set({ loading: false });
    }
  },

  setActiveCompany: (company) => set({ activeCompany: company }),
}));
