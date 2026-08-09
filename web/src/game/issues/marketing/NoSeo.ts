import { Issue } from '../Issue'
import { createDdalggakOption, createDirectOption, createGambleOption } from '../IssueOption'
import { createNeglectEffect } from '../NeglectEffect'
import type { Session } from '@/core/Session'

export class NoSeo extends Issue {
  constructor(session: Session) {
    super(
      session,
      'ISSUE-MRK-001',
      'MKT',
      'SEO 최적화가 되어있지 않습니다.',
      '서비스가 검색 결과에 나타나지 않습니다. 서비스의 존재를 아는 사람만 직접 주소를 입력해 방문할 수 있습니다.',
      true,
      createNeglectEffect({ userDeltaPerHour: -0.9, qualityDeltaPerHour: -0.05 }),
      [
        createDirectOption('서비스 제목과 설명에 키워드를 많이 넣는다', 0.2, 15),
        createDirectOption('검색엔진 등록과 기본 SEO를 설정한다', 0.7, 58),
        createDirectOption('SEO 진단 서비스를 구매한다', 0.6, 24, 100_000),
        createDdalggakOption(0.7),
        createGambleOption('유명 서비스 이름을 몰래 끼워 넣는다', [
          { id: 'search-ban', chance: 0.8 },
        ]),
      ],
    )
  }
}
