import { Issue } from '../Issue'
import { createDdalggakOption, createDirectOption, createGambleOption } from '../IssueOption'
import { createNeglectEffect } from '../NeglectEffect'

export class AppCrash extends Issue {
  constructor() {
    super(
      'ISSUE-DEV-003',
      'DEV',
      '애플리케이션이 실행되지 않습니다',
      false,
      createNeglectEffect({ userDeltaPerHour: -3, qualityDeltaPerHour: -0.3, revenueMultiplier: 0 }),
      [
        createDirectOption('새로고침하고 다시 배포한다', 0.15, 9),
        createDirectOption('오류 로그를 직접 확인한다', 0.65, 34),
        createDirectOption('정상 작동했던 이전 버전으로 되돌린다', 0.85, 17),
        createDdalggakOption(0.6, 0.55),
        createGambleOption('에러 메시지를 검색해 첫 번째 답변을 붙여넣는다'),
      ],
    )
  }
}
