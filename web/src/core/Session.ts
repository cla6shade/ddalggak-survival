import { GameCanvas } from './GameCanvas'
import { AssetManager } from '@/assets/AssetManager'
import { World } from '@/world/World'
import { Clock } from '@/game/Clock'
import { MAX_STAMINA, PlayerStatus } from '@/game/stats/PlayerStatus'
import { ProductStatus } from '@/game/stats/ProductStatus'
import { IssueManager } from '@/game/IssueManager'
import { advanceEconomy } from '@/game/economy'
import { MAX_QUALITY } from '@/game/calc/quality'
import { getSleepRecovery } from '@/game/calc/sleepRecovery'
import { Rng } from '@/game/Rng'
import { IconSheet } from '@/assets/IconSheet'
import { HudManager } from '@/ui/screens/HudManager'
import { IssuePanel } from '@/ui/screens/IssuePanel'
import { ToastStack } from '@/ui/screens/ToastStack'
import type { Issue, ResolveContext } from '@/game/issues/Issue'
import type { IssueOption } from '@/game/issues/IssueOption'

/** 고정 시드. 같은 값이면 같은 판이 재현됩니다. */
const SEED = 1

/**
 * 게임 세션 하나를 담는 싱글톤 컨테이너
 *
 * 상태를 바꾸는 입구는 여기뿐입니다. 필드를 직접 건드리면 계기판이 옛 값을 그대로
 * 들고 있게 되므로, `updateClock`/`updatePlayer`/`updateProduct` 를 거칩니다.
 * 바뀐 쪽의 계기판만 다시 그립니다.
 */
class Session {
  canvas: GameCanvas | null = null
  hud: HudManager | null = null
  readonly assets = new AssetManager()
  readonly icons = new IconSheet(this.assets)
  readonly world = new World()
  readonly clock = new Clock()
  readonly player = new PlayerStatus()
  readonly product = new ProductStatus()
  readonly issues = new IssueManager()
  readonly rng = new Rng(SEED)

  private panel: IssuePanel | null = null
  private toasts: ToastStack | null = null
  /** 어제의 앱. 첫날에는 없습니다 — `0` 과 "어제 없음" 은 다른 말입니다. */
  private yesterday: ProductStatus | null = null
  private lastDay = 1
  /** 마지막으로 경제를 반영한 시각(판 시작 후 총 분). */
  private settledAt = 0

  start(element: HTMLCanvasElement): void {
    this.canvas ??= new GameCanvas(element, this.world)

    // 계기판은 아이콘을 아틀라스에서 잘라 쓰므로 에셋을 불러온 뒤에 세웁니다.
    const root = document.querySelector('#interface')
    if (!(root instanceof HTMLElement)) throw new Error('#interface 를 찾지 못했습니다')
    if (!this.hud) {
      this.panel = new IssuePanel()
      this.toasts = new ToastStack(this.icons)
      this.hud = new HudManager(this.icons, () => this.panel?.toggle())
      this.hud.mountTo(root)
      this.toasts.mountTo(root)
      this.panel.mountTo(root)
    }

    this.showIssueToast(this.issues.spawnInitialIssue(this.rng))

    this.refreshHud()
    this.canvas.start()
  }

  stop(): void {
    this.canvas?.stop()
  }

  /**
   * 프레임마다 시간을 흘려보냅니다.
   * 시계는 매 프레임 돌지만, 계기판은 보이는 분이 바뀔 때만 다시 그립니다.
   */
  tick(delta: number): void {
    if (!this.clock.advanceSeconds(delta)) return

    this.settleEconomy()
    this.hud?.setClock(this.clock)
    if (this.clock.day !== this.lastDay) this.rollOverDay()
  }

  updateClock(patch: Partial<Clock>): void {
    Object.assign(this.clock, patch)
    this.hud?.setClock(this.clock)
    if (this.clock.day !== this.lastDay) this.rollOverDay()
  }

  updatePlayer(patch: Partial<PlayerStatus>): void {
    Object.assign(this.player, patch)
    this.hud?.setPlayer(this.player)
  }

