# 기술 부채 (5점 항목)

코드 리뷰에서 발견된 낮은 우선순위 개선 사항. 기능에 영향 없음.

> 2026-09-08 처리 완료. 항목 1·2·4 반영, 항목 3·5는 확인 결과 조치 불필요(아래 참고).

---

## 1. `SongCard` 접근성 레이블 누락 — ✅ 완료
**파일**: `components/design/SongCard.tsx`

카드 `TouchableOpacity`에 `accessibilityRole="button"` + `accessibilityLabel={model.title}` 추가.

---

## 2. `confirm-dialog-context` 불필요한 `useMemo` — ✅ 완료
**파일**: `components/design/confirm-dialog-context.tsx`

`confirm`이 이미 `useCallback`으로 메모이제이션돼 있어 `useMemo` 제거하고 `value={confirm}`로 직접 전달. 미사용 `useMemo` import도 제거.

---

## 3. `console.error` + `logDebug` 중복 호출 — ⏭️ 조치 불필요
**파일**: `app/(tabs)/index.tsx` (`persist` 함수 내)

확인 결과 현재 `persist`에는 `logDebug`만 있고 `console.error`는 존재하지 않음(파일 전체에 `console.*` 호출 없음). 이미 정리된 상태로 판단, 변경 없음.

---

## 4. YYYY-MM-DD 정규식 중복 정의 — ✅ 완료(부분)
**파일**: `lib/song-form-helpers.ts` (상수 정의처)

`song-form-helpers.ts`에 두 종류의 공유 상수 추가:

```ts
export const YMD_STRICT_RE = /^\d{4}-\d{2}-\d{2}$/;      // test용 (캡처 없음)
export const YMD_CAPTURE_RE = /^(\d{4})-(\d{2})-(\d{2})$/; // exec용 (년/월/일 캡처)
```

적용처:
- `song-form-helpers.ts` 3곳 → `YMD_CAPTURE_RE`
- `lib/tjmedia-chart.ts` → `YMD_CAPTURE_RE`
- `components/design/map-song.ts` → `YMD_STRICT_RE`

제외:
- `lib/songs-storage.ts`: `song-form-helpers`가 이 파일을 import하므로, 반대로 import하면 **순환 참조** 발생. 저수준 스토리지 계층 독립성 유지를 위해 인라인 정규식 그대로 둠.
- `components/design/sung-recency.ts`: 패턴이 부분매칭(`^(\d{4}-\d{2}-\d{2})`, `$` 없음)으로 의미가 달라 통합 대상에서 제외.

---

## 5. `filteredSongs`에서 `toLowerCase()` 반복 계산 — ⏭️ 조치 불필요
**파일**: `app/(tabs)/index.tsx` (`filteredSongs` useMemo 내부)

확인 결과 검색어 전처리 `const q = searchQuery.trim().toLowerCase()`는 이미 필터 루프 **밖**에 있음(TODO의 "변경 후"와 실질 동일). 각 곡 `title/artist.toLowerCase()`는 항목별로 계산되지만, `searchQuery`/`songs` 변경 시에만 도는 `useMemo` 내부라 별도 최적화 이득이 사실상 없어 변경하지 않음.
