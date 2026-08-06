import { Issue } from '../Issue'
import { createDdalggakOption, createDirectOption, createGambleOption } from '../IssueOption'
import { createNeglectEffect } from '../NeglectEffect'

export class SlowResponse extends Issue {
  constructor() {
    super(
      'ISSUE-DEV-002',
      'DEV',
      '서비스 응답 속도가 지나치게 느립니다',
      false,
      createNeglectEffect({ userDeltaPerHour: -1.2, qualityDeltaPerHour: -0.2 }),
      [
        createDirectOption('용량이 큰 이미지를 압축한다', 0.2, 9),
        createDirectOption('불필요한 애니메이션을 제거한다', 0.3, 26),
        createDirectOption('성능 진단 도구를 사용한다', 0.65, 17, 15_000),
        createDdalggakOption(0.6, 0.55),
        createGambleOption('제일 무거워 보이는 코드를 지워본다'),
      ],
    )
  }
}
