/** XP awarded per session based on performance */
export function calculateSessionXp(params: {
  wpm: number;
  accuracy: number;
  durationMs: number;
  mode: string;
}): number {
  const { wpm, accuracy, durationMs } = params;
  const minutes = durationMs / 60_000;

  // Base XP: WPM × duration factor
  const base = Math.round(wpm * minutes * 2);

  // Accuracy multiplier: 1.0 at 90%, up to 1.5 at 100%, penalised below 80%
  const accMult =
    accuracy >= 90 ? 1 + (accuracy - 90) * 0.05
    : accuracy >= 80 ? 1
    : 0.7;

  return Math.round(base * accMult);
}

/** XP awarded for individual achievement unlocks (defined in achievement catalog) */
export const ACHIEVEMENT_XP_MAP: Record<string, number> = {
  first_session:         50,
  wpm_50:               100,
  wpm_80:               200,
  wpm_100:              400,
  accuracy_95_streak:   150,
  streak_7_days:        300,
  streak_30_days:       1000,
  sessions_100:         500,
};
