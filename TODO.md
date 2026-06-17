# 기술 부채 (5점 항목)

코드 리뷰에서 발견된 낮은 우선순위 개선 사항. 기능에 영향 없음.

---

## 1. `SongCard` 접근성 레이블 누락
**파일**: `components/design/SongCard.tsx:30`

`TouchableOpacity`에 `accessibilityLabel`이 없어 스크린리더에서 곡 제목을 읽지 못함.

```tsx
// 변경 전
<TouchableOpacity style={styles.card} onPress={onPress} ...>

// 변경 후
<TouchableOpacity
  style={styles.card}
  onPress={onPress}
  accessibilityLabel={model.title}
  accessibilityRole="button"
  ...>
```

---

## 2. `confirm-dialog-context` 불필요한 `useMemo`
**파일**: `components/design/confirm-dialog-context.tsx:50`

`confirm`이 이미 `useCallback`으로 메모이제이션돼 있으므로 `useMemo`로 한 번 더 감쌀 필요 없음.

```tsx
// 변경 전
const value = useMemo(() => confirm, [confirm]);

// 변경 후
const value = confirm;
```

---

## 3. `console.error` + `logDebug` 중복 호출
**파일**: `app/(tabs)/index.tsx:193` (`persist` 함수 내)

같은 에러를 `logDebug`와 `console.error` 두 곳에 동시 출력 중.

```tsx
// 변경 전
logDebug(`[home] 목록 저장 실패: ...`, "error");
console.error("[persist]", e);  // 중복

// 변경 후
logDebug(`[home] 목록 저장 실패: ...`, "error");
// console.error 제거
```

---

## 4. YYYY-MM-DD 정규식 중복 정의
**파일**: `lib/songs-storage.ts`, `lib/song-form-helpers.ts`

동일한 날짜 정규식 `/^\d{4}-\d{2}-\d{2}$/`이 여러 파일에 분산.

`song-form-helpers.ts`에 상수로 추출하고 공유:

```ts
// song-form-helpers.ts에 추가
export const YMD_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
```

---

## 5. `filteredSongs`에서 `toLowerCase()` 반복 계산
**파일**: `app/(tabs)/index.tsx` (`filteredSongs` useMemo 내부)

검색어 전처리(`trim().toLowerCase()`)가 필터링 루프 안에서 매 항목마다 재계산됨.

```tsx
// 변경 전
const q = searchQuery.trim().toLowerCase();
result = result.filter(
  (s) =>
    s.title.toLowerCase().includes(q) ||
    s.artist.toLowerCase().includes(q),
);

// 변경 후: 각 곡 title/artist도 useMemo 밖에서 미리 소문자 변환하거나
// 최소한 q를 useMemo 의존성으로 분리
const lowerQuery = useMemo(
  () => searchQuery.trim().toLowerCase(),
  [searchQuery],
);
```
