import { Policy } from '../Policy'
import { PlayerView } from '../PlayerView'
import type { Decision, IssueView, OptionView } from '../PlayerView'
import type { Rng } from '@/game/Rng'

/**
 * 이슈 하나를 그냥 뒀을 때의 「시간당 아픔」을 한 번의 선택과 견줄 수 있는 크기로
 * 올리는 눈금.
 *
 * 방치 압력은 시간당 값이고 선택지 비용은 일회성입니다. 그대로 빼면 자릿수가
 * 안 맞아 아무도 아무 것도 안 누릅니다 — 고치면 그 피해가 **앞으로 계속** 사라지므로,
 * 몇 시간치 피해로 환산해서 견주는 것이 맞습니다.
 */
const HURT_HOURS = 3

/**
 * 시간을 값으로 환산하는 눈금(시간).
 * 하루가 24시간이라 「몇 시간을 쓰는가」는 이 정도 폭에서 재야 다른 축과 자릿수가 맞습니다.
 */
const SPARE_TIME = 1 / 8

/**
 * 한 사람의 성향.
 *
 * 같은 화면을 봐도 사람마다 다른 줄을 누릅니다. 그 차이를 **무엇을 얼마나 아까워하는가**
 * 하나로 모아 둔 것이 이 값들입니다. 정책 클래스를 사람 수만큼 만들지 않고
 * 이 묶음만 갈아 끼웁니다 — 고르는 절차는 누구나 같고, 저울만 다르기 때문입니다.
 */
export class Traits {
  /** ── 어느 이슈부터 볼까 ── */
  /** 매출을 끊어 놓은 이슈를 얼마나 급하게 보는가. */
  readonly revenueWeight: number
  /** 사용자가 빠져나가는 것을 얼마나 아깝게 보는가(명/시간당). */
  readonly userWeight: number
  /** 품질이 깎이는 것을 얼마나 아깝게 보는가(점/시간당). */
  readonly qualityWeight: number
  /** 잠을 못 자게 만드는 이슈를 얼마나 급하게 보는가. */
  readonly sleepWeight: number

  /** ── 그 안에서 어떻게 칠까 ── */
  /**
   * 확률을 얼마나 무겁게 보는가. 성공률에 씌우는 지수입니다.
   *
   * 1 보다 크면 낮은 확률을 심하게 깎아 「확실한 것만」 남습니다.
   * 1 보다 작으면 20% 나 70% 나 비슷해 보여 「일단 질러 보는」 쪽이 됩니다.
   * 가중치가 아니라 지수인 이유는, 확률을 곱으로 키우면 신중한 사람이 오히려
   * 모든 줄을 다 누르게 되기 때문입니다.
   */
  readonly riskAversion: number
  readonly staminaWeight: number
  readonly moneyWeight: number
  readonly creditWeight: number
  readonly timeWeight: number
  /** 「도박」 줄에 대한 태도. 음수면 피합니다. */
  readonly gambleWeight: number

  /** ── 몸 관리 ── */
  /** 이 아래로 떨어지면 만사 제치고 눕습니다. */
  readonly sleepBelow: number
  /** 이 아래로 떨어지면 벌러 나갈 생각을 합니다. */
  readonly workBelow: number
  readonly restWeight: number
  readonly earnWeight: number

  /**
   * 얼마나 일관되게 최선을 고르는가.
   *
   * 0 에 가까우면 늘 1등만 고릅니다. 크면 자주 흔들립니다. 사람은 매번 최선을
   * 고르지 않고, 그 흔들림이 곧 「여러 사람이 한 번씩 해 본 판」을 만듭니다.
   */
  readonly temperature: number

