import { Issue } from '../Issue'
import { createDdalggakOption, createDirectOption, createGambleOption } from '../IssueOption'
import { createNeglectEffect } from '../NeglectEffect'

export class NoSeo extends Issue {
  constructor() {
    super(
      'ISSUE-MRK-001',
      'MKT',
      'SEO 최적화가 되어있지 않습니다.',
      true,
      createNeglectEffect({ userDeltaPerHour: -0.9, qualityDeltaPerHour: -0.05 }),
      [
        createDirectOption('서비스 제목과 설명에 키워드를 많이 넣는다', 0.2, 9),
        createDirectOption('검색엔진 등록과 기본 SEO를 설정한다', 0.7, 34),
        createDirectOption('SEO 진단 서비스를 구매한다', 0.6, 14, 20_000),
        createDdalggakOption(0.7, 0.3),
        createGambleOption('유명 서비스 이름을 몰래 끼워 넣는다'),
      ],
    )
  }
}
