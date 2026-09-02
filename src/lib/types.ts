// Types correspondant au schéma Supabase de supabase/migrations/0001_init.sql

export type Difficulty = "easy" | "medium" | "hard" | "extreme";
export type Category =
  | "social"
  | "sport"
  | "creative"
  | "school"
  | "funny"
  | "team";
export type SubmissionStatus = "pending" | "approved" | "rejected";
export type TransactionType =
  | "challenge"
  | "bonus"
  | "penalty"
  | "manual_adjustment";

export interface Student {
  id: string;
  first_name: string;
  last_name: string | null;
  active: boolean;
  created_at: string;
}

export interface Profile {
  id: string;
  auth_user_id: string;
  student_id: string | null;
  role: "user" | "admin";
  created_at: string;
}

export interface Team {
  id: string;
  name: string;
  emoji: string;
  created_at: string;
}

export interface TeamMember {
  id: string;
  team_id: string;
  student_id: string;
  created_at: string;
  students?: Pick<Student, "first_name" | "last_name"> | null;
}

export interface Challenge {
  id: string;
  title: string;
  description: string;
  points: number;
  difficulty: Difficulty;
  category: Category;
  video_required: boolean;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Submission {
  id: string;
  team_id: string;
  challenge_id: string;
  submitted_by: string;
  video_path: string;
  status: SubmissionStatus;
  rejection_reason: string | null;
  submitted_at: string;
  reviewed_at: string | null;
  reviewed_by: string | null;
  // champs joints côté lecture
  teams?: { id: string; name: string; emoji: string } | null;
  challenges?: Pick<
    Challenge,
    "id" | "title" | "points" | "difficulty" | "category"
  > | null;
  students?: Pick<Student, "id" | "first_name" | "last_name"> | null;
}

export interface PointTransaction {
  id: string;
  team_id: string;
  amount: number;
  type: TransactionType;
  reason: string;
  challenge_id: string | null;
  created_by: string | null;
  created_at: string;
}

export interface AppNotification {
  id: string;
  user_id: string;
  title: string;
  message: string;
  read: boolean;
  created_at: string;
}

export interface TeamScore {
  team: Team;
  points: number;
  validatedCount: number;
  pendingCount: number;
  members: Student[];
  rank?: number;
}

export const DIFFICULTY_LABELS: Record<Difficulty, string> = {
  easy: "Facile",
  medium: "Moyen",
  hard: "Difficile",
  extreme: "Extrême",
};

export const DIFFICULTY_EMOJI: Record<Difficulty, string> = {
  easy: "🟢",
  medium: "🟠",
  hard: "🔴",
  extreme: "💥",
};

export const CATEGORY_LABELS: Record<Category, string> = {
  social: "Social",
  sport: "Sport",
  creative: "Créatif",
  school: "École",
  funny: "Insolite",
  team: "Équipe",
};

export const CATEGORY_EMOJI: Record<Category, string> = {
  social: "🎉",
  sport: "💪",
  creative: "🎨",
  school: "🎓",
  funny: "🤪",
  team: "🤝",
};

export const TEAM_EMOJIS = [
  "⚡",
  "🔥",
  "🚀",
  "🦾",
  "🐙",
  "🦁",
  "🐉",
  "🦅",
  "🌊",
  "⚡️",
  "☄️",
  "🧨",
  "🎯",
  "🧠",
  "💎",
  "👑",
] as const;
