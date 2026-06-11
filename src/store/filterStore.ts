import { create } from 'zustand';

export interface FilterState {
  category: { M: boolean; A: boolean };
  searchQuery: string;
  province: string | null;
  distMin: number;
  distMax: number;
  scoreMin: number;
  scoreMax: number;
  onlyCoordinate: boolean;
  onlyEmail: boolean;
  onlyAboveScale: boolean;
  onlyActive: boolean;
  onlyContact: boolean;
  onlyRiskFree: boolean;
  sortBy: 'distance' | 'score' | 'capital';

  setFilter: (updates: Partial<FilterState>) => void;
  resetFilters: () => void;
  toggleCategory: (cat: 'M' | 'A') => void;
  setSearchQuery: (query: string) => void;
  setProvince: (province: string | null) => void;
  setDistRange: (min: number, max: number) => void;
  setScoreRange: (min: number, max: number) => void;
}

const defaults: Omit<FilterState, 'setFilter' | 'resetFilters' | 'toggleCategory' | 'setSearchQuery' | 'setProvince' | 'setDistRange' | 'setScoreRange'> = {
  category: { M: true, A: true },
  searchQuery: '',
  province: null,
  distMin: 0,
  distMax: 500,
  scoreMin: 0,
  scoreMax: 100,
  onlyCoordinate: false,
  onlyEmail: false,
  onlyAboveScale: false,
  onlyActive: false,
  onlyContact: false,
  onlyRiskFree: false,
  sortBy: 'distance',
};

export const useFilterStore = create<FilterState>((set) => ({
  ...defaults,

  setFilter: (updates) => set(updates),

  resetFilters: () => set(defaults),

  toggleCategory: (cat) =>
    set((state) => ({
      category: { ...state.category, [cat]: !state.category[cat] },
    })),

  setSearchQuery: (query) => set({ searchQuery: query }),

  setProvince: (province) => set({ province }),

  setDistRange: (min, max) => set({ distMin: min, distMax: max }),

  setScoreRange: (min, max) => set({ scoreMin: min, scoreMax: max }),
}));
