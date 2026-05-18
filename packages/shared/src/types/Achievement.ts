export interface Achievement {
  id: string;
  slug: string;
  name: string;
  description: string;
  iconUrl?: string;
  xpReward: number;
  conditionJson: AchievementCondition;
}

export type AchievementConditionType =
  | 'wpm_milestone'
  | 'accuracy_streak'
  | 'sessions_count'
  | 'streak_days'
  | 'xp_total';

export interface AchievementCondition {
  type: AchievementConditionType;
  threshold: number;
  /** Optional: require consecutive occurrences */
  streak?: number;
}

export interface UserAchievement {
  userId: string;
  achievementId: string;
  achievement: Achievement;
  unlockedAt: Date;
}
