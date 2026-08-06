import { Issue } from '../Issue'
import { createDdalggakOption, createDirectOption, createGambleOption } from '../IssueOption'
import { createNeglectEffect } from '../NeglectEffect'

export class TinyText extends Issue {
  constructor() {
    super(
      'ISSUE-PRD-002',
      'PRD',
      '본문 글자가 지나치게 작습니다',
      false,
      createNeglectEffect({ userDeltaPerHour: -0.8, qualityDeltaPerHour: -0.2 }),
      [
        createDirectOption('전체 글자 크기를 한꺼번에 키운다', 0.3, 9),
        createDirectOption('주요 화면을 하나씩 확인하며 조정한다', 0.7, 34),
        createDirectOption('UI 디자이너에게 검토를 부탁한다', 0.5, 14, 20_000, 0.05),
        createDdalggakOption(0.8, 0.55),
        createGambleOption('일단 메모장에 아무거나 쳐본다'),
      ],
    )
  }
}
