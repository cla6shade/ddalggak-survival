import { getCreditPurchaseAmount, getCreditPurchaseCost } from '../calc/creditPurchase'
import { getSuccessRateForDay } from '../calc/successRate'
import type { IssueOption } from './IssueOption'
import type { NeglectEffect, NeglectPressure } from './NeglectEffect'
import type { EndingId } from '../endings/Ending'
import type { Session } from '@/core/Session'

export type DomainCode = 'DEV' | 'MKT' | 'PRD' | 'OPS'

/** 딸깍으로 고친 개발 이슈가 그대로 구멍이 될 확률. */
const DDALGGAK_ACCIDENT_CHANCE = 0.05

/** 선택지를 누른 결과. 패널이 이걸 보고 다음 화면을 정합니다. */
export interface ResolveOutcome {
  /** 자원이 모자라 아예 누르지 못한 경우. 나머지 필드는 의미 없습니다. */
  blocked: boolean
  solved: boolean
  /** 실패해서 새 이슈가 딸려 나왔는지. */
  spawnedNew: boolean
  /** 아이디어를 뺏겼는지. */
  stolen: boolean
  /** 이 행동에 흐른 게임 시간(분). */
  minutes: number
  /** 해결했다면 오른 품질. */
  qualityGain: number
}

/**
 * 이슈 하나. 표가 아니라 클래스인 이유는 개별 이슈가 `resolve` 나 `onNeglect` 를
 * 덮어쓸 수 있어야 하기 때문입니다. 상속받는 쪽은 생성자에서 자기 수치만 넘깁니다.
 *
 * 세상을 만질 통로는 생성자로 받은 `session` 하나입니다. **값은 주입받고 타입만
 * `import type`** 으로 가져오므로, 컴파일 결과에는 `Session` 으로 가는 import 가
 * 남지 않습니다 — 카탈로그를 거쳐 도는 순환 참조가 성립할 수 없습니다.
 */
export class Issue {
  constructor(
    protected readonly session: Session,
    readonly code: string,
    readonly domain: DomainCode,
    readonly title: string,
    /** 1일차 첫 이슈 후보인지. */
    readonly initial: boolean,
    readonly neglect: NeglectEffect,
    readonly options: readonly IssueOption[],
  ) {}

  /** 오늘 이 선택지의 성공 확률. */
  getSuccessRate(option: IssueOption): number {
    return getSuccessRateForDay(option.success, option.kind, this.session.clock.day)
  }

  /**
   * 지금 이 선택지를 누를 수 있는지. 모자란 크레딧은 돈으로 환산해 함께 봅니다.
   * 체력은 보지 않습니다 — 음수로 내려가도 막지 않습니다.
   */
  isAffordable(option: IssueOption): boolean {
    const { player } = this.session
    const missingCredit = Math.max(0, option.creditCost - player.credit)
    const creditMoney = missingCredit > 0 ? getCreditPurchaseCost(missingCredit) : 0

    return player.money - option.moneyCost - creditMoney >= 0
  }

  /**
   * 선택지 하나를 실행합니다. 크레딧 사기 → 자원 차감 → 성공 판정 → 도난 판정 순입니다.
   *
   * `player` 만 제자리에서 고칩니다. 이슈를 열고 닫는 것과 시계를 미는 것은
   * `ResolveOutcome` 을 받은 쪽이 합니다.
   */
  resolve(option: IssueOption): ResolveOutcome {
    const { player, rng } = this.session
    const miss: ResolveOutcome = {
      blocked: true,
      solved: false,
      spawnedNew: false,
      stolen: false,
      minutes: 0,
      qualityGain: 0,
    }
    if (!this.isAffordable(option)) return miss

    // 크레딧이 모자라면 사서 씁니다. 낱개로는 못 사서 묶음만큼 남습니다.
    const missingCredit = Math.max(0, option.creditCost - player.credit)
    if (missingCredit > 0) {
      player.money -= getCreditPurchaseCost(missingCredit)
      player.credit += getCreditPurchaseAmount(missingCredit)
    }

    player.stamina -= option.staminaCost
    player.money -= option.moneyCost
    player.credit -= option.creditCost

    const solved = rng.rollChance(this.getSuccessRate(option))
    const spawnedNew = !solved && option.spawnChance > 0 && rng.rollChance(option.spawnChance)
    // 도난은 성공 판정과 독립으로 굴립니다.
    const stolen = option.theftChance > 0 && rng.rollChance(option.theftChance)

    return {
      blocked: false,
      solved,
      spawnedNew,
      stolen,
      minutes: option.minutes,
      qualityGain: solved ? option.qualityGain : 0,
    }
  }

  /**
   * 이 선택의 결과로 바로 이어지는 엔딩. 없으면 `null` 입니다.
   *
   * 도난과 딸깍 사고는 이슈를 가리지 않으므로 여기서 굴리고, 그 뒤에 선택지가
   * 들고 있는 실패 엔딩을 앞에서부터 굴립니다. 이슈 코드로 갈라야 할 것이 남으면
   * `onNeglect` 처럼 하위 클래스가 이 메서드를 덮어씁니다.
   *
   * 도난 확률은 `resolve` 가 이미 굴렸으므로 여기서 다시 굴리지 않습니다.
   */
  rollChoiceEnding(option: IssueOption, outcome: ResolveOutcome): EndingId | null {
    const { rng } = this.session
    if (outcome.stolen) return 'idea-stolen'

    if (
      outcome.solved &&
      this.domain === 'DEV' &&
      option.kind === 'ddalggak' &&
      rng.rollChance(DDALGGAK_ACCIDENT_CHANCE)
    ) {
      return 'hacked'
    }

    if (!outcome.solved) {
      for (const { id, chance } of option.failureEndings) {
        if (rng.rollChance(chance)) return id
      }
    }

    return null
  }

  /**
   * 자기 몫을 `pressure` 에 더합니다. 즉발 효과가 필요한 이슈는 이걸 덮어씁니다.
   *
   * `minutes` 는 분이고 `NeglectEffect` 의 축은 시간당입니다 — 재정의할 때
   * 단위를 섞으면 조용히 어긋납니다.
   */
  onNeglect(_minutes: number, pressure: NeglectPressure): void {
    pressure.userDeltaPerHour += this.neglect.userDeltaPerHour
    pressure.qualityDeltaPerHour += this.neglect.qualityDeltaPerHour
    pressure.revenueMultiplier *= this.neglect.revenueMultiplier
    pressure.serverCostMultiplier *= this.neglect.serverCostMultiplier
    pressure.staminaRecoveryPenalty += this.neglect.staminaRecoveryPenalty
  }

  /** `neglect` 를 화면에 쓸 한 줄로. 0 인 축은 건너뜁니다. */
  getNeglectText(): string {
    const parts: string[] = []
    if (this.neglect.userDeltaPerHour !== 0) {
      parts.push(`사용자 ${this.neglect.userDeltaPerHour.toFixed(1)}명/h`)
    }
    if (this.neglect.qualityDeltaPerHour !== 0) {
      parts.push(`품질 ${this.neglect.qualityDeltaPerHour.toFixed(2)}/h`)
    }
    if (this.neglect.revenueMultiplier === 0) parts.push('매출 0')
    if (this.neglect.serverCostMultiplier === 0) parts.push('서버비 0')
    if (this.neglect.staminaRecoveryPenalty > 0) {
      parts.push(`수면 회복 −${this.neglect.staminaRecoveryPenalty}`)
    }

    return parts.length > 0 ? parts.join(' · ') : '변화 없음'
  }
}
