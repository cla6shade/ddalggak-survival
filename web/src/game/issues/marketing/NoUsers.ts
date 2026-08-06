import { Issue } from '../Issue'
import { createDdalggakOption, createDirectOption, createGambleOption } from '../IssueOption'
import { createNeglectEffect } from '../NeglectEffect'

export class NoUsers extends Issue {
  constructor() {
    super(
      'ISSUE-MKT-002',
      'MKT',
      '서비스에 사용자가 없습니다',
      false,
      createNeglectEffect({ userDeltaPerHour: -0.9, qualityDeltaPerHour: -0.05 }),
      [
        createDirectOption('친구들에게 서비스 링크를 보낸다', 0.2, 9),
        createDirectOption('관련 커뮤니티에 홍보 글을 올린다', 0.45, 34),
        createDirectOption('소액 광고를 집행한다', 0.55, 14, 20_000),
        createDdalggakOption(0.5, 0.55),
        createGambleOption('아무 커뮤니티에나 링크를 도배한다'),
      ],
    )
  }
}
