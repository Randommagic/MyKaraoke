import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { StyleSheet, Text, View } from "react-native";

import { DesignColors } from "@/components/design/colors";
import { sanitizeKaraokeDigits } from "@/lib/song-form-helpers";

/** 추가/중복/완료 모달 안에서 곡을 미리 보여주는 카드(썸네일·제목·가수·TJ). */
export function ChartModalSongPreview({
  title,
  artist,
  tjPro,
  imageUri,
}: {
  title: string;
  artist: string;
  tjPro?: string | number;
  imageUri?: string | null;
}) {
  const uri = imageUri?.trim();
  const displayTitle = title.trim() || "(제목 없음)";
  const displayArtist = artist.trim();
  const tj = tjPro ? sanitizeKaraokeDigits(String(tjPro)) : "";

  return (
    <View style={styles.preview}>
      {uri ? (
        <Image
          source={{ uri }}
          style={styles.thumb}
          contentFit="cover"
          accessibilityIgnoresInvertColors
        />
      ) : (
        <View style={[styles.thumb, styles.thumbPlaceholder]}>
          <Ionicons name="musical-notes" size={20} color={DesignColors.textFaint} />
        </View>
      )}
      <View style={styles.text}>
        <Text style={styles.title} numberOfLines={2}>
          {displayTitle}
        </Text>
        {displayArtist ? (
          <Text style={styles.artist} numberOfLines={1}>
            {displayArtist}
          </Text>
        ) : null}
        {tj ? (
          <View style={styles.tjPill}>
            <Text style={styles.tjPillLabel}>TJ {tj}</Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  preview: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    backgroundColor: DesignColors.inputSurface,
    borderWidth: 1,
    borderColor: DesignColors.bgBorder,
    borderRadius: 12,
    padding: 12,
    marginBottom: 20,
  },
  thumb: {
    width: 48,
    height: 48,
    borderRadius: 8,
    backgroundColor: DesignColors.bgCard,
  },
  thumbPlaceholder: {
    backgroundColor: DesignColors.bgCard,
    borderWidth: 1,
    borderColor: DesignColors.bgBorder,
    alignItems: "center",
    justifyContent: "center",
  },
  text: {
    flex: 1,
    minWidth: 0,
    gap: 4,
  },
  title: {
    fontSize: 15,
    fontWeight: "600",
    lineHeight: 21,
    color: DesignColors.textPrimary,
    letterSpacing: -0.2,
  },
  artist: {
    fontSize: 13,
    lineHeight: 18,
    color: DesignColors.textSecondary,
  },
  tjPill: {
    alignSelf: "flex-start",
    marginTop: 2,
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 8,
    backgroundColor: DesignColors.filterChipActiveBg,
  },
  tjPillLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: DesignColors.accent,
    letterSpacing: 0.2,
  },
});
