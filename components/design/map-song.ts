import type { ReadyStatus, SongCardModel } from "@/components/design/types";
import {
  formatSongListTitleLine,
  getPrimarySungDate,
  YMD_STRICT_RE,
} from "@/lib/song-form-helpers";
import type { Song, SongReadiness } from "@/lib/songs-storage";

export function readinessToDesignStatus(
  readiness: SongReadiness,
): ReadyStatus {
  switch (readiness) {
    case "can_full":
      return "done";
    case "need_practice":
      return "practice";
    case "will_try":
      return "try";
    default:
      return "none";
  }
}

function sungDateToIso(ymd: string): string | null {
  const s = ymd.trim();
  if (!YMD_STRICT_RE.test(s)) return null;
  return s;
}

export function mapStorageSongToCardModel(song: Song): SongCardModel {
  const primaryYmd = getPrimarySungDate(song.sungDates);
  const transpose = Math.max(-12, Math.min(12, song.transposeSemitones));

  const genderKey =
    song.genderKey === "male" || song.genderKey === "female"
      ? song.genderKey
      : null;

  return {
    title: formatSongListTitleLine(song),
    readyStatus: readinessToDesignStatus(song.readiness),
    keyOffset: transpose,
    lastSungAt: sungDateToIso(primaryYmd),
    genderKey,
    showKeyBadge: transpose !== 0,
  };
}
