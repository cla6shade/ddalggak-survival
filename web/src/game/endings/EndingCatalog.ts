import { BankruptEnding } from './definitions/BankruptEnding'
import { BurnoutEnding } from './definitions/BurnoutEnding'
import { ConsumerReportEnding } from './definitions/ConsumerReportEnding'
import { DataLeakEnding } from './definitions/DataLeakEnding'
import { DataLossEnding } from './definitions/DataLossEnding'
import { HackedEnding } from './definitions/HackedEnding'
import { IdeaStolenEnding } from './definitions/IdeaStolenEnding'
import { LawsuitEnding } from './definitions/LawsuitEnding'
import { RaceConditionEnding } from './definitions/RaceConditionEnding'
import { ReputationEnding } from './definitions/ReputationEnding'
import { SearchBanEnding } from './definitions/SearchBanEnding'
import type { Ending } from './Ending'
import type { Session } from '@/core/Session'

/**
 * 이 게임에 있는 엔딩 전부. `EndingId` 유니온과 이 목록이 어긋나면
 * `EndingManager.trigger` 가 그 자리에서 던집니다.
 */
export function createEndings(session: Session): Ending[] {
  return [
    new BankruptEnding(session),
    new BurnoutEnding(session),
    new HackedEnding(session),
    new IdeaStolenEnding(session),
    new LawsuitEnding(session),
    new ConsumerReportEnding(session),
    new DataLossEnding(session),
    new DataLeakEnding(session),
    new RaceConditionEnding(session),
    new SearchBanEnding(session),
    new ReputationEnding(session),
  ]
}
