import {
  cloneElement,
  createContext,
  isValidElement,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactElement,
  type ReactNode,
} from "react";
import {
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  View,
  type LayoutChangeEvent,
  type FocusEvent,
  type ScrollViewProps,
  type StyleProp,
  type TextInputProps,
  StyleSheet,
  type ViewStyle,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type KeyboardAwareScrollContextValue = {
  registerFieldY: (y: number) => void;
  clearFocus: () => void;
};

const KeyboardAwareScrollContext =
  createContext<KeyboardAwareScrollContextValue | null>(null);

type KeyboardAwareScrollViewProps = {
  children: ReactNode;
  /** ScrollView 밖, KeyboardAvoidingView 안에 고정 (저장 버튼 등) */
  footer?: ReactNode;
  style?: StyleProp<ViewStyle>;
  scrollStyle?: StyleProp<ViewStyle>;
  contentContainerStyle?: StyleProp<ViewStyle>;
  /** 키보드 위 여유 + safe area 외 추가 하단 패딩 */
  extraBottomPadding?: number;
  /** 포커스된 필드를 상단에서 이만큼 띄움 */
  scrollTopInset?: number;
  showsVerticalScrollIndicator?: boolean;
  /** false면 flex:1 미적용 (모달 등) */
  fill?: boolean;
} & Pick<ScrollViewProps, "keyboardShouldPersistTaps">;

/**
 * 폼·모달 등 ScrollView + TextInput 화면에서 키보드가 입력란을 가리지 않도록 함.
 * 자식 TextInput은 `KeyboardAwareField`로 감싸면 포커스 시 자동 스크롤.
 */
export function KeyboardAwareScrollView({
  children,
  footer,
  style,
  scrollStyle,
  contentContainerStyle,
  extraBottomPadding = 32,
  scrollTopInset = 24,
  showsVerticalScrollIndicator = true,
  keyboardShouldPersistTaps = "handled",
  fill = true,
}: KeyboardAwareScrollViewProps) {
  const insets = useSafeAreaInsets();
  const scrollRef = useRef<ScrollView>(null);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const focusYRef = useRef(0);
  const hasFocusRef = useRef(false);

  const scrollToFocused = useCallback(() => {
    scrollRef.current?.scrollTo({
      y: Math.max(0, focusYRef.current - scrollTopInset),
      animated: true,
    });
  }, [scrollTopInset]);

  useEffect(() => {
    const showEvent =
      Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent =
      Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";

    const showSub = Keyboard.addListener(showEvent, (e) => {
      setKeyboardHeight(e.endCoordinates.height);
      if (hasFocusRef.current) {
        requestAnimationFrame(() => scrollToFocused());
      }
    });
    const hideSub = Keyboard.addListener(hideEvent, () => {
      setKeyboardHeight(0);
    });

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, [scrollToFocused]);

  const registerFieldY = useCallback(
    (y: number) => {
      focusYRef.current = y;
      hasFocusRef.current = true;
      requestAnimationFrame(() => scrollToFocused());
    },
    [scrollToFocused],
  );

  const clearFocus = useCallback(() => {
    hasFocusRef.current = false;
  }, []);

  const ctx = useMemo(
    () => ({ registerFieldY, clearFocus }),
    [registerFieldY, clearFocus],
  );

  const bottomPad =
    Math.max(insets.bottom, 24) + keyboardHeight + extraBottomPadding;

  return (
    <KeyboardAwareScrollContext.Provider value={ctx}>
      <KeyboardAvoidingView
        style={[fill ? styles.fill : null, style]}
        behavior="padding"
        keyboardVerticalOffset={0}
      >
        <ScrollView
          ref={scrollRef}
          style={[fill ? styles.fill : null, scrollStyle]}
          contentContainerStyle={[
            contentContainerStyle,
            { paddingBottom: bottomPad },
          ]}
          keyboardShouldPersistTaps={keyboardShouldPersistTaps}
          keyboardDismissMode="on-drag"
          automaticallyAdjustKeyboardInsets
          showsVerticalScrollIndicator={showsVerticalScrollIndicator}
        >
          {children}
        </ScrollView>
        {footer}
      </KeyboardAvoidingView>
    </KeyboardAwareScrollContext.Provider>
  );
}

type KeyboardAwareFieldProps = {
  children: ReactElement<TextInputProps>;
  style?: StyleProp<ViewStyle>;
};

/** 단일 TextInput을 감싸 포커스 시 ScrollView 안으로 스크롤 */
export function KeyboardAwareField({ children, style }: KeyboardAwareFieldProps) {
  const ctx = useContext(KeyboardAwareScrollContext);
  const yRef = useRef(0);

  const onLayout = useCallback((e: LayoutChangeEvent) => {
    yRef.current = e.nativeEvent.layout.y;
  }, []);

  if (!ctx || !isValidElement(children)) {
    return <View style={style}>{children}</View>;
  }

  const prevOnFocus = children.props.onFocus;
  const prevOnBlur = children.props.onBlur;

  return (
    <View style={style} onLayout={onLayout}>
      {cloneElement(children, {
        onFocus: (e: FocusEvent) => {
          ctx.registerFieldY(yRef.current);
          prevOnFocus?.(e);
        },
        onBlur: (e: FocusEvent) => {
          ctx.clearFocus();
          prevOnBlur?.(e);
        },
      } satisfies Partial<TextInputProps>)}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
});
