import { Policy } from '../Policy'
import { PlayerView } from '../PlayerView'
import type { Decision, OptionView } from '../PlayerView'
import type { Rng } from '@/game/Rng'

/**
 * 사람이 실제로 할 법한 플레이.
 *
 * 순서가 곧 우선순위입니다 — 쓰러지지 않기, 파산하지 않기, 그 다음에 이슈.
 * 「도박」 배지가 붙은 줄은 성공률이 5% 라 아예 보지 않습니다. 엔딩으로 이어지는
 * 확률은 화면에 안 뜨므로 이 정책도 그걸 모르고, 그저 성공률만 보고 피하는 것입니다.
 */
export class SurvivalPolicy extends Policy {
  readonly name = 'survival'

  constructor(
    rng: Rng,
    /** 이 아래로 떨어지면 만사 제치고 눕습니다. */
    private readonly sleepBelow = 30,
    /** 이 아래로 떨어지면 벌러 나갑니다. */
    private readonly workBelow = 80_000,
    /** 이 아래면 틈나는 대로 먹습니다. */
    private readonly mealBelow = 70,
  ) {
    super(rng)
  }

  override get params(): Record<string, number> {
    return { sleepBelow: this.sleepBelow, workBelow: this.workBelow, mealBelow: this.mealBelow }
  }

  decide(view: PlayerView): Decision {
    const rest = view.deepestRest
    if (view.stamina <= this.sleepBelow && rest) return rest.decision

    // 벌러 나가는 값으로 쓰러지면 안 됩니다 — 체력은 0 이하가 되는 순간 번아웃입니다.
    const earning = view.bestEarning
    if (view.money < this.workBelow && earning && view.stamina + earning.staminaGain > 0) {
      return earning.decision
    }

    const snack = view.quickestRest
    if (view.stamina < this.mealBelow && snack) return snack.decision

    const option = this.pickOption(view)
    if (option) return option.decision

    // 할 일이 없으면 눕습니다. 그냥 서서 기다리는 것보다 체력이 남습니다.
    if (rest && view.stamina < view.maxStamina) return rest.decision

    return PlayerView.WAIT
  }

  /** 시간당 성공 기대치가 가장 높은 줄. 체력이 감당 안 되는 줄은 거릅니다. */
  private pickOption(view: PlayerView): OptionView | null {
    let best: OptionView | null = null

    for (const option of view.affordableOptions) {
      if (option.kind === 'gamble') continue
      if (option.staminaCost >= view.stamina) continue
      if (!best || option.successPerHour > best.successPerHour) best = option
    }

    return best
  }
}
