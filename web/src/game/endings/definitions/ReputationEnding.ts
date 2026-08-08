import { Ending, EndingPresentation } from '../Ending'
import type { Session } from '@/core/Session'

/** 아무 데나 뿌린 링크가 스팸으로 남았습니다. 사건으로만 나므로 조건이 없습니다. */
export class ReputationEnding extends Ending {
  constructor(session: Session) {
    super(
      session,
      'reputation',
      0,
      new EndingPresentation(
        '평판 추락',
        '스팸으로 낙인찍혔습니다',
        '가는 곳마다 차단당했습니다. 서비스 이름은 이제 홍보가 아니라 경고로 오르내립니다.',
        'ending_reputation',
      ),
    )
  }
}
