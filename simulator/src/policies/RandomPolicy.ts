import { Policy } from '../Policy'
import type { Decision, PlayerView } from '../PlayerView'

/**
 * 지금 누를 수 있는 것 중 하나를 균등 확률로 고릅니다.
 *
 * 이길 생각이 없는 기준선입니다 — 다른 정책이 이것보다 나은지로 실력을 잽니다.
 */
export class RandomPolicy extends Policy {
  readonly name = 'random'

  decide(view: PlayerView): Decision {
    return this.rng.pickOne(view.decisions)
  }
}
