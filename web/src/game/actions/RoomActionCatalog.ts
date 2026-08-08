import { HomeMeal } from './rooms/HomeMeal'
import { PartTimeJob } from './rooms/PartTimeJob'
import { Sleep } from './rooms/Sleep'
import { StepOutside } from './rooms/StepOutside'
import type { RoomActionMenu } from './RoomAction'
import type { Session } from '@/core/Session'

/*
 * 방 물건마다 내놓는 것들. 수치는 전부 각 행동 클래스의 생성자에 있습니다.
 *
 * 회복 효율 서열: 밥 28/시간(유료) > 자기 6/시간 > 쉬다 오기 5.3/시간.
 * 이 순서가 뒤집히면 아무도 고르지 않는 선택지가 생깁니다.
 *
 * 무한 고리 주의 — 밥의 「원/체력」(6,000÷14 = 429) 이 알바의 「원/체력」
 * (36,000÷26 = 1,385) 보다 작아서 `밥 → 알바 → 밥` 이 이론상 수익 고리입니다.
 * 지금은 한 바퀴 553분에 +21,400원(≈2,300원/게임시간) 이라 앱 후반 수익보다 낮아
 * "할 수는 있지만 손해" 로 눌러 둔 상태입니다. 임금을 올리거나 밥값을 내리면
 * 이 마개가 풀립니다 — 그때는 「하루 한 번」 같은 구조적 제한이 필요합니다.
 */

/**
 * 방 물건들이 펼치는 목록 한 벌. 행동이 세션을 생성자로 받으므로 모듈 상수가 될 수
 * 없어, 세션이 자기 것으로 하나 들고 물건들이 그걸 가리킵니다.
 */
export class RoomActionMenus {
  readonly door: RoomActionMenu
  readonly refrigerator: RoomActionMenu
  /** 힌트에 기상 시각을 넣지 않는 이유: 시트가 열린 채로 시간이 흘러 낡습니다. */
  readonly bed: RoomActionMenu

  constructor(session: Session) {
    this.door = {
      title: '문',
      hint: '나가서 무엇을 하시겠습니까',
      actions: [new PartTimeJob(session), new StepOutside(session)],
    }
    this.refrigerator = {
      title: '냉장고',
      hint: '남은 것: 계란 두 개, 라면',
      actions: [new HomeMeal(session)],
    }
    this.bed = {
      title: '침대',
      hint: '8시간 뒤에 일어납니다',
      actions: [new Sleep(session)],
    }
  }
}
