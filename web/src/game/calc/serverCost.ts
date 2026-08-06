/** 서버비 규칙 — 사용자 수에서 시간당 나가는 돈을 냅니다. */
const FIXED_PER_HOUR = 28
const PER_USER_HOUR = 1

/** 시간당 서버비(원/시간, 양수). `neglectMultiplier` 가 0 이면 서버비도 안 나갑니다. */
export function getServerCostPerHour(users: number, neglectMultiplier: number): number {
  return (FIXED_PER_HOUR + users * PER_USER_HOUR) * neglectMultiplier
}
