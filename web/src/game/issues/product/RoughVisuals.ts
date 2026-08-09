import { Issue } from '../Issue'
import { createDdalggakOption, createDirectOption, createGambleOption } from '../IssueOption'
import { createNeglectEffect } from '../NeglectEffect'
import type { Session } from '@/core/Session'

export class RoughVisuals extends Issue {
  constructor(session: Session) {
    super(
      session,
      'ISSUE-PRD-003',
      'PRD',
      '서비스의 시각적 완성도가 낮습니다',
      '화면의 색상, 글자, 버튼과 카드 스타일이 서로 어울리지 않아 서비스가 미완성처럼 보입니다. 사용자가 서비스를 신뢰하지 못하거나 사용 방법을 직관적으로 이해하기 어려울 수 있습니다.',
      false,
      createNeglectEffect({ userDeltaPerHour: -0.8, qualityDeltaPerHour: -0.2 }),
      [
        createDirectOption('색상과 폰트를 하나로 통일한다', 0.4, 29),
        createDirectOption('마음에 드는 서비스를 참고해 다시 디자인한다', 0.55, 58),
        createDirectOption('UI 템플릿을 구매해 적용한다', 0.6, 15, 20_000),
        createDdalggakOption(0.6),
        createGambleOption('색을 무작위로 바꿔가며 마음에 들 때까지 눌러본다'),
      ],
    )
  }
}
