import { Ending, EndingPresentation } from '../Ending'
import type { Session } from '@/core/Session'

/** 도움을 청한 사람이 아이디어를 가져갔습니다. 사건으로만 나므로 조건이 없습니다. */
export class IdeaStolenEnding extends Ending {
  constructor(session: Session) {
    super(
      session,
      'idea-stolen',
      0,
      new EndingPresentation(
        '아이디어 도난',
        '전문가에게 뒤통수를 맞았습니다',
        '도움을 요청한 전문가가 서비스 아이디어를 가져가 먼저 사업을 시작했습니다.',
        'ending_idea_stolen',
      ),
    )
  }
}
