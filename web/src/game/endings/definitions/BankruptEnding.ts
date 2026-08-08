import { Ending, EndingPresentation } from '../Ending'
import type { Session } from '@/core/Session'

/** 돈이 바닥나 더 이상 서비스를 운영할 수 없습니다. */
export class BankruptEnding extends Ending {
  constructor(session: Session) {
    super(
      session,
      'bankrupt',
      100,
      new EndingPresentation(
        '운영 종료',
        '파산했습니다',
        '잔고가 바닥났습니다. 서버비도, 다음 시도도 더는 감당할 수 없습니다.',
        'ending_bankrupt',
      ),
    )
  }

  override matches(): boolean {
    return this.session.player.money <= 0
  }
}
