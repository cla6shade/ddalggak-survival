import { Ending, EndingPresentation } from '../Ending'
import type { Session } from '@/core/Session'

/** 열어 둔 권한으로 정보가 새 나갔습니다. 사건으로만 나므로 조건이 없습니다. */
export class DataLeakEnding extends Ending {
  constructor(session: Session) {
    super(
      session,
      'data-leak',
      0,
      new EndingPresentation(
        '정보 유출',
        '사용자 정보가 유출됐습니다',
        '누구나 열 수 있게 둔 데이터베이스가 그대로 퍼졌습니다. 이름과 연락처가 목록으로 돌아다닙니다.',
        'ending_data_leak',
      ),
    )
  }
}
