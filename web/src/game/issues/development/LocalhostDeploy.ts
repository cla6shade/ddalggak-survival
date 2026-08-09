import { Issue } from '../Issue'
import { createDdalggakOption, createDirectOption, createGambleOption } from '../IssueOption'
import { createNeglectEffect } from '../NeglectEffect'
import type { Session } from '@/core/Session'

export class LocalhostDeploy extends Issue {
  constructor(session: Session) {
    super(
      session,
      'ISSUE-DEV-001',
      'DEV',
      '로컬호스트로 배포했습니다.',
      '서비스가 대표님의 컴퓨터 안에서만 실행되고 있습니다. 아무도 이 서비스에 접속할 수 없습니다. 클라우드에 배포해야 합니다.',
      true,
      createNeglectEffect({
        userDeltaPerHour: -4,
        qualityDeltaPerHour: -0.15,
        revenueMultiplier: 0,
        serverCostMultiplier: 0,
      }),
      [
        createDirectOption('일단 무료배포 버튼을 눌러본다', 0.25, 24),
        createDirectOption('공식 가이드를 보며 배포 설정을 확인한다', 0.7, 58),
        createDirectOption('친한 개발자에게 배포를 부탁한다', 0.65, 15, 20_000, 0.12),
        createDdalggakOption(0.7),
        createGambleOption('설정 파일을 아무렇게나 고쳐서 다시 올려본다', [
          { id: 'data-loss', chance: 0.2 },
        ]),
      ],
    )
  }
}
