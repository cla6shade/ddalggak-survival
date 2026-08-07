import { Ending } from '../Ending'
import type { EndingContext } from '../Ending'

/** 체력이 바닥나 대표가 더 이상 일을 계속할 수 없습니다. */
export class BurnoutEnding extends Ending {
  constructor() {
    super('burnout', 90)
  }

  override matches(context: EndingContext): boolean {
    return context.player.stamina <= 0
  }
}
