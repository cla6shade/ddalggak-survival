import { Ending } from '../Ending'
import type { EndingContext } from '../Ending'

/** 돈이 바닥나 더 이상 서비스를 운영할 수 없습니다. */
export class BankruptEnding extends Ending {
  constructor() {
    super('bankrupt', 100)
  }

  override matches(context: EndingContext): boolean {
    return context.player.money <= 0
  }
}