  updateProduct(patch: Partial<ProductStatus>): void {
    Object.assign(this.product, patch)
    this.hud?.setProduct(this.product, this.yesterday)
  }

  /** 이슈처럼 스스로 상태를 들고 있는 쪽이 바뀌었을 때 부릅니다. */
  refreshHud(): void {
    this.hud?.render(this.clock, this.player, this.product, this.yesterday, this.issues)
    this.panel?.render()
  }

  /**
   * 선택지 하나를 눌렀습니다.
   *
   * 판정은 이슈가 합니다. 여기서는 그 결과를 세상에 반영합니다 —
   * 이슈를 닫고, 새 이슈를 터뜨리고, 쓴 시간만큼 시계를 밉니다.
   */
  chooseOption(issue: Issue, option: IssueOption): void {
    // 판을 닫아야 걸어가는 것이 보입니다.
    this.panel?.hide()
    this.world.player.approach(this.world.workDesk, () => this.resolveChoice(issue, option))
  }

  /** 책상 앞에 섰습니다. 이제 판정하고 그 결과를 세상에 반영합니다. */
  private resolveChoice(issue: Issue, option: IssueOption): void {
    const outcome = issue.resolve(option, this.createResolveContext())
    if (outcome.blocked) return

    if (outcome.solved) {
      this.issues.solve(issue.code)
      this.product.quality = Math.min(MAX_QUALITY, this.product.quality + outcome.qualityGain)
      this.toasts?.push('해결', `${issue.title} · 품질 +${outcome.qualityGain}`, 'good')
    } else {
      this.toasts?.push('실패', option.title, 'bad')
    }

    if (outcome.spawnedNew) {
      const spawned = this.issues.spawnRandomIssue(this.rng)
      if (spawned) this.showIssueToast(spawned)
    }
    if (outcome.stolen) {
      this.toasts?.push('아이디어 도난', option.title, 'bad')
      console.log(`[issue] 아이디어 도난 — ${issue.title} / ${option.title}`)
    }

    this.clock.advanceMinutes(outcome.minutes)
    this.settleEconomy()
    this.hud?.setClock(this.clock)
    if (this.clock.day !== this.lastDay) this.rollOverDay()
    this.refreshHud()
  }

  /** 이슈들이 판정에 쓰는 것들. */
  createResolveContext(): ResolveContext {
    return { player: this.player, day: this.clock.day, rng: this.rng }
  }

  /**
   * 지난 정산 이후 흐른 시간을 반영합니다.
   * 열린 이슈들에게 먼저 알리고(사고가 여기서 터집니다), 그 압력으로 경제를 한 번 돕니다.
   */
  private settleEconomy(): void {
    const now = this.clock.totalMinutes
    const minutes = now - this.settledAt
    if (minutes <= 0) return
    this.settledAt = now

    const pressure = this.issues.applyNeglect(minutes, this.createResolveContext())
    advanceEconomy(minutes, this.product, this.player, pressure)

    for (const issue of this.issues.spawnDueIssues(now, this.clock.day, this.rng)) {
      this.showIssueToast(issue)
    }
    this.hud?.setPlayer(this.player)
    this.hud?.setProduct(this.product, this.yesterday)
  }

  /** 터진 이슈 하나를 화면에 알립니다 — 토스트, 알림 개수, 열려 있는 판. */
  private showIssueToast(issue: Issue): void {
    this.toasts?.push('이슈 발생', issue.title)
    this.hud?.setIssues(this.issues)
    this.hud?.pingIssues()
    this.panel?.render()
  }

  /** 날이 바뀌었습니다. 체력을 회복하고, 비교 기준이 될 어제를 떠 둡니다. */
  private rollOverDay(): void {
    this.lastDay = this.clock.day

    const pressure = this.issues.applyNeglect(0, this.createResolveContext())
    this.player.stamina = Math.min(
      MAX_STAMINA,
      this.player.stamina + getSleepRecovery(this.issues.count, pressure.staminaRecoveryPenalty),
    )
    this.hud?.setPlayer(this.player)

    this.yesterday = this.product.clone()
    this.hud?.setProduct(this.product, this.yesterday)
  }
}

export const session = new Session()
