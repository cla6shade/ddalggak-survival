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

/** 이 게임에 있는 이슈 전부. 순서는 이슈 코드순입니다. */
export const ISSUES: readonly Issue[] = [
  new LocalhostDeploy(),
  new SlowResponse(),
  new AppCrash(),
  new PaymentIntegration(),
  new ExposedDatabase(),
  new NoUsers(),
  new NoSeo(),
  new PhoneFlood(),
  new NoResponsive(),
  new TinyText(),
  new RoughVisuals(),
]

/** 1일차에 하나 터지는 후보. */
export const INITIAL_ISSUES: readonly Issue[] = ISSUES.filter((issue) => issue.initial)

const BY_CODE = new Map(ISSUES.map((issue) => [issue.code, issue]))

export function findIssueByCode(code: string): Issue | undefined {
  return BY_CODE.get(code)
}
