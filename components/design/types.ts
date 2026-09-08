export type ReadyStatus = "none" | "done" | "practice" | "try";
export type DateRange = "today" | "week" | "within15" | "month" | null;
export type GenderBadgeKey = "male" | "female";

export interface SongCardModel {
  title: string;
  readyStatus: ReadyStatus;
  keyOffset: number | null;
  lastSungAt: string | null;
  genderKey: GenderBadgeKey | null;
  showKeyBadge: boolean;
}
