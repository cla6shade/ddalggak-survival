/**
 * 선택지 성공 확률 규칙 — `IssueOption.success` 를 그 날 기준으로 환산합니다.
 *
 * 화면에 확률을 쓰는 쪽과 판정을 굴리는 쪽이 같은 함수를 봐야 표시된 숫자와
 * 실제 결과가 어긋나지 않습니다.
 */
const DDALGGAK_DECAY_PER_DAY = 0.022
const DDALGGAK_DECAY_FLOOR = 0.22

/** 그 날의 딸깍 성공 확률 배수. `DDALGGAK_DECAY_FLOOR` 아래로는 안 내려갑니다. */
export function getDdalggakDecayMultiplier(day: number): number {
  return Math.max(DDALGGAK_DECAY_FLOOR, 1 - DDALGGAK_DECAY_PER_DAY * (day - 1))
}

/** 그 날 이 선택지의 실제 성공 확률. `'ddalggak'` 만 날짜 배수를 곱합니다. */
export function getSuccessRateForDay(success: number, kind: string, day: number): number {
  return kind === 'ddalggak' ? success * getDdalggakDecayMultiplier(day) : success
}
