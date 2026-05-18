export interface WpmDataPoint {
  sessionIndex: number;
  completedAt: string;
  wpm: number;
  accuracy: number;
}

export interface AnalyticsSummary {
  userId: string;
  avgWpm: number;
  bestWpm: number;
  avgAccuracy: number;
  totalSessions: number;
  totalTimeMs: number;
  last30Days: WpmDataPoint[];
}

export interface WeakKeyAnalysis {
  keyChar: string;
  errorRate: number;
  avgLatencyMs: number;
  /** Relative to the user's mean latency — how many std deviations slower */
  latencyZScore: number;
  sampleCount: number;
  /** Suggested drill text focusing this key */
  suggestedDrill?: string;
}

export interface DashboardData {
  summary: AnalyticsSummary;
  weakKeys: WeakKeyAnalysis[];
  last30Days: WpmDataPoint[];
  recentSessions: {
    id: string;
    wpm: number;
    accuracy: number;
    durationMs: number;
    completedAt: string;
  }[];
}
