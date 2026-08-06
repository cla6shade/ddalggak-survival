/**
 * 크레딧 구매 규칙 — 모자란 크레딧을 돈으로 사는 환산.
 *
 * 낱개로는 못 사고 묶음 단위로만 삽니다. 그래서 "얼마 드는가" 와 "실제로 몇 개
 * 들어오는가" 가 다르고, 둘이 같은 올림을 써야 잔고와 크레딧이 어긋나지 않습니다.
 */
const PRICE = 1_000
const UNIT = 10

/** 모자란 `missing` 개를 채우려면 실제로 사게 되는 개수. `missing` 보다 많을 수 있습니다. */
export function getCreditPurchaseAmount(missing: number): number {
  return Math.ceil(missing / UNIT) * UNIT
}

/** 위 개수를 사는 데 드는 돈. */
export function getCreditPurchaseCost(missing: number): number {
  return getCreditPurchaseAmount(missing) * PRICE
}
