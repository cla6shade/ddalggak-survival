import { GameCanvas } from './GameCanvas'
import { AssetManager } from '@/assets/AssetManager'
import { World } from '@/world/World'
import { Clock } from '@/game/Clock'
import { PlayerStatus } from '@/game/stats/PlayerStatus'
import { ProductStatus } from '@/game/stats/ProductStatus'
import { IssueManager } from '@/game/IssueManager'
import { advanceEconomy } from '@/game/economy'
import { MAX_QUALITY } from '@/game/calc/quality'
import { formatActionOutcome } from '@/game/actions/RoomAction'
import { Rng } from '@/game/Rng'
import { IconSheet } from '@/assets/IconSheet'
import { HudManager } from '@/ui/screens/HudManager'
import { BottomSheet } from '@/ui/screens/BottomSheet'
import { ToastStack } from '@/ui/screens/ToastStack'
import { EndingScreen } from '@/ui/screens/EndingScreen'
import { EndingManager } from '@/game/endings/EndingManager'
import { rollChoiceEnding, rollsLawsuit } from '@/game/endings/EndingEvents'
import type { EndingContext, EndingId, EndingResult } from '@/game/endings/Ending'
import type { Issue, ResolveContext } from '@/game/issues/Issue'
import type { IssueOption } from '@/game/issues/IssueOption'
import type { ActionContext, RoomAction, RoomActionMenu } from '@/game/actions/RoomAction'

/** 고정 시드. 같은 값이면 같은 판이 재현됩니다. */
const SEED = 1

