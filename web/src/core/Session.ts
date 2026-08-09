import { GameCanvas } from './GameCanvas'
import { ConfigLoader } from './ConfigLoader'
import { Savepoint } from './Savepoint'
import { AssetManager } from '@/assets/AssetManager'
import { World } from '@/world/World'
import { Clock } from '@/game/Clock'
import { PlayerStatus } from '@/game/stats/PlayerStatus'
import { ProductStatus } from '@/game/stats/ProductStatus'
import { IssueManager } from '@/game/IssueManager'
import { RoomActionMenus } from '@/game/actions/RoomActionCatalog'
import { advanceEconomy } from '@/game/economy'
import { MAX_QUALITY } from '@/game/calc/quality'
import { formatActionOutcome } from '@/game/actions/RoomAction'
import { Rng } from '@/game/Rng'
import { IconSheet } from '@/assets/IconSheet'
import { HudManager } from '@/ui/screens/HudManager'
import { IssueButton } from '@/ui/screens/IssueButton'
import { BottomSheet } from '@/ui/screens/BottomSheet'
import { ToastStack } from '@/ui/screens/ToastStack'
import type { ToastTone } from '@/ui/screens/ToastStack'
import { EndingScreen } from '@/ui/screens/EndingScreen'
import { EndingCurtain } from '@/ui/screens/EndingCurtain'
import { EndingManager } from '@/game/endings/EndingManager'
import { rollsLawsuit } from '@/game/endings/EndingEvents'
import type { EndingId, EndingResult } from '@/game/endings/Ending'
import type { Issue, ResolveOutcome } from '@/game/issues/Issue'
import type { IssueOption } from '@/game/issues/IssueOption'
import type { ActionOutcome, RoomAction, RoomActionMenu } from '@/game/actions/RoomAction'

/** 시간만 흘렀을 때 세이브를 다시 쓰는 간격(게임 분). */
const SAVE_INTERVAL = 10

type GamePhase = 'running' | 'ended'

/**
 * 게임 세션 하나를 담는 싱글톤 컨테이너
 *
 * 상태를 바꾸는 입구는 여기뿐입니다. 필드를 직접 건드리면 계기판이 옛 값을 그대로
 * 들고 있게 되므로, `updateClock`/`updatePlayer`/`updateProduct` 를 거칩니다.
 * 바뀐 쪽의 계기판만 다시 그립니다.
 */
export class Session {
  canvas: GameCanvas | null = null
  hud: HudManager | null = null
  readonly assets = new AssetManager()
  readonly icons = new IconSheet(this.assets)
  readonly world = new World()
  readonly clock = new Clock()
  readonly player = new PlayerStatus()
  readonly product = new ProductStatus()

  /**
   * 아래 넷은 생성자 본문에서 세웁니다 — `rng` 는 시드를 인자로 받아야 하고,
   * 나머지 셋은 `this` 를 받아야 합니다. 필드 초기자는 선언 순서대로 도는 탓에
   * 뒤에 선언된 `player`·`rng` 가 아직 `undefined` 인 채로 넘어갑니다.
   */
  readonly rng: Rng
  readonly issues: IssueManager
  readonly endings: EndingManager
  readonly menus: RoomActionMenus

  /** 어제의 앱. 첫날에는 없습니다 — `0` 과 "어제 없음" 은 다른 말입니다. */
  yesterday: ProductStatus | null = null

  private readonly config = new ConfigLoader()
  private issueButton: IssueButton | null = null
  private sheet: BottomSheet | null = null
  private toasts: ToastStack | null = null
  private endingScreen: EndingScreen | null = null
  private curtain: EndingCurtain | null = null
  /** 판이 끝났을 때 계기판을 걷으려고 들고 있습니다. */
  private interfaceRoot: HTMLElement | null = null
  private phase: GamePhase = 'running'
  /** 마지막으로 세이브를 쓴 시각(판 시작 후 총 분). 세이브에는 실리지 않습니다. */
  private savedAt = 0

