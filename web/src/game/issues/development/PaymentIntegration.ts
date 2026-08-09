import { Issue } from '../Issue'
import { createDdalggakOption, createDirectOption, createGambleOption } from '../IssueOption'
import { createNeglectEffect } from '../NeglectEffect'
import type { Session } from '@/core/Session'

export class PaymentIntegration extends Issue {
  constructor(session: Session) {
    super(
      session,
      'ISSUE-DEV-004',
      'DEV',
      '결제 모듈 연동에 실패했습니다',
      '사용자가 결제를 시도해도 결제가 완료되지 않거나 서비스에 결제 결과가 반영되지 않습니다. 현재 상태에서는 유료 사용자를 받을 수 없습니다.',
      false,
      createNeglectEffect({ qualityDeltaPerHour: -0.1, revenueMultiplier: 0 }),
      [
        createDirectOption('PG사 연동 문서를 처음부터 읽는다', 0.6, 58),
        createDirectOption('테스트 결제를 반복해본다', 0.3, 44),
        createDirectOption('PG사 고객센터에 문의한다', 0.4, 15, 10_000),
        createDdalggakOption(0.5),
        createGambleOption('결제 예제 코드를 그대로 붙여넣어본다', [
          { id: 'race-condition', chance: 0.8 },
        ]),
      ],
    )
  }
}
