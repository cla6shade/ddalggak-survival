import { MINUTES_PER_DAY } from '../Clock'
import type { Rng } from '../Rng'

/** 하루를 온전히 보냈을 때 소송이 발생할 확률. */
const LAWSUIT_CHANCE_PER_DAY = 0.01

/** 흐른 게임 시간만큼 하루 1% 확률을 환산해 소송 엔딩을 판정합니다. */
export function rollsLawsuit(minutes: number, rng: Rng): boolean {
  if (minutes <= 0) return false

  return rng.rollChance(getChanceOver(LAWSUIT_CHANCE_PER_DAY, minutes / MINUTES_PER_DAY))
}

/**
 * 단위 기간 확률 `chance` 를 `periods` 기간만큼 늘립니다.
 *
 * 짧은 틱을 여러 번 도는 것과 긴 틱을 한 번 도는 것의 결과가 같아야 합니다 —
 * 단순히 곱하면 틱 길이에 따라 체감 난이도가 달라집니다.
 */
export function getChanceOver(chance: number, periods: number): number {
  return 1 - (1 - chance) ** periods
}
