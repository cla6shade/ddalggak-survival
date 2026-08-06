import { Issue } from '../Issue'
import { createDdalggakOption, createDirectOption, createGambleOption } from '../IssueOption'
import { createNeglectEffect } from '../NeglectEffect'

export class RoughVisuals extends Issue {
  constructor() {
    super(
      'ISSUE-PRD-003',
      'PRD',
      '서비스의 시각적 완성도가 낮습니다',
      false,
      createNeglectEffect({ userDeltaPerHour: -0.8, qualityDeltaPerHour: -0.2 }),
      [
        createDirectOption('색상과 폰트를 하나로 통일한다', 0.4, 17),
        createDirectOption('마음에 드는 서비스를 참고해 다시 디자인한다', 0.55, 34),
        createDirectOption('UI 템플릿을 구매해 적용한다', 0.6, 9, 20_000),
        createDdalggakOption(0.6, 0.55),
        createGambleOption('색을 무작위로 바꿔가며 마음에 들 때까지 눌러본다'),
      ],
    )
  }
}