  constructor(
    readonly name: string,
    overrides: Partial<Omit<Traits, 'name' | 'toParams'>> = {},
  ) {
    this.revenueWeight = overrides.revenueWeight ?? 3
    this.userWeight = overrides.userWeight ?? 0.5
    this.qualityWeight = overrides.qualityWeight ?? 4
    this.sleepWeight = overrides.sleepWeight ?? 0.15

    this.riskAversion = overrides.riskAversion ?? 1
    this.staminaWeight = overrides.staminaWeight ?? 3
    this.moneyWeight = overrides.moneyWeight ?? 3
    this.creditWeight = overrides.creditWeight ?? 1
    this.timeWeight = overrides.timeWeight ?? 0.4
    this.gambleWeight = overrides.gambleWeight ?? -4

    this.sleepBelow = overrides.sleepBelow ?? 28
    this.workBelow = overrides.workBelow ?? 80_000
    this.restWeight = overrides.restWeight ?? 3
    this.earnWeight = overrides.earnWeight ?? 3

    this.temperature = overrides.temperature ?? 0.5
  }

  toParams(): Record<string, number> {
    return {
      riskAversion: this.riskAversion,
      staminaWeight: this.staminaWeight,
      moneyWeight: this.moneyWeight,
      creditWeight: this.creditWeight,
      timeWeight: this.timeWeight,
      earnWeight: this.earnWeight,
      temperature: this.temperature,
      sleepBelow: this.sleepBelow,
      workBelow: this.workBelow,
    }
  }

  /**
   * 서로 다른 갈래로 같은 판을 치는 사람들.
   *
   * 기본값에서 **한두 축만** 크게 비틀었습니다. 전부 다르게 만들면 무엇이 결과를
   * 갈랐는지 못 읽습니다.
   */
  static fixer(): Traits {
    // 돈으로 때웁니다. 잔고는 안 아깝고 몸이 아까워서, 미리미리 벌어 둡니다.
    return new Traits('fixer', {
      moneyWeight: 0.3,
      staminaWeight: 5,
      earnWeight: 6,
      workBelow: 140_000,
    })
  }

  static grinder(): Traits {
    // 몸으로 때웁니다. 돈은 못 쓰고 체력은 갈아 넣습니다.
    return new Traits('grinder', {
      moneyWeight: 10,
      staminaWeight: 0.7,
      sleepBelow: 18,
    })
  }

  static clicker(): Traits {
    // 딸깍으로 때웁니다. 크레딧이 안 아깝고 시간이 아깝습니다.
    return new Traits('clicker', {
      creditWeight: 0.08,
      timeWeight: 2,
      staminaWeight: 4,
      temperature: 0.4,
    })
  }

  static careful(): Traits {
    // 돌다리를 두드립니다. 낮은 확률은 아예 안 봅니다. 거의 안 흔들립니다.
    return new Traits('careful', {
      riskAversion: 3,
      gambleWeight: -20,
      timeWeight: 0.15,
      temperature: 0.15,
    })
  }

  static rusher(): Traits {
    // 일단 지릅니다. 확률은 대충 보고 자주 흔들립니다.
    return new Traits('rusher', {
      riskAversion: 0.3,
      timeWeight: 3,
      gambleWeight: -1,
      temperature: 1.2,
    })
  }

  static readonly ARCHETYPES = ['fixer', 'grinder', 'clicker', 'careful', 'rusher'] as const

  static of(name: string): Traits | null {
    switch (name) {
      case 'fixer':
        return Traits.fixer()
      case 'grinder':
        return Traits.grinder()
      case 'clicker':
        return Traits.clicker()
      case 'careful':
        return Traits.careful()
      case 'rusher':
        return Traits.rusher()
      default:
        return null
    }
  }
}

/** 저울에 올린 후보 하나. 무엇을 누를지와 그것이 얼마나 값진지. */
interface Candidate {
  decision: Decision
  score: number
}