type GamePhase = 'running' | 'ended'

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
  readonly endings = new EndingManager()
  readonly rng = new Rng(SEED)

  private sheet: BottomSheet | null = null
  private toasts: ToastStack | null = null
  private endingScreen: EndingScreen | null = null
  private phase: GamePhase = 'running'
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
      this.sheet = new BottomSheet()
      this.toasts = new ToastStack(this.icons)
      this.endingScreen = new EndingScreen(this.icons, () => window.location.reload())
      this.hud = new HudManager(this.icons, () => this.sheet?.toggle())
      this.hud.mountTo(root)
      this.toasts.mountTo(root)
      this.sheet.mountTo(root)
      this.endingScreen.mountTo(root)
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
    if (this.phase !== 'running') return
    if (!this.clock.advanceSeconds(delta)) return

    this.settleEconomy()
    this.hud?.setClock(this.clock)
    if (this.checkEnding()) return
    if (this.clock.day !== this.lastDay) this.rollOverDay()
  }

  updateClock(patch: Partial<Clock>): void {
    if (this.phase !== 'running') return
    Object.assign(this.clock, patch)
    this.hud?.setClock(this.clock)
    if (this.checkEnding()) return
    if (this.clock.day !== this.lastDay) this.rollOverDay()
  }

  updatePlayer(patch: Partial<PlayerStatus>): void {
    if (this.phase !== 'running') return
    Object.assign(this.player, patch)
    this.hud?.setPlayer(this.player)
    this.checkEnding()
  }

  updateProduct(patch: Partial<ProductStatus>): void {
    if (this.phase !== 'running') return
    Object.assign(this.product, patch)
    this.hud?.setProduct(this.product, this.yesterday)
  }

  /** 이슈처럼 스스로 상태를 들고 있는 쪽이 바뀌었을 때 부릅니다. */
  refreshHud(): void {
    this.hud?.render(this.clock, this.player, this.product, this.yesterday, this.issues)
    this.sheet?.render()
  }

  /**
   * 선택지 하나를 눌렀습니다.
   *
   * 판정은 이슈가 합니다. 여기서는 그 결과를 세상에 반영합니다 —
   * 이슈를 닫고, 새 이슈를 터뜨리고, 쓴 시간만큼 시계를 밉니다.
   */
  chooseOption(issue: Issue, option: IssueOption): void {
    if (this.phase !== 'running') return
    // 판을 닫아야 걸어가는 것이 보입니다.
    this.sheet?.hide()
    this.world.player.approach(this.world.workDesk, () => this.resolveChoice(issue, option))
  }

  /** 책상 앞에 섰습니다. 이제 판정하고 그 결과를 세상에 반영합니다. */
  private resolveChoice(issue: Issue, option: IssueOption): void {
    if (this.phase !== 'running') return
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

    // 기존 자원 고갈 엔딩을 확률 사건보다 먼저 확정합니다.
    if (this.checkEnding()) return

    const eventEnding = rollChoiceEnding(issue, option, outcome, this.rng)
    if (eventEnding) {
      this.triggerEnding(eventEnding)
      return
    }

    this.clock.advanceMinutes(outcome.minutes)
    this.settleEconomy()
    this.hud?.setClock(this.clock)
    if (this.checkEnding()) return
    if (this.clock.day !== this.lastDay) this.rollOverDay()
    this.refreshHud()
  }

  /**
   * 물건 앞에 섰습니다. 그 물건이 내놓는 것들을 폅니다.
   *
   * 이미 그 앞에 서 있으므로 여기서 다시 걸어가게 하면 안 됩니다 —
   * 도착이 `onInteract` 를 또 불러 판이 무한히 다시 열립니다.
   */
  openActionMenu(menu: RoomActionMenu): void {
    if (this.phase !== 'running') return
    this.sheet?.showMenu(menu)
  }

  /**
   * 행동 하나를 눌렀습니다.
   *
   * 판정은 행동이 합니다. 여기서는 그 결과를 세상에 반영합니다 —
   * `chooseOption` 과 같은 순서입니다.
   */
  performAction(action: RoomAction): void {
    if (this.phase !== 'running') return

    const outcome = action.perform(this.createActionContext())
    // 판이 열린 사이에 잔고가 떨어졌을 수 있습니다. 잠긴 줄은 그때 다시 그려지지 않습니다.
    if (outcome.blocked) {
      this.toasts?.push('잔고 부족', action.title, 'bad')
      return
    }

    this.toasts?.push(action.title, formatActionOutcome(outcome), 'good')

    // 행동 값으로 자원이 바닥난 순간 먼저 끝냅니다. 아래 시간 정산에서
    // 매출이 들어와 0원을 잠시 지나친 사실이 사라지면 "바닥나면 종료"가 아닙니다.
    if (this.checkEnding()) return

    this.clock.advanceMinutes(outcome.minutes)
    this.settleEconomy()
    this.hud?.setClock(this.clock)
    if (this.checkEnding()) return
    if (this.clock.day !== this.lastDay) this.rollOverDay()
    this.refreshHud()
  }

  /** 이슈들이 판정에 쓰는 것들. */
  createResolveContext(): ResolveContext {
    return { player: this.player, day: this.clock.day, rng: this.rng }
  }

  /** 방 행동들이 쓰는 것들. 자는 것처럼 이슈를 읽어야 하는 행동이 있습니다. */
  createActionContext(): ActionContext {
    return { ...this.createResolveContext(), issues: this.issues }
  }

  /** 엔딩 규칙들이 읽는 상태 묶음. Session 자체를 넘기지 않아 규칙의 쓰기를 막습니다. */
  private createEndingContext(): EndingContext {
    return {
      player: this.player,
      product: this.product,
      clock: this.clock,
      issues: this.issues,
    }
  }

  /** 지금 조건을 만족한 엔딩이 있으면 판을 끝냅니다. */
  private checkEnding(): boolean {
    if (this.phase !== 'running') return true

    const ending = this.endings.evaluate(this.createEndingContext())
    if (!ending) return false

    this.finish(ending)
    return true
  }

  /** 선택이나 시간 경과에서 발생한 확률 사건으로 판을 끝냅니다. */
  private triggerEnding(id: EndingId): void {
    if (this.phase !== 'running') return
    this.finish(this.endings.trigger(id, this.createEndingContext()))
  }

  private finish(ending: EndingResult): void {
    this.phase = 'ended'
    this.refreshHud()
    this.sheet?.hide()
    this.canvas?.stop()
    this.endingScreen?.show(ending)
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

    if (this.checkEnding()) return
    if (rollsLawsuit(minutes, this.rng)) this.triggerEnding('lawsuit')
  }

  /** 터진 이슈 하나를 화면에 알립니다 — 토스트, 알림 개수, 열려 있는 판. */
  private showIssueToast(issue: Issue): void {
    this.toasts?.push('이슈 발생', issue.title)
    this.hud?.setIssues(this.issues)
    this.hud?.pingIssues()
    this.sheet?.render()
  }

  /**
   * 날이 바뀌었습니다. 비교 기준이 될 어제를 떠 둡니다.
   *
   * 체력은 건드리지 않습니다 — 자정이 지났다고 잔 것은 아닙니다.
   * 회복은 침대에 눕는 `Sleep` 만 합니다.
   */
  private rollOverDay(): void {
    this.lastDay = this.clock.day

    this.yesterday = this.product.clone()
    this.hud?.setProduct(this.product, this.yesterday)
  }
}

export const session = new Session()
