'use client';
import { create } from 'zustand';

type Theme = 'dark' | 'light';
type ModalKey = 'settings' | 'auth' | 'achievement' | null;

interface UiState {
  theme:              Theme;
  activeModal:        ModalKey;
  isCommandPaletteOpen: boolean;
  sidebarCollapsed:   boolean;

  setTheme:           (t: Theme)    => void;
  openModal:          (k: ModalKey) => void;
  closeModal:         ()            => void;
  toggleCommandPalette: ()          => void;
  toggleSidebar:      ()            => void;
}

export const useUiStore = create<UiState>()((set) => ({
  theme:               'dark',
  activeModal:          null,
  isCommandPaletteOpen: false,
  sidebarCollapsed:     false,

  setTheme:           (t) => set({ theme: t }),
  openModal:          (k) => set({ activeModal: k }),
  closeModal:         ()  => set({ activeModal: null }),
  toggleCommandPalette: () =>
    set((s) => ({ isCommandPaletteOpen: !s.isCommandPaletteOpen })),
  toggleSidebar: () =>
    set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
}));
