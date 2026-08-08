import { Policy } from '../Policy'
import { PlayerView } from '../PlayerView'
import type { Decision, OptionView } from '../PlayerView'

/**
 * 할 수 있으면 무조건 딸깍합니다.
 *
 * 딸깍은 10분에 체력 1 로 끝나는 대신 크레딧을 15 씩 먹고, 모자란 크레딧은 돈으로
 * 사서 채웁니다. 그래서 이 정책은 잔고가 먼저 마릅니다 — 그 속도를 재는 것이 목적입니다.
 * 쓰러지거나 파산하기 직전에만 눕고 벌러 나갑니다.
 */
export class DdalggakPolicy extends Policy {
  readonly name = 'ddalggak'

  readonly sleepBelow = 20
  readonly workBelow = 30_000

  override get params(): Record<string, number> {
    return { sleepBelow: this.sleepBelow, workBelow: this.workBelow }
  }

  decide(view: PlayerView): Decision {
    const rest = view.deepestRest
    if (view.stamina <= this.sleepBelow && rest) return rest.decision

    const earning = view.bestEarning
    if (view.money < this.workBelow && earning && view.stamina + earning.staminaGain > 0) {
      return earning.decision
    }

    const clicked = this.pickDdalggak(view)
    if (clicked) return clicked.decision

    // 딸깍이 잠겼으면(크레딧 살 돈이 없음) 남은 줄 중 성공률이 가장 높은 것.
    const fallback = this.pickBestOdds(view)
    if (fallback) return fallback.decision

    if (rest && view.stamina < view.maxStamina) return rest.decision

    return PlayerView.WAIT
  }

  private pickDdalggak(view: PlayerView): OptionView | null {
    let best: OptionView | null = null

    for (const option of view.affordableOptions) {
      if (option.kind !== 'ddalggak') continue
      if (option.staminaCost >= view.stamina) continue
      if (!best || option.successRate > best.successRate) best = option
    }

    return best
  }

  private pickBestOdds(view: PlayerView): OptionView | null {
    let best: OptionView | null = null

    for (const option of view.affordableOptions) {
      if (option.kind === 'gamble') continue
      if (option.staminaCost >= view.stamina) continue
      if (!best || option.successRate > best.successRate) best = option
    }

    return best
  }
}
