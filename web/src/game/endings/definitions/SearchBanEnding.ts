import { Ending, EndingPresentation } from '../Ending'
import type { Session } from '@/core/Session'

/** 검색엔진을 속이려다 색인에서 통째로 빠졌습니다. 사건으로만 나므로 조건이 없습니다. */
export class SearchBanEnding extends Ending {
  constructor(session: Session) {
    super(
      session,
      'search-ban',
      0,
      new EndingPresentation(
        '검색 차단',
        '검색 결과에서 사라졌습니다',
        '남의 서비스명을 몰래 끼워 넣은 것이 걸렸습니다. 이제 서비스 이름을 그대로 쳐도 나오지 않습니다.',
        'ending_search_ban',
      ),
    )
  }
}
