import { Ending, EndingPresentation } from '../Ending'
import type { Session } from '@/core/Session'

/** 열어 둔 데이터베이스로 공격자가 들어왔습니다. 사건으로만 나므로 조건이 없습니다. */
export class HackedEnding extends Ending {
  constructor(session: Session) {
    super(
      session,
      'hacked',
      0,
      new EndingPresentation(
        '보안 사고',
        '서비스가 해킹당했습니다',
        'AI로 개발한 코드에 남은 보안 허점을 통해 공격자가 시스템에 침입했습니다.',
        'ending_hacked',
      ),
    )
  }
}
