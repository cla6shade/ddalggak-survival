/** 선택지의 종류. 성공률 감쇠와 화면 클래스가 이 값으로 갈립니다. */
export type OptionKind = 'direct' | 'ddalggak' | 'gamble'

/** 이슈 하나에 붙는 대응책. */
export interface IssueOption {
  title: string
  kind: OptionKind
  /** 날짜 배수를 곱하기 전의 기준 성공 확률. */
  success: number
  staminaCost: number
  moneyCost: number
  creditCost: number
  /** 이 선택지에 걸리는 게임 시간(분). */
  minutes: number
  /** 실패했을 때 새 이슈가 딸려 나올 확률. */
  spawnChance: number
  /** 누를 때마다 아이디어를 뺏길 확률. 성공 판정과 별개로 굴립니다. */
  theftChance: number
  /** 해결했을 때 오르는 품질. */
  qualityGain: number
}

/** `'ddalggak'` 선택지. 이슈마다 다른 두 값만 받고 나머지는 고정입니다. */
export function createDdalggakOption(success: number, spawnChance: number): IssueOption {
  return {
    title: '딸깍',
    kind: 'ddalggak',
    success,
    staminaCost: 3,
    moneyCost: 0,
    creditCost: 10,
    minutes: 10,
    spawnChance,
    theftChance: 0,
    qualityGain: 3,
  }
}

/** `'gamble'` 선택지. 제목 말고는 전부 고정입니다. */
export function createGambleOption(title: string): IssueOption {
  return {
    title,
    kind: 'gamble',
    success: 0.05,
    staminaCost: 4,
    moneyCost: 0,
    creditCost: 0,
    minutes: 15,
    spawnChance: 0,
    theftChance: 0,
    qualityGain: 3,
  }
}

/** `'direct'` 선택지. 걸리는 시간은 `staminaCost` 에서 계산합니다. */
export function createDirectOption(
  title: string,
  success: number,
  staminaCost: number,
  moneyCost = 0,
  theftChance = 0,
): IssueOption {
  return {
    title,
    kind: 'direct',
    success,
    staminaCost,
    moneyCost,
    creditCost: 0,
    minutes: Math.max(15, staminaCost * 6),
    spawnChance: 0,
    theftChance,
    qualityGain: 6,
  }
}