  /**
   * 아래 둘은 세이브가 함께 싣고 되살립니다 — `Savepoint` 가 읽고 써야 해서 열어 둡니다.
   * 날이 바뀐 것을 알아채는 기준과, 마지막으로 경제를 반영한 시각(판 시작 후 총 분).
   */
  lastDay = 1
  settledAt = 0

  /**
   * 브라우저는 인자 없이 만들어 매 판 새 수열을 쓰고, 시뮬레이터는 숫자를 직접 넣어
   * 같은 판을 재현합니다.
   */
  constructor(seed?: number) {
    this.rng = new Rng(seed ?? createRandomSeed())
    this.issues = new IssueManager(this)
    this.endings = new EndingManager(this)
    this.menus = new RoomActionMenus(this)
  }

  /** 판이 끝났는지. 끝난 판은 무엇을 불러도 움직이지 않습니다. */
  get ended(): boolean {
    return this.phase !== 'running'
  }

  /** 이 판을 끝낸 엔딩. 아직 돌고 있으면 `null` 입니다. */
  get result(): EndingResult | null {
    return this.endings.current
  }

  /**
   * 이어서 시작할 판이 남아 있는지.
   *
   * 인트로를 띄울지 판단하는 데만 씁니다 — 이어서 하는 사람에게는 「당장 해보자」를
   * 다시 들이밀 이유가 없습니다. 되살리는 것은 여전히 {@link start} 가 합니다.
   */
  get hasSavepoint(): boolean {
    return this.config.load() !== null
  }

  start(element: HTMLCanvasElement): void {
    this.canvas ??= new GameCanvas(element, this.world)

    // 계기판은 아이콘을 아틀라스에서 잘라 쓰므로 에셋을 불러온 뒤에 세웁니다.
    const root = document.querySelector('#interface')
    if (!(root instanceof HTMLElement)) throw new Error('#interface 를 찾지 못했습니다')
    this.interfaceRoot = root
    if (!this.hud) {
      this.sheet = new BottomSheet()
      this.toasts = new ToastStack()
      this.endingScreen = new EndingScreen(this.icons, () => window.location.reload())
      this.curtain = new EndingCurtain(this.assets)
      this.hud = new HudManager(this.icons)
      this.issueButton = new IssueButton(this.icons, () => this.sheet?.toggle())
      this.hud.mountTo(root)
      this.issueButton.mountTo(root)
      this.toasts.mountTo(root)
      this.sheet.mountTo(root)
      this.endingScreen.mountTo(root)
      this.curtain.mountTo(root)
    }

    // 이어서 시작하는 판에는 첫 이슈를 다시 터뜨리지 않습니다 — 세이브가 이미 들고 있습니다.
    const saved = this.config.load()
    if (saved) {
      saved.applyTo(this)
      this.savedAt = this.settledAt
    } else {
      this.showIssueToast(this.issues.spawnInitialIssue())
    }

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
    this.save()
  }

  updateClock(patch: Partial<Clock>): void {
    if (this.phase !== 'running') return
    Object.assign(this.clock, patch)
    this.hud?.setClock(this.clock)
    if (this.checkEnding()) return
    if (this.clock.day !== this.lastDay) this.rollOverDay()
    this.save(true)
  }

  updatePlayer(patch: Partial<PlayerStatus>): void {
    if (this.phase !== 'running') return
    Object.assign(this.player, patch)
    this.hud?.setPlayer(this.player)
    if (this.checkEnding()) return
    this.save(true)
  }

  updateProduct(patch: Partial<ProductStatus>): void {
    if (this.phase !== 'running') return
    Object.assign(this.product, patch)
    this.hud?.setProduct(this.product, this.yesterday)
    this.save(true)
  }

  /**
   * 이슈 판이 열렸습니다. 떠 있던 알림을 걷습니다.
   *
   * 알림도 판도 이슈 버튼 바로 위에 서므로 둘이 겹칩니다. 판을 여는 것은
   * 지금 뭘 고를지 보겠다는 뜻이니, 방금 지나간 소식 쪽을 접습니다.
   * 판이 스스로 부릅니다 — 여는 길이 버튼·책상·물건으로 여럿입니다.
   */
  dismissToasts(): void {
    this.toasts?.clear()
  }

