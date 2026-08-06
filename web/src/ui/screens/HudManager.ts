import { UiElement } from '../UiElement'
import { HudRow } from '../primitives/HudRow'
import { ClockTile } from '../tiles/ClockTile'
import { ResourceTile } from '../tiles/ResourceTile'
import { StaminaTile } from '../tiles/StaminaTile'
import { MetricTile } from '../tiles/MetricTile'
import { RateTile } from '../tiles/RateTile'
import { HudTool } from '../tiles/HudTool'
import { MAX_STAMINA } from '@/game/stats/PlayerStatus'
import type { IconSheet } from '@/assets/IconSheet'
import type { Clock } from '@/game/Clock'
import type { PlayerStatus } from '@/game/stats/PlayerStatus'
import type { ProductStatus } from '@/game/stats/ProductStatus'
import type { IssueManager } from '@/game/IssueManager'

/** 이 값 이하로 떨어지면 해당 타일에 경고 표시가 붙습니다. */
const WARN_AT = { money: 60, stamina: 25, credit: 1 } as const

/**
 * 캔버스 위에 얹히는 계기판.
 *
 * 값을 스스로 읽지 않습니다 — 세션이 바뀐 쪽의 `set…` 만 부르고, 각 조각은 값이
 * 같으면 DOM 을 건드리지 않습니다.
 *
 * 아이콘을 아틀라스에서 잘라 쓰므로 **에셋을 불러온 뒤에** 만들어야 합니다.
 */
export class HudManager extends UiElement<'header'> {
  private readonly clock = new ClockTile()
  private readonly money: ResourceTile
  private readonly stamina: StaminaTile
  private readonly credit: ResourceTile
  private readonly users: MetricTile
  private readonly userGrowth: RateTile
  private readonly revenueRate: RateTile
  private readonly serverCostRate: RateTile
  private readonly issueTool: HudTool

  /** `onIssues` 는 알림 버튼을 눌렀을 때. 무엇을 열지는 세션이 정합니다. */
  constructor(icons: IconSheet, onIssues: () => void) {
    super('header', 'hud')

    this.money = new ResourceTile(icons, 'money', 'resource_money', '잔고', '원', WARN_AT.money)
    this.stamina = new StaminaTile(icons, MAX_STAMINA, WARN_AT.stamina)
    this.credit = new ResourceTile(icons, 'credit', 'resource_credit', '크레딧', '개', WARN_AT.credit)

    this.users = new MetricTile(icons, 'metric_users', '이용자', true)
    this.userGrowth = new RateTile(icons, 'metric_user_growth', '이용자 증가율')
    this.revenueRate = new RateTile(icons, 'metric_revenue_rate', '매출')
    this.serverCostRate = new RateTile(icons, 'metric_operating_cost', '서버비')

    this.issueTool = new HudTool(icons, 'hud_issue', '알림', onIssues)

    const spacer = document.createElement('span')
    spacer.className = 'hud__spacer'

    const tools = document.createElement('div')
    tools.className = 'hud__tools'
    tools.append(this.issueTool.element)

    const head = new HudRow('head', [this.clock])
    head.element.append(spacer, tools)

    this.append(
      head,
      new HudRow('resources', [this.money, this.stamina, this.credit]),
      new HudRow('metrics', [this.users, this.userGrowth]),
      new HudRow('metrics', [this.revenueRate, this.serverCostRate]),
    )
  }

  /** 전부 다시 씁니다. 시작할 때와, 무엇이 바뀌었는지 모를 때. */
  render(
    clock: Clock,
    player: PlayerStatus,
    product: ProductStatus,
    previous: ProductStatus | null,
    issues: IssueManager,
  ): void {
    this.setClock(clock)
    this.setPlayer(player)
    this.setProduct(product, previous)
    this.setIssues(issues)
  }

  setClock(clock: Clock): void {
    this.clock.setTime(clock)
  }

  setPlayer(player: PlayerStatus): void {
    this.money.setValue(player.money)
    this.stamina.setValue(player.stamina)
    this.credit.setValue(player.credit)
  }

  /** `previous` 는 어제의 앱. `null` 이면 첫날이라 비교할 어제가 없습니다. */
  setProduct(product: ProductStatus, previous: ProductStatus | null): void {
    this.users.setValue(product.users, previous?.users ?? null)
    this.userGrowth.setValue(product.userGrowthPerHour)
    this.revenueRate.setValue(product.revenuePerHour)
    // 나가는 돈이라 부호를 뒤집어 넣습니다.
    this.serverCostRate.setValue(-product.serverCostPerHour)
  }

  setIssues(issues: IssueManager): void {
    const count = issues.count
    this.issueTool.setEnabled(count > 0)
    this.issueTool.setCount(count)
  }

  /** 알림 버튼을 한 번 튕깁니다. */
  pingIssues(): void {
    this.issueTool.ping()
  }
}
