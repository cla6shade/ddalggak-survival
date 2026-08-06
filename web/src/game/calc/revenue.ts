/** 매출 규칙 — 사용자 수에서 시간당 들어오는 돈을 냅니다. */
const PER_USER_HOUR = 3

/** 시간당 매출(원/시간). `neglectMultiplier` 가 0 이면 한 푼도 안 들어옵니다. */
export function getRevenuePerHour(
  users: number,
  qualityMultiplier: number,
  neglectMultiplier: number,
): number {
  return users * PER_USER_HOUR * qualityMultiplier * neglectMultiplier
}
