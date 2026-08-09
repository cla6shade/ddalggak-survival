import { Issue } from '../Issue'
import { createDdalggakOption, createDirectOption, createGambleOption } from '../IssueOption'
import { createNeglectEffect } from '../NeglectEffect'
import type { Session } from '@/core/Session'

export class SlowResponse extends Issue {
  constructor(session: Session) {
    super(
      session,
      'ISSUE-DEV-002',
      'DEV',
      '서비스 응답 속도가 지나치게 느립니다',
      '화면을 열거나 기능을 실행할 때 오랜 시간이 걸립니다. 사용자는 서비스가 고장 났다고 생각하거나 기다리지 못하고 이탈할 수 있습니다.',
      false,
      createNeglectEffect({ userDeltaPerHour: -1.2, qualityDeltaPerHour: -0.2 }),
      [
        createDirectOption('용량이 큰 이미지를 압축한다', 0.2, 15),
        createDirectOption('불필요한 애니메이션을 제거한다', 0.3, 44),
        createDirectOption('성능 진단 도구를 사용한다', 0.65, 29, 15_000),
        createDdalggakOption(0.6),
        createGambleOption('제일 무거워 보이는 코드를 지워본다', [
          { id: 'data-loss', chance: 0.35 },
        ]),
      ],
    )
  }
}
