import { UiElement } from '../UiElement'
import { HudTool } from '../tiles/HudTool'
import type { IconSheet } from '@/assets/IconSheet'
import type { IssueManager } from '@/game/IssueManager'

/**
 * 화면 아래 한가운데에 앉는 이슈 버튼.
 *
 * 계기판과 떨어져 사는 이유는 자리입니다 — 읽는 것은 위, 누르는 것은 엄지가 닿는
 * 아래. 그래서 `#interface` 의 아래 칸에 따로 붙습니다.
 *
 * 아이콘을 아틀라스에서 잘라 쓰므로 **에셋을 불러온 뒤에** 만들어야 합니다.
 */
export class IssueButton extends UiElement {
  private readonly tool: HudTool

  /** `onOpen` 은 눌렀을 때. 무엇을 열지는 세션이 정합니다. */
  constructor(icons: IconSheet, onOpen: () => void) {
    super('div', 'fab')
    this.tool = new HudTool(icons, 'hud_issue', '이슈', onOpen)
    this.append(this.tool)
  }

  setIssues(issues: IssueManager): void {
    const count = issues.count
    this.tool.setEnabled(count > 0)
    this.tool.setCount(count)
  }

  /** 한 번 튕깁니다. 숫자만 조용히 올라가면 못 보고 지나갑니다. */
  ping(): void {
    this.tool.ping()
  }
}