/**
 * 사람처럼 고릅니다.
 *
 * 앞선 정책들은 열린 이슈 × 5선택지를 한 줄로 세워 점수 하나로 1등만 뽑았습니다.
 * 화면은 **이슈 목록 → 대응책** 두 장인데 그 두 판단을 뭉갠 셈이라, 대안이 생길
 * 자리가 없었습니다. 여기서는 셋을 고쳤습니다.
 *
 * 1. **두 단계로 나눕니다.** 「어느 이슈가 제일 아픈가」와 「그 이슈를 어떻게 칠까」는
 *    기준이 다릅니다. 앞은 방치 압력을 보고, 뒤는 값과 확률을 봅니다.
 * 2. **이슈만 보지 않습니다.** 눕기·벌러 나가기도 같은 저울에 올려 함께 겨룹니다.
 *    사람은 「지금은 이슈 말고 자자」를 늘 저울질합니다.
 * 3. **1등만 고르지 않습니다.** 점수에 온도를 씌워 확률로 뽑습니다. 같은 성향도
 *    판마다 다른 길로 갑니다.
 *
 * 고른 이슈에 마음에 드는 줄이 하나도 없으면 그 이슈를 빼고 다시 고릅니다 —
 * 목록으로 돌아가는 것과 같습니다.
 */
export class HumanPolicy extends Policy {
  readonly name: string

  constructor(
    rng: Rng,
    private readonly traits: Traits,
  ) {
    super(rng)
    this.name = traits.name
  }

  override get params(): Record<string, number> {
    return this.traits.toParams()
  }

  decide(view: PlayerView): Decision {
    // 쓰러지기 직전에는 아무도 저울질하지 않습니다.
    if (view.stamina <= this.traits.sleepBelow) {
      const rest = view.deepestRest
      if (rest) return rest.decision
    }

    // 값어치가 없는 것은 후보로도 올리지 않습니다. 억지로 누르는 것보다 손을 놓는 편이 낫습니다.
    const candidates = [
      ...this.restCandidates(view),
      ...this.earnCandidates(view),
      ...this.issueCandidates(view),
    ].filter((candidate) => candidate.score > 0)

    return this.sample(candidates, (candidate) => candidate.score)?.decision ?? PlayerView.WAIT
  }

  /* ── 몸 ──────────────────────────────────────────────────────── */

  /**
   * 눕거나 먹는 것. 상한에 잘려 버려지는 몫은 값으로 치지 않습니다 —
   * 체력 95 에 8시간 자는 사람은 없습니다.
   */
  private restCandidates(view: PlayerView): Candidate[] {
    const room = view.maxStamina - view.stamina
    if (room <= 0) return []

    const urgency = room / view.maxStamina

    return view.affordableActions
      .filter((action) => action.staminaGain > 0)
      .map((action) => ({
        decision: action.decision,
        score:
          this.traits.restWeight * urgency * (Math.min(action.staminaGain, room) / view.maxStamina) -
          this.traits.timeWeight * (action.minutes / 60) * SPARE_TIME,
      }))
  }

  /** 벌러 나가는 것. 잔고가 넉넉하면 급할 것이 없어 저절로 밀려납니다. */
  private earnCandidates(view: PlayerView): Candidate[] {
    const urgency = Math.max(0, 1 - view.money / this.traits.workBelow)
    if (urgency <= 0) return []

    return view.affordableActions
      .filter((action) => action.moneyGain > 0)
      .filter((action) => view.stamina + action.staminaGain > this.traits.sleepBelow)
      .map((action) => ({
        decision: action.decision,
        score:
          this.traits.earnWeight * urgency -
          this.traits.staminaWeight * (Math.abs(action.staminaGain) / view.maxStamina) -
          this.traits.timeWeight * (action.minutes / 60) * SPARE_TIME,
      }))
  }

  /* ── 이슈 ────────────────────────────────────────────────────── */

  /**
   * ① 아픈 이슈를 하나 고르고 ② 그 안에서 칠 줄을 고릅니다.
   *
   * 고른 이슈에 누를 만한 줄이 없으면 목록으로 돌아가 다른 이슈를 봅니다.
   * 열린 이슈가 전부 마음에 안 들면 그제서야 포기합니다.
   */
  private issueCandidates(view: PlayerView): Candidate[] {
    const remaining = [...view.issues]

    while (remaining.length > 0) {
      const issue = this.sample(remaining, (candidate) => this.hurtOf(candidate))
      if (!issue) return []
      remaining.splice(remaining.indexOf(issue), 1)

      const option = this.pickOption(view, issue)
      if (option) return [{ decision: option.decision, score: this.valueOf(view, issue, option) }]
    }

    return []
  }

