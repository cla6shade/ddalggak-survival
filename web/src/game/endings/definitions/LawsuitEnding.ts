import { Ending, EndingPresentation } from '../Ending'
import type { Session } from '@/core/Session'

/** 다른 회사가 아이디어 도용 소송을 걸었습니다. 사건으로만 나므로 조건이 없습니다. */
export class LawsuitEnding extends Ending {
  constructor(session: Session) {
    super(
      session,
      'lawsuit',
      0,
      new EndingPresentation(
        '법적 분쟁',
        '아이디어 도용 소송을 당했습니다',
        '다른 회사가 자사의 아이디어와 동일하다며 소송을 제기해 운영을 계속할 수 없게 됐습니다.',
        'ending_lawsuit',
      ),
    )
  }
}
