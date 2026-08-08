import { Ending, EndingPresentation } from '../Ending'
import type { Session } from '@/core/Session'

/** 응대를 받지 못한 고객이 신고했습니다. 사건으로만 나므로 조건이 없습니다. */
export class ConsumerReportEnding extends Ending {
  constructor(session: Session) {
    super(
      session,
      'consumer-report',
      0,
      new EndingPresentation(
        '고객 신고',
        '소비자보호원에 신고됐습니다',
        '전화 문의가 끝내 닿지 않자, 참다 못한 고객이 소비자보호원에 서비스를 신고했습니다.',
        'ending_consumer_report',
      ),
    )
  }
}
