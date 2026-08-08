import { Issue } from '../Issue'
import { createDdalggakOption, createDirectOption, createGambleOption } from '../IssueOption'
import { createNeglectEffect } from '../NeglectEffect'
import { getChanceOver } from '../../endings/EndingEvents'
import { MINUTES_PER_HOUR } from '../../Clock'
import type { ResolveOutcome } from '../Issue'
import type { IssueOption } from '../IssueOption'
import type { NeglectPressure } from '../NeglectEffect'
import type { EndingId } from '../../endings/Ending'
import type { Session } from '@/core/Session'

/** 전화를 받지 않은 채로 한 시간을 보냈을 때 신고당할 확률. 하루를 꼬박 두면 52% 입니다. */
const REPORT_CHANCE_PER_HOUR = 0.03

/** 아예 안 받기로 골랐을 때 신고당할 확률. */
const REPORT_ON_IGNORE_CHANCE = 0.3

export class PhoneFlood extends Issue {
  constructor(session: Session) {
    super(
      session,
      'ISSUE-OPS-001',
      'OPS',
      '고객 문의가 전화로 몰리고 있습니다',
      false,
      createNeglectEffect({ userDeltaPerHour: -0.5, qualityDeltaPerHour: -0.12, staminaRecoveryPenalty: 12 }),
      [
        createDirectOption('걸려오는 전화를 직접 받는다', 0.3, 71),
        createDirectOption('자주 묻는 질문 페이지를 만든다', 0.5, 58),
        createDirectOption('전화 문의를 예약제로 전환한다', 0.55, 29, 10_000),
        createDdalggakOption(0.5, 0.55),
        createGambleOption('전화를 받지 않는다'),
      ],
    )
  }

  /**
   * 안 받기로 고른 순간 고객은 이미 기다린 뒤입니다 — 성공해도 굴립니다.
   * 그래서 `IssueOption.failureEndings` 로는 표현할 수 없어 여기서 덮어씁니다.
   */
  override rollChoiceEnding(option: IssueOption, outcome: ResolveOutcome): EndingId | null {
    const base = super.rollChoiceEnding(option, outcome)
    if (base) return base

    if (option.kind === 'gamble' && this.session.rng.rollChance(REPORT_ON_IGNORE_CHANCE)) {
      return 'consumer-report'
    }

    return null
  }

  /**
   * 기본 압력에 더해, 흐른 시간만큼 신고를 굴립니다.
   * `ExposedDatabase` 와 같은 규칙입니다 — 확률은 화면에 쓰지 않습니다.
   */
  override onNeglect(minutes: number, pressure: NeglectPressure): void {
    super.onNeglect(minutes, pressure)
    if (minutes <= 0) return

    const periods = minutes / MINUTES_PER_HOUR
    if (this.session.rng.rollChance(getChanceOver(REPORT_CHANCE_PER_HOUR, periods))) {
      this.session.triggerEnding('consumer-report')
    }
  }
}
