import { Ending, EndingPresentation } from '../Ending'
import type { Session } from '@/core/Session'

/** 붙여넣은 결제 코드에 락이 없었습니다. 사건으로만 나므로 조건이 없습니다. */
export class RaceConditionEnding extends Ending {
  constructor(session: Session) {
    super(
      session,
      'race-condition',
      0,
      new EndingPresentation(
        '결제 사고',
        '결제가 중복으로 처리됐습니다',
        '동시에 들어온 요청을 막을 락이 없었습니다. 한 번 누른 결제가 여러 번 빠져나갔습니다.',
        'ending_race_condition',
      ),
    )
  }
}
