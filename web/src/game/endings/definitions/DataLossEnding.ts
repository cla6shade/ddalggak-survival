import { Ending, EndingPresentation } from '../Ending'
import type { Session } from '@/core/Session'

/** 무엇을 지우는지 모른 채 지웠습니다. 사건으로만 나므로 조건이 없습니다. */
export class DataLossEnding extends Ending {
  constructor(session: Session) {
    super(
      session,
      'data-loss',
      0,
      new EndingPresentation(
        '데이터 손실',
        '사용자 데이터가 전부 사라졌습니다',
        '되돌릴 백업은 만들어 둔 적이 없습니다. 그동안 쌓인 것은 그대로 없던 일이 됐습니다.',
        'ending_data_loss',
      ),
    )
  }
}
