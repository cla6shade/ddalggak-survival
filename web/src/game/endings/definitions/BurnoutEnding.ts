import { Ending, EndingPresentation } from '../Ending'
import type { Session } from '@/core/Session'

/** 체력이 바닥나 대표가 더 이상 일을 계속할 수 없습니다. */
export class BurnoutEnding extends Ending {
  constructor(session: Session) {
    super(
      session,
      'burnout',
      90,
      new EndingPresentation(
        '운영 종료',
        '번아웃이 왔습니다',
        '체력이 바닥났습니다. 대표가 쓰러지면서 서비스 운영도 함께 멈췄습니다.',
        'ending_burnout',
      ),
    )
  }

  override matches(): boolean {
    return this.session.player.stamina <= 0
  }
}
