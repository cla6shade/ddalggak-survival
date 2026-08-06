/** 이슈를 손대지 않고 뒀을 때 벌어지는 일. 생성자로 받아 그대로 들고 있습니다. */
export interface NeglectEffect {
  /** 시간당 사용자 증가율에 더해지는 값(명/시간). 음수면 사용자가 빠집니다. */
  userDeltaPerHour: number
  /** 시간당 품질 변화(점/시간). */
  qualityDeltaPerHour: number
  /** 매출 배수. 0 이면 돈을 못 받습니다. */
  revenueMultiplier: number
  /** 서버비 배수. 배포가 안 됐으면 서버비도 안 나갑니다. */
  serverCostMultiplier: number
  /** 취침 시 체력 회복 감소량. */
  staminaRecoveryPenalty: number
}

/**
 * 열린 이슈들이 이번 틱에 만들어낸 압력의 합. 이슈마다 자기 몫을 여기 더하고,
 * 경제 계산은 그 합으로 한 번만 돕니다. 더하는 축이 `NeglectEffect` 와 같아
 * 정의를 나누지 않습니다 — 두 벌로 두면 축을 하나 늘릴 때 한쪽만 고치게 됩니다.
 */
export type NeglectPressure = NeglectEffect

/** 방치 효과를 만들 때 안 적은 항목은 "아무 일도 없음" 입니다. */
export function createNeglectEffect(partial: Partial<NeglectEffect>): NeglectEffect {
  return {
    userDeltaPerHour: 0,
    qualityDeltaPerHour: 0,
    revenueMultiplier: 1,
    serverCostMultiplier: 1,
    staminaRecoveryPenalty: 0,
    ...partial,
  }
}

/** 아무 이슈도 열려 있지 않을 때의 압력 — 곱셈 축은 1, 덧셈 축은 0 인 항등원입니다. */
export function createEmptyPressure(): NeglectPressure {
  return createNeglectEffect({})
}
