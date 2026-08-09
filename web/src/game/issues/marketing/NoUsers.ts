import { Issue } from '../Issue'
import { createDdalggakOption, createDirectOption, createGambleOption } from '../IssueOption'
import { createNeglectEffect } from '../NeglectEffect'
import type { Session } from '@/core/Session'

export class NoUsers extends Issue {
  constructor(session: Session) {
    super(
      session,
      'ISSUE-MKT-002',
      'MKT',
      '서비스에 사용자가 없습니다',
      '서비스를 배포했지만 아직 방문한 사용자가 없습니다. 사용자가 없으면 피드백도 매출도 발생하지 않습니다. 서비스를 이용할 가능성이 있는 사람들에게 알려야 합니다.',
      false,
      createNeglectEffect({ userDeltaPerHour: -0.9, qualityDeltaPerHour: -0.05 }),
      [
        createDirectOption('친구들에게 서비스 링크를 보낸다', 0.2, 15),
        createDirectOption('관련 커뮤니티에 홍보 글을 올린다', 0.45, 58, 0, 0.12),
        createDirectOption('소액 광고를 집행한다', 0.55, 24, 20_000),
        createDdalggakOption(0.5),
        createGambleOption('아무 커뮤니티에나 링크를 도배한다', [
          { id: 'reputation', chance: 0.45 },
        ]),
      ],
    )
  }
}
