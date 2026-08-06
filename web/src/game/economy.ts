import { getQualityAfter, getQualityInflowMultiplier, getQualityRevenueMultiplier } from './calc/quality'
import { getUserGrowthPerHour } from './calc/userGrowth'
import { getRevenuePerHour } from './calc/revenue'
import { getServerCostPerHour } from './calc/serverCost'
import type { PlayerStatus } from './stats/PlayerStatus'
import type { ProductStatus } from './stats/ProductStatus'
import type { NeglectPressure } from './issues/NeglectEffect'

/**
 * 손을 대지 않아도 시간만 흐르면 저절로 움직이는 것들을 한자리에서 진행시킵니다.
 * 규칙 자체는 `calc/` 가 갖고 있고, 여기는 **순서와 상태 반영만** 합니다.
 *
 * 선택지를 눌러 즉시 바뀌는 값(체력·크레딧 차감, 해결 시 품질 상승)은 여기 없습니다.
 * 그쪽은 `Issue.resolve` 와 `Session.chooseOption` 이 직접 고칩니다.
 */

/**
 * 흐른 `minutes` 만큼 `product` 와 `player.money` 를 제자리에서 진행시킵니다.
 *
 * 아래 순서는 **결과를 바꾸므로** 함부로 바꾸면 안 됩니다 — 품질을 먼저 움직이고,
 * 그 품질로 유입과 매출을 재고, 그렇게 나온 사용자 수로 돈을 셉니다.
 */
export function advanceEconomy(
  minutes: number,
  product: ProductStatus,
  player: PlayerStatus,
  pressure: NeglectPressure,
): void {
  if (minutes <= 0) return
  const hours = minutes / 60

  product.quality = getQualityAfter(product.quality, pressure.qualityDeltaPerHour, hours)

  product.userGrowthPerHour = getUserGrowthPerHour(
    product.users,
    getQualityInflowMultiplier(product.quality),
    pressure.userDeltaPerHour,
  )
  product.users = Math.max(0, product.users + product.userGrowthPerHour * hours)

  product.revenuePerHour = getRevenuePerHour(
    product.users,
    getQualityRevenueMultiplier(product.quality),
    pressure.revenueMultiplier,
  )
  product.serverCostPerHour = getServerCostPerHour(product.users, pressure.serverCostMultiplier)

  const revenue = product.revenuePerHour * hours
  const serverCost = product.serverCostPerHour * hours
  player.money += revenue - serverCost
  product.revenue += revenue
  product.spend += serverCost
}
