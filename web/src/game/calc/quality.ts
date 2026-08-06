/**
 * 품질 규칙 — 품질이 시간에 따라 어떻게 움직이고, 유입과 매출 단가에 어떤 배수를 거는가.
 *
 * 배수 둘은 `advanceEconomy` 안의 이름 없는 지역변수였습니다. 사용자와 돈 양쪽을
 * 동시에 흔드는 값이라 이름을 주고 여기로 내놓습니다.
 */

/** 품질의 상한. 아래는 0 입니다. */
export const MAX_QUALITY = 100

const INFLOW_MULTIPLIER_BASE = 0.4
const INFLOW_MULTIPLIER_PER_POINT = 0.012
const REVENUE_MULTIPLIER_BASE = 0.5
const REVENUE_MULTIPLIER_PER_POINT = 0.01

/** 시간당 변화량으로 `hours` 만큼 움직인 뒤의 품질. `0`~`MAX_QUALITY` 로 잘립니다. */
export function getQualityAfter(quality: number, deltaPerHour: number, hours: number): number {
  return Math.min(MAX_QUALITY, Math.max(0, quality + deltaPerHour * hours))
}

/** 이 품질이 사용자 유입에 거는 배수. */
export function getQualityInflowMultiplier(quality: number): number {
  return INFLOW_MULTIPLIER_BASE + INFLOW_MULTIPLIER_PER_POINT * quality
}

/** 이 품질이 매출 단가에 거는 배수. */
export function getQualityRevenueMultiplier(quality: number): number {
  return REVENUE_MULTIPLIER_BASE + REVENUE_MULTIPLIER_PER_POINT * quality
}
