'use client';
/**
 * multiplayerStore — Phase 2 placeholder.
 * Scaffolded so the Zustand domain separation is consistent from day 1.
 * WebSocket integration will be added in Phase 2.
 */
import { create } from 'zustand';

type RaceStatus = 'lobby' | 'countdown' | 'racing' | 'finished';

interface Competitor {
  userId: string;
  username: string;
  avatarUrl?: string;
  wpm: number;
  progress: number; // 0-100
  rank: number;
}

interface MultiplayerState {
  roomId:      string | null;
  raceStatus:  RaceStatus;
  competitors: Competitor[];
  myProgress:  number;

  setRoom:         (id: string) => void;
  setRaceStatus:   (s: RaceStatus) => void;
  updateCompetitor:(c: Competitor) => void;
  setMyProgress:   (p: number) => void;
  leaveRoom:       () => void;
}

export const useMultiplayerStore = create<MultiplayerState>()((set) => ({
  roomId:       null,
  raceStatus:   'lobby',
  competitors:  [],
  myProgress:   0,

  setRoom:         (id) => set({ roomId: id }),
  setRaceStatus:   (s)  => set({ raceStatus: s }),
  updateCompetitor: (c) =>
    set((state) => ({
      competitors: state.competitors.map((x) =>
        x.userId === c.userId ? c : x,
      ),
    })),
  setMyProgress: (p) => set({ myProgress: p }),
  leaveRoom:     ()  => set({ roomId: null, raceStatus: 'lobby', competitors: [], myProgress: 0 }),
}));
