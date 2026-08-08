import { ProductStatus } from '@/game/stats/ProductStatus'
import type { IssueManagerState } from '@/game/IssueManager'
import type { Session } from './Session'

/** `ProductStatus` 의 필드만 편평하게 편 것. */
type ProductSnapshot = Pick<
  ProductStatus,
  | 'users'
  | 'userGrowthPerHour'
  | 'revenuePerHour'
  | 'serverCostPerHour'
  | 'quality'
  | 'revenue'
  | 'spend'
>

/**
 * localStorage 에 실제로 오가는 맨 객체.
 *
 * `JSON.parse` 가 돌려주는 것은 인스턴스가 아니라 맨 객체라서, 저장 모양은 이렇게
 * 따로 두고 `Savepoint` 가 그것을 감싸 검사·복원까지 맡습니다.
 */
interface SavepointData {
  version: number
  clock: { day: number; minutes: number }
  player: { money: number; stamina: number; credit: number }
  product: ProductSnapshot
  /** 어제의 앱. 첫날에는 없습니다 — `null` 과 "0 이었다" 는 다른 말입니다. */
  yesterday: ProductSnapshot | null
  issues: IssueManagerState
  /** `Rng` 내부 상태. 이게 없으면 이어서 시작한 판의 수열이 처음으로 되감깁니다. */
  rng: number
  lastDay: number
  settledAt: number
}

/**
 * 판 하나를 그대로 되살리기 위해 저장하는 것.
 *
 * 뜨는 법(`capture`), 읽는 법(`parse`), 쓰는 법(`toJSON`), 되살리는 법(`applyTo`)이
 * 전부 여기 모여 있습니다. 저장 모양이 바뀌면 이 파일만 고치면 됩니다 — 세션도
 * `ConfigLoader` 도 필드 하나하나를 알지 못합니다.
 *
 * 캐릭터 위치는 일부러 뺐습니다. 걷는 중에 저장되면 목적지와 도착 뒤 할 일까지
 * 되살려야 하는데, 돌아왔을 때 문 앞에 서 있는 것이 어색하지 않고 게임 상태에도
 * 영향이 없습니다.
 */
export class Savepoint {
  /**
   * 저장 모양이 바뀔 때마다 올립니다. 값이 다르면 낡은 세이브를 버립니다 —
   * 어긋난 세이브로 판이 깨지는 것보다 새 판이 낫습니다.
   */
  static readonly VERSION = 1

  /** 만드는 길은 `capture` 와 `parse` 뿐입니다. 검사를 건너뛴 세이브는 없습니다. */
  private constructor(private readonly data: SavepointData) {}

  /** 지금 판을 세이브로 뜹니다. */
  static capture(session: Session): Savepoint {
    return new Savepoint({
      version: Savepoint.VERSION,
      clock: { day: session.clock.day, minutes: session.clock.minutes },
      player: {
        money: session.player.money,
        stamina: session.player.stamina,
        credit: session.player.credit,
      },
      product: captureProduct(session.product),
      yesterday: session.yesterday ? captureProduct(session.yesterday) : null,
      issues: session.issues.serialize(),
      rng: session.rng.state,
      lastDay: session.lastDay,
      settledAt: session.settledAt,
    })
  }

  /**
   * 저장해 둔 글을 세이브로. 되살려도 되는 모양이 아니면 `null` 입니다.
   * 저장된 것이 없으면(`null`) 역시 `null` 입니다.
   *
   * 깨진 JSON 에는 `JSON.parse` 가 던집니다 — 잡지 않고 `ConfigLoader` 의 저장소
   * 감싸개에 맡깁니다. 저장소 실패든 깨진 글이든 "이어서 시작할 판이 없다"는 같은
   * 결론이라 잡는 자리도 하나면 됩니다.
   *
   * 판 하나를 세우는 데 없으면 안 되는 것들만 봅니다. 낱낱의 숫자까지 검사하지 않는
   * 이유는 그 정도로 망가진 세이브는 `version` 이 이미 걸러 주기 때문입니다.
   */
  static parse(text: string | null): Savepoint | null {
    if (text === null) return null

    const value: unknown = JSON.parse(text)
    if (typeof value !== 'object' || value === null) return null

    const data = value as Partial<SavepointData>
    const usable =
      data.version === Savepoint.VERSION &&
      typeof data.rng === 'number' &&
      typeof data.clock?.day === 'number' &&
      typeof data.player?.money === 'number' &&
      typeof data.product?.quality === 'number' &&
      Array.isArray(data.issues?.opened) &&
      Array.isArray(data.issues.solved)

    return usable ? new Savepoint(value as SavepointData) : null
  }

  /** `JSON.stringify` 가 부릅니다. 감싸고 있던 맨 객체를 그대로 내놓습니다. */
  toJSON(): SavepointData {
    return this.data
  }

  /** 이 세이브로 판을 되살립니다. 계기판 갱신은 부른 쪽이 합니다. */
  applyTo(session: Session): void {
    Object.assign(session.clock, this.data.clock)
    Object.assign(session.player, this.data.player)
    Object.assign(session.product, this.data.product)
    session.yesterday = restoreProduct(this.data.yesterday)
    session.issues.restore(this.data.issues)
    session.rng.restore(this.data.rng)
    session.lastDay = this.data.lastDay
    session.settledAt = this.data.settledAt
  }
}

function captureProduct(product: ProductStatus): ProductSnapshot {
  return {
    users: product.users,
    userGrowthPerHour: product.userGrowthPerHour,
    revenuePerHour: product.revenuePerHour,
    serverCostPerHour: product.serverCostPerHour,
    quality: product.quality,
    revenue: product.revenue,
    spend: product.spend,
  }
}

/** 스냅숏을 새 `ProductStatus` 로. `null` 이면 어제가 없던 것입니다. */
function restoreProduct(snapshot: ProductSnapshot | null): ProductStatus | null {
  if (!snapshot) return null

  return Object.assign(new ProductStatus(), snapshot)
}
