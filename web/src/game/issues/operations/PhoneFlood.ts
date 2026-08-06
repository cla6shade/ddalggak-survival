import { Issue } from '../Issue'
import { createDdalggakOption, createDirectOption, createGambleOption } from '../IssueOption'
import { createNeglectEffect } from '../NeglectEffect'

export class PhoneFlood extends Issue {
  constructor() {
    super(
      'ISSUE-OPS-001',
      'OPS',
      '고객 문의가 전화로 몰리고 있습니다',
      false,
      createNeglectEffect({ userDeltaPerHour: -0.5, qualityDeltaPerHour: -0.12, staminaRecoveryPenalty: 12 }),
      [
        createDirectOption('걸려오는 전화를 직접 받는다', 0.3, 42),
        createDirectOption('자주 묻는 질문 페이지를 만든다', 0.5, 34),
        createDirectOption('전화 문의를 예약제로 전환한다', 0.55, 17, 10_000),
        createDdalggakOption(0.5, 0.55),
        createGambleOption('전화를 안 받고 버텨본다'),
      ],
    )
  }
}
