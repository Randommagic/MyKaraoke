export type ReadyStatus = "none" | "done" | "practice" | "try";
export type DateRange = "today" | "week" | "month" | null;
export type GenderBadgeKey = "male" | "female";

export interface SongCardModel {
  title: string;
  readyStatus: ReadyStatus;
  keyOffset: number;
  lastSungAt: string | null;
  genderKey: GenderBadgeKey | null;
  showKeyBadge: boolean;
}
