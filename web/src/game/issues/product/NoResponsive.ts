import { Issue } from '../Issue'
import { createDdalggakOption, createDirectOption, createGambleOption } from '../IssueOption'
import { createNeglectEffect } from '../NeglectEffect'

export class NoResponsive extends Issue {
  constructor() {
    super(
      'ISSUE-PRD-001',
      'PRD',
      '반응형 디자인이 적용되지 않았습니다',
      true,
      createNeglectEffect({ userDeltaPerHour: -1.6, qualityDeltaPerHour: -0.25 }),
      [
        createDirectOption('잘리는 부분의 너비만 줄인다', 0.25, 9),
        createDirectOption('실제 모바일 화면을 하나씩 확인하며 수정한다', 0.65, 34),
        createDirectOption('반응형 UI 템플릿으로 교체한다', 0.7, 14, 20_000),
        createDdalggakOption(0.7, 0.3),
        createGambleOption('화면 배율을 강제로 고정해본다'),
      ],
    )
  }
}
