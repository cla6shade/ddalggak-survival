import { MAX_STAMINA } from '../stats/PlayerStatus'
import type { Session } from '@/core/Session'

/** 행동 하나를 실행한 결과. 이걸 받은 쪽이 시계를 밀고 계기판을 다시 그립니다. */
export interface ActionOutcome {
  /** 돈이 모자라 아예 하지 못한 경우. 나머지 필드는 의미 없습니다. */
  blocked: boolean
  /** 이 행동에 흐른 게임 시간(분). */
  minutes: number
  /** 실제로 오른 체력. 상한에 걸려 잘린 뒤의 값입니다. */
  staminaGain: number
  /** 실제로 오간 돈. 음수면 지출입니다. */
  moneyGain: number
}

/** 물건 하나가 내놓는 목록. 시트의 머리글과 줄들을 함께 담습니다. */
export interface RoomActionMenu {
  readonly title: string
  readonly hint: string
  readonly actions: readonly RoomAction[]
}

/**
 * 방 물건 앞에서 하는 행동 하나.
 *
 * 표가 아니라 클래스인 이유는 `자기` 처럼 회복량이 그때그때 달라지는 행동이
 * `getStaminaGain` 을 덮어써야 하기 때문입니다 — `Issue` 와 같은 이유입니다.
 * 상속받는 쪽은 생성자에서 자기 수치만 넘깁니다.
 */
export class RoomAction {
  constructor(
    protected readonly session: Session,
    readonly id: string,
    /** 줄 왼쪽 배지에 들어갈 두 글자. 외출 / 식사 / 취침. */
    readonly badge: string,
    readonly title: string,
    /** 이 행동에 걸리는 게임 시간(분). */
    readonly minutes: number,
    /** 양수면 회복. 상황을 보는 행동은 `getStaminaGain` 을 덮어씁니다. */
    readonly staminaGain: number,
    /** 양수면 수입. */
    readonly moneyGain: number,
  ) {}

  /** 이번에 회복할 체력. 자는 것처럼 상황을 보는 행동이 여기를 덮어씁니다. */
  getStaminaGain(): number {
    return this.staminaGain
  }

  /**
   * 줄에 적을 한 줄. 숫자를 약속할 수 없는 행동이 여기를 덮어씁니다.
   *
   * 체력은 `staminaGain` 이 아니라 `getStaminaGain()` 을 봅니다 — 자는 것처럼
   * 회복량을 그때그때 계산하는 행동도 적힌 값과 실제 값이 같아야 합니다.
   */
  getCostText(): string {
    const staminaGain = this.getStaminaGain()
    const parts = [formatHours(this.minutes)]
    if (staminaGain !== 0) parts.push(`체력 ${formatSigned(staminaGain)}`)
    if (this.moneyGain !== 0) parts.push(`${formatSignedMoney(this.moneyGain)}원`)

    return parts.join(' · ')
  }

  /**
   * 지금 이 행동을 할 수 있는지.
   * 체력은 보지 않습니다 — 음수로 내려가도 막지 않습니다(`Issue.isAffordable` 과 같은 규칙).
   */
  isAffordable(): boolean {
    return this.session.player.money + this.moneyGain >= 0
  }

  /**
   * 행동을 실행합니다. 체력을 먼저 올리고 돈을 옮깁니다.
   *
   * `player` 만 제자리에서 고칩니다 — 시계를 밀고 계기판을 다시 그리는 것은
   * `ActionOutcome` 을 받은 쪽이 합니다.
   */
  perform(): ActionOutcome {
    const { player } = this.session
    if (!this.isAffordable()) {
      return { blocked: true, minutes: 0, staminaGain: 0, moneyGain: 0 }
    }

    // 상한에 걸려 잘린 몫은 안 오른 것이므로, 실제로 오른 만큼만 결과에 싣습니다.
    const before = player.stamina
    player.stamina = Math.min(MAX_STAMINA, before + this.getStaminaGain())
    player.money += this.moneyGain

    return {
      blocked: false,
      minutes: this.minutes,
      staminaGain: player.stamina - before,
      moneyGain: this.moneyGain,
    }
  }
}

/** 실행 결과를 알림 줄에 쓸 한 줄로. 명목이 아니라 실제로 오간 값입니다. */
export function formatActionOutcome(outcome: ActionOutcome): string {
  const parts: string[] = []
  if (outcome.staminaGain !== 0) parts.push(`체력 ${formatSigned(outcome.staminaGain)}`)
  if (outcome.moneyGain !== 0) parts.push(`${formatSignedMoney(outcome.moneyGain)}원`)
  parts.push(formatHours(outcome.minutes))

  return parts.join(' · ')
}

/** 분을 시간으로. 소수 한 자리까지만 보이고 `.0` 은 떼어냅니다. */
function formatHours(minutes: number): string {
  return `${Math.round((minutes / 60) * 10) / 10}시간`
}

/** 부호를 늘 붙입니다 — `+8` 과 `8` 은 읽는 순간이 다릅니다. */
function formatSigned(value: number): string {
  return `${value > 0 ? '+' : '−'}${Math.abs(value)}`
}

function formatSignedMoney(value: number): string {
  return `${value > 0 ? '+' : '−'}${Math.abs(Math.round(value)).toLocaleString('ko-KR')}`
}
