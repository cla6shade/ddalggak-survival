/**
 * 사용자 유입 규칙 — 한 시간에 몇 명이 늘거나 주는가.
 *
 * 유입은 기본값에 입소문이 얹혀 정해지고, 이슈 방치분이 그 위에서 깎습니다.
 * 방치분이 유입보다 크면 결과가 음수가 되어 사용자가 빠집니다.
 */
const BASE_PER_HOUR = 1.2
const VIRAL_PER_HOUR = 0.0002

/** 이 서비스가 최대로 먹을 수 있는 사용자 수. */
const MARKET_SIZE = 6_000

/** 시간당 사용자 증가율(명/시간). 음수일 수 있습니다. */
export function getUserGrowthPerHour(
  users: number,
  qualityMultiplier: number,
  neglectDeltaPerHour: number,
): number {
  // 남은 시장이 좁을수록 입소문이 덜 먹고, 다 차면 아예 멎습니다.
  const headroom = Math.max(0, 1 - users / MARKET_SIZE)
  const inflow = (BASE_PER_HOUR + users * VIRAL_PER_HOUR * headroom) * qualityMultiplier

  return inflow + neglectDeltaPerHour
}