  /** ① 그냥 두면 얼마나 아픈가. 시트의 「방치 시 …」 한 줄을 저울에 올린 것입니다. */
  private hurtOf(issue: IssueView): number {
    const { neglect } = issue

    return (
      this.traits.revenueWeight * (neglect.killsRevenue ? 1 : 0) +
      this.traits.userWeight * Math.max(0, -neglect.userDeltaPerHour) +
      this.traits.qualityWeight * Math.max(0, -neglect.qualityDeltaPerHour) +
      this.traits.sleepWeight * neglect.staminaRecoveryPenalty
    )
  }

  /** ② 그 이슈를 어떻게 칠까. 값이 0 이하인 줄은 아예 후보가 아닙니다. */
  private pickOption(view: PlayerView, issue: IssueView): OptionView | null {
    const usable = issue.affordableOptions.filter(
      (option) => option.staminaCost < view.stamina && this.valueOf(view, issue, option) > 0,
    )

    return this.sample(usable, (option) => this.valueOf(view, issue, option))
  }

  /**
   * 이 줄을 누르면 얼마나 값진가.
   *
   * 「성공하면 저 아픔이 앞으로 안 샌다」에서 값을 얻고, 치르는 것마다 뺍니다.
   * 비용은 절대값이 아니라 **남은 것 대비**로 셉니다 — 잔고 5만 원일 때의 1만 원과
   * 30만 원일 때의 1만 원은 다른 무게입니다.
   */
  private valueOf(view: PlayerView, issue: IssueView, option: OptionView): number {
    const odds = option.successRate ** this.traits.riskAversion
    const gain = this.hurtOf(issue) * HURT_HOURS * odds

    const staminaPain = this.traits.staminaWeight * (option.staminaCost / view.maxStamina)
    const moneyPain = this.traits.moneyWeight * (option.moneyCost / Math.max(1, view.money))
    // 크레딧이 얼마 안 남았으면 같은 값도 더 아깝습니다. 바닥나면 돈으로 사야 합니다.
    const creditPain = this.traits.creditWeight * (option.creditCost / Math.max(1, view.credit))
    const timePain = this.traits.timeWeight * (option.minutes / 60) * SPARE_TIME
    const gambleBonus = option.kind === 'gamble' ? this.traits.gambleWeight : 0

    return gain - staminaPain - moneyPain - creditPain - timePain + gambleBonus
  }

  /* ── 흔들림 ──────────────────────────────────────────────────── */

  /**
   * 점수가 높을수록 자주, 그러나 늘은 아니게 뽑습니다.
   *
   * `exp` 를 그냥 씌우면 점수가 조금만 커도 넘칩니다. 최댓값을 빼고 씌우는 것은
   * 결과를 바꾸지 않으면서 그걸 막는 표준 수법입니다.
   */
  private sample<T>(items: readonly T[], score: (item: T) => number): T | null {
    const first = items[0]
    if (!first) return null
    if (items.length === 1) return first

    const scores = items.map(score)

    if (this.traits.temperature <= 0) {
      let best = first
      let bestScore = scores[0] ?? 0
      for (let i = 1; i < items.length; i += 1) {
        const item = items[i]
        const value = scores[i] ?? 0
        if (item && value > bestScore) {
          best = item
          bestScore = value
        }
      }

      return best
    }

    const top = Math.max(...scores)
    const weights = scores.map((value) => Math.exp((value - top) / this.traits.temperature))
    const total = weights.reduce((sum, weight) => sum + weight, 0)

    let roll = this.rng.next() * total
    for (let i = 0; i < items.length; i += 1) {
      roll -= weights[i] ?? 0
      if (roll <= 0) return items[i] ?? first
    }

    return items[items.length - 1] ?? first
  }
}
