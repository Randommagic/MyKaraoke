/**
 * 공용 모달 쉘 — 딤 처리된 배경 + 가운데 카드.
 *
 * 화면마다 반복하던 Modal + 백드롭(Pressable) + 카드 구조를 한곳으로.
 * 내용(제목·메시지·버튼 등)은 children으로 받는다.
 */
import type { ReactNode } from "react";
import {
  Modal,
  Pressable,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";

import { DesignColors } from "@/components/design/colors";
import { Radius, Spacing } from "@/components/design/tokens";

export function AppModal({
  visible,
  onClose,
  children,
  /** false면 배경 탭·뒤로가기로 닫히지 않음 (예: 저장 중) */
  dismissable = true,
  cardStyle,
  rootStyle,
}: {
  visible: boolean;
  onClose: () => void;
  children: ReactNode;
  dismissable?: boolean;
  cardStyle?: StyleProp<ViewStyle>;
  rootStyle?: StyleProp<ViewStyle>;
}) {
  const close = dismissable ? onClose : undefined;
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={close}
    >
      <View style={[styles.root, rootStyle]}>
        <Pressable
          style={styles.backdrop}
          onPress={close}
          accessibilityLabel="닫기"
        />
        <View style={[styles.card, cardStyle]}>{children}</View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: Spacing.xl5,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: DesignColors.scrim,
  },
  card: {
    backgroundColor: DesignColors.bgCard,
    borderWidth: 1,
    borderColor: DesignColors.bgBorder,
    borderRadius: Radius.modal,
    paddingHorizontal: Spacing.xl4,
    paddingTop: 22,
    paddingBottom: Spacing.xl3,
    maxWidth: 400,
    width: "100%",
    alignSelf: "center",
  },
});
