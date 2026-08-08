import { HumanPolicy, Traits } from './HumanPolicy'
import { RandomPolicy } from './RandomPolicy'
import { SurvivalPolicy } from './SurvivalPolicy'
import { DdalggakPolicy } from './DdalggakPolicy'
import { IdlePolicy } from './IdlePolicy'
import type { Policy } from '../Policy'
import type { Rng } from '@/game/Rng'

/** 이름으로 정책을 찾는 곳. CLI 가 받은 문자열이 여기서 실물이 됩니다. */
export class PolicyRegistry {
  /**
   * 사람 갈래들. 고르는 절차는 같고 저울만 다릅니다.
   * 밸런스를 잴 때 기본으로 도는 것이 이 다섯입니다.
   */
  static readonly humans: readonly string[] = Traits.ARCHETYPES

  /**
   * 사람이 아닌 기준선들.
   *
   * `random` 은 아무 편도 안 들고 선택지 공간을 훑고, `idle` 은 손을 놓았을 때의
   * 바닥입니다. `survival` 과 `ddalggak` 은 한 축으로만 고르던 옛 정책이라
   * 기본 배치에서는 뺐지만, 비교하고 싶을 때 `--policy` 로 부를 수 있게 남겨 둡니다.
   */
  static readonly baselines: readonly string[] = ['random', 'idle', 'survival', 'ddalggak']

  static readonly names: readonly string[] = [...PolicyRegistry.humans, ...PolicyRegistry.baselines]

  static create(name: string, rng: Rng): Policy {
    const traits = Traits.of(name)
    if (traits) return new HumanPolicy(rng, traits)

    switch (name) {
      case 'random':
        return new RandomPolicy(rng)
      case 'survival':
        return new SurvivalPolicy(rng)
      case 'ddalggak':
        return new DdalggakPolicy(rng)
      case 'idle':
        return new IdlePolicy(rng)
      default:
        throw new Error(`모르는 정책입니다: ${name} (있는 것: ${PolicyRegistry.names.join(', ')})`)
    }
  }
}
