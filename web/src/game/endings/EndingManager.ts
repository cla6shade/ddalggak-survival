import { BankruptEnding } from './conditions/BankruptEnding'
import { BurnoutEnding } from './conditions/BurnoutEnding'
import { createEndingSnapshot } from './Ending'
import type { Ending, EndingContext, EndingResult } from './Ending'

/** 한 판의 엔딩 조건을 우선순위대로 판정하고, 첫 결과를 영구히 잠급니다. */
export class EndingManager {
  private readonly conditions: readonly Ending[]
  private result: EndingResult | null = null

  constructor(conditions: readonly Ending[] = [
    new BankruptEnding(),
    new BurnoutEnding(),
  ]) {
    this.conditions = [...conditions].sort((a, b) => b.priority - a.priority)
  }

  get current(): EndingResult | null {
    return this.result
  }

  evaluate(context: EndingContext): EndingResult | null {
    if (this.result) return this.result

    const matched = this.conditions.find((condition) => condition.matches(context))
    if (!matched) return null

    this.result = {
      id: matched.id,
      snapshot: createEndingSnapshot(context),
    }
    return this.result
  }
}