  /** 이슈처럼 스스로 상태를 들고 있는 쪽이 바뀌었을 때 부릅니다. */
  refreshHud(): void {
    this.hud?.render(this.clock, this.player, this.product, this.yesterday)
    this.issueButton?.setIssues(this.issues)
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
   * 책상 앞에 섰습니다. 지금 열려 있는 이슈들을 폅니다.
   *
   * 선택지를 눌러 여기까지 걸어온 경우에도 발화합니다 — `Character.onArrive` 가
   * `onInteract` 를 `arrivalTask` 보다 먼저 부르기 때문입니다. 판정이 끝나고 나면
   * 남은 이슈 목록이 그대로 떠 있게 되는데, 자리를 지키고 있으니 그게 맞습니다.
   */
  openIssueList(): void {
    if (this.phase !== 'running') return
    this.sheet?.showIssues()
  }

  /**
   * 행동 하나를 눌렀습니다.
   *
   * 판정은 행동이 합니다. 여기서는 그 결과를 세상에 반영합니다 —
   * `chooseOption` 과 같은 순서입니다.
   *
   * 무엇이 오갔는지 돌려주는 이유는 시뮬레이터입니다 — 화면 없이 도는 쪽은
   * 토스트를 못 보므로, 기록할 것을 반환값으로 받아야 합니다.
   * 끝난 판이면 `null` 입니다.
   */
  performAction(action: RoomAction): ActionOutcome | null {
    if (this.phase !== 'running') return null

    const outcome = action.perform()
    // 판이 열린 사이에 잔고가 떨어졌을 수 있습니다. 잠긴 줄은 그때 다시 그려지지 않습니다.
    if (outcome.blocked) {
      this.notify('잔고 부족', action.title, 'bad')
      return outcome
    }

    this.notify(action.title, formatActionOutcome(outcome), 'good')

    // 행동 값으로 자원이 바닥난 순간 먼저 끝냅니다. 아래 시간 정산에서
    // 매출이 들어와 0원을 잠시 지나친 사실이 사라지면 "바닥나면 종료"가 아닙니다.
    if (this.checkEnding()) return outcome

    this.clock.advanceMinutes(outcome.minutes)
    this.settleEconomy()
    this.hud?.setClock(this.clock)
    if (this.checkEnding()) return outcome
    if (this.clock.day !== this.lastDay) this.rollOverDay()
    this.refreshHud()
    this.save(true)

    return outcome
  }

  /**
   * 확률 사건으로 판을 끝냅니다.
   *
   * 이슈가 방치 판정에서 직접 부르므로 열려 있습니다. 부른 쪽이 `settleEconomy`
   * 한복판일 수 있어서, 부른 뒤에는 `phase` 를 보고 하던 일을 접어야 합니다.
   */
  triggerEnding(id: EndingId): void {
    if (this.phase !== 'running') return
    this.finish(this.endings.trigger(id))
  }

  /**
   * 책상 앞에 섰습니다. 이제 판정하고 그 결과를 세상에 반영합니다.
   *
   * `chooseOption` 은 걸어간 뒤에 이걸 부릅니다. 열려 있는 이유는 시뮬레이터입니다 —
   * 화면 없이 도는 쪽은 캐릭터를 걷게 할 수 없어 여기로 바로 들어옵니다.
   * 끝난 판이면 `null` 입니다.
   */
  resolveChoice(issue: Issue, option: IssueOption): ResolveOutcome | null {
    if (this.phase !== 'running') return null
    const outcome = issue.resolve(option)
    if (outcome.blocked) return outcome

    if (outcome.solved) {
      this.issues.solve(issue.code)
      this.product.quality = Math.min(MAX_QUALITY, this.product.quality + outcome.qualityGain)
      this.notify('해결', `${issue.title} · 품질 +${outcome.qualityGain}`, 'good')

      // 하나를 해결했을 때만, 방금 해결한 것과 다른 이슈를 하나 엽니다.
      const spawned = this.issues.spawnRandomIssue(issue.code)
      outcome.spawnedNew = spawned !== null
      if (spawned) this.showIssueToast(spawned)
    } else {
      this.notify('실패', option.title, 'bad')
    }

    // 기존 자원 고갈 엔딩을 확률 사건보다 먼저 확정합니다.
    if (this.checkEnding()) return outcome

    const eventEnding = issue.rollChoiceEnding(option, outcome)
    if (eventEnding) {
      this.triggerEnding(eventEnding)
      return outcome
    }

    this.clock.advanceMinutes(outcome.minutes)
    this.settleEconomy()
    this.hud?.setClock(this.clock)
    if (this.checkEnding()) return outcome
    if (this.clock.day !== this.lastDay) this.rollOverDay()
    this.refreshHud()
    this.save(true)

    return outcome
  }

  /** 지금 조건을 만족한 엔딩이 있으면 판을 끝냅니다. */
  private checkEnding(): boolean {
    if (this.phase !== 'running') return true

    const ending = this.endings.evaluate()
    if (!ending) return false

    this.finish(ending)
    return true
  }

  private finish(ending: EndingResult): void {
    this.phase = 'ended'
    // 엔딩은 판의 끝입니다. 이어서 시작할 자리를 남겨 두지 않습니다.
    this.config.clear()
    this.refreshHud()
    this.sheet?.hide()
    this.canvas?.stop()
    // 더 볼 숫자가 없습니다. 계기판과 이슈 버튼을 걷습니다.
    this.interfaceRoot?.classList.add('interface--ended')

    // 결과를 바로 들이밀지 않습니다. 끝났다는 것만 먼저 보여 주고, 그 다음에 숫자를 폅니다.
    const screen = this.endingScreen
    if (this.curtain && screen) this.curtain.show(() => screen.show(ending))
    else screen?.show(ending)
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

    const pressure = this.issues.applyNeglect(minutes)
    // 방치 판정이 판을 끝냈을 수 있습니다.
    if (this.phase !== 'running') return

    advanceEconomy(minutes, this.product, this.player, pressure)
    this.hud?.setPlayer(this.player)
    this.hud?.setProduct(this.product, this.yesterday)

    if (this.checkEnding()) return
    if (rollsLawsuit(minutes, this.rng)) this.triggerEnding('lawsuit')
  }

  /**
   * 지금 판을 세이브에 씁니다.
   *
   */
  private save(force = false): void {
    // 끝난 판을 쓰면 `finish` 가 방금 지운 세이브가 되살아납니다.
    if (this.phase !== 'running') return

    const now = this.clock.totalMinutes
    if (!force && now - this.savedAt < SAVE_INTERVAL) return
    this.savedAt = now

    this.config.save(Savepoint.capture(this))
  }

  /**
   * 알림 한 장을 세웁니다.
   *
   * 세우기 전에 이슈 판을 걷습니다 — 둘 다 이슈 버튼 위에 서서 자리가 겹치고,
   * 방금 벌어진 일을 읽는 동안 고를 것을 같이 들이밀면 어느 쪽도 읽히지 않습니다.
   * 알림을 띄우는 입구를 여기 하나로 모아 두는 이유이기도 합니다.
   */
  private notify(title: string, body: string, tone: ToastTone = 'issue'): void {
    this.sheet?.hide()
    this.toasts?.push(title, body, tone)
  }

  /** 터진 이슈 하나를 화면에 알립니다 — 토스트, 이슈 버튼, 열려 있는 판. */
  private showIssueToast(issue: Issue): void {
    this.notify('이슈 발생', issue.title)
    this.issueButton?.setIssues(this.issues)
    this.issueButton?.ping()
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

/** 브라우저 새 게임용 32비트 시드. 보안 목적이 아니라 판의 수열을 섞기 위한 값입니다. */
function createRandomSeed(): number {
  const value = new Int32Array(1)
  crypto.getRandomValues(value)
  return value[0] ?? Date.now()
}

export const session = new Session()
