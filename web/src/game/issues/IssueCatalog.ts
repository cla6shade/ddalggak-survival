import { AppCrash } from './development/AppCrash'
import { ExposedDatabase } from './development/ExposedDatabase'
import { LocalhostDeploy } from './development/LocalhostDeploy'
import { NoResponsive } from './product/NoResponsive'
import { NoSeo } from './marketing/NoSeo'
import { NoUsers } from './marketing/NoUsers'
import { PaymentIntegration } from './development/PaymentIntegration'
import { PhoneFlood } from './operations/PhoneFlood'
import { RoughVisuals } from './product/RoughVisuals'
import { SlowResponse } from './development/SlowResponse'
import { TinyText } from './product/TinyText'
import type { Issue } from './Issue'
import type { Session } from '@/core/Session'

/**
 * 이 게임에 있는 이슈 전부. 순서는 이슈 코드순입니다.
 *
 * 모듈 상수가 아니라 함수인 이유는 이슈가 세션을 생성자로 받기 때문입니다 —
 * 세션보다 먼저 만들어질 수 없습니다.
 */
export function createIssues(session: Session): Issue[] {
  return [
    new LocalhostDeploy(session),
    new SlowResponse(session),
    new AppCrash(session),
    new PaymentIntegration(session),
    new ExposedDatabase(session),
    new NoUsers(session),
    new NoSeo(session),
    new PhoneFlood(session),
    new NoResponsive(session),
    new TinyText(session),
    new RoughVisuals(session),
  ]
}
