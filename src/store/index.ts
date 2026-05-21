'use client';

import { create } from 'zustand';
import type { AppUser } from '@/lib/types';
import type { FilterOption, ProvinceWithCities, EducationMapping } from '@/types';

interface FilterOptions {
  locations: FilterOption[];
  job_types: FilterOption[];
  industries: FilterOption[];
  education: FilterOption[];
  sources: FilterOption[];
  provinces: ProvinceWithCities[];
  education_mapping: EducationMapping[];
}

interface AppState {
  user: AppUser | null;
  setUser: (user: AppUser | null) => void;
  isGuest: boolean;
  setIsGuest: (isGuest: boolean) => void;
  favoriteJobIds: Set<number>;
  setFavorite: (jobId: number, isFavorite: boolean) => void;
  removeFavorite: (jobId: number) => void;
  clearFavorites: () => void;
  filterOptions: FilterOptions | null;
  setFilterOptions: (options: FilterOptions) => void;
}

export const useAppStore = create<AppState>((set) => ({
  user: null,
  setUser: (user) => set({ user }),
  isGuest: false,
  setIsGuest: (isGuest) => set({ isGuest }),
  favoriteJobIds: new Set<number>(),
  setFavorite: (jobId, isFavorite) =>
    set((state) => {
      const next = new Set(state.favoriteJobIds);
      if (isFavorite) next.add(jobId); else next.delete(jobId);
      return { favoriteJobIds: next };
    }),
  removeFavorite: (jobId) =>
    set((state) => {
      const next = new Set(state.favoriteJobIds);
      next.delete(jobId);
      return { favoriteJobIds: next };
    }),
  clearFavorites: () => set({ favoriteJobIds: new Set() }),
  filterOptions: null,
  setFilterOptions: (options) => set({ filterOptions: options }),
}));
