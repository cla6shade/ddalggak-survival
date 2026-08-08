import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { Playthrough } from '../src/Playthrough'
import { SimConfig } from '../src/RunLog'
import { PolicyRegistry } from '../src/policies/PolicyRegistry'

/**
 * 밸런스가 바뀌면 여기가 먼저 빨개집니다.
 *
 * 고친 것이 의도한 것이라면 `UPDATE_GOLDEN=1 pnpm test` 로 다시 뜬 뒤,
 * **그 diff 를 눈으로 읽고** 커밋합니다. 숫자가 얼마나 움직였는지가 곧 변경의 크기입니다.
 */
const GOLDEN_PATH = fileURLToPath(new URL('./golden.json', import.meta.url))
const SEEDS = [1, 2, 3]
const CONFIG = new SimConfig()

interface GoldenRow {
  seed: number
  policy: string
  result: string
  days: number
  steps: number
  issuesSolved: number
  finalRngState: number
}

interface GoldenFile {
  configHash: string
  rows: GoldenRow[]
}

function measure(): GoldenFile {
  const rows: GoldenRow[] = []

  for (const policy of PolicyRegistry.names) {
    for (const seed of SEEDS) {
      const { outcome, stats } = Playthrough.play(seed, policy, CONFIG)
      rows.push({
        seed,
        policy,
        result: outcome.endingId ?? outcome.reason,
        days: outcome.snapshot.day,
        steps: stats.steps,
        issuesSolved: stats.issuesSolved,
        finalRngState: stats.finalRngState,
      })
    }
  }

  return { configHash: CONFIG.hash, rows }
}

test('고정 시드의 결과가 골든과 같다', () => {
  const current = measure()

  if (process.env.UPDATE_GOLDEN === '1' || !existsSync(GOLDEN_PATH)) {
    writeFileSync(GOLDEN_PATH, `${JSON.stringify(current, null, 2)}\n`, 'utf8')
    console.log(`골든을 새로 썼습니다: ${GOLDEN_PATH}`)

    return
  }

  const golden = JSON.parse(readFileSync(GOLDEN_PATH, 'utf8')) as GoldenFile

  // 설정이 바뀌면 결과가 달라지는 것이 당연합니다. 「밸런스가 바뀌었다」와 헷갈리지 않게
  // 여기서 먼저, 다른 문구로 끊습니다.
  assert.equal(
    current.configHash,
    golden.configHash,
    '시뮬레이터 설정이 바뀌었습니다. 밸런스 회귀가 아니라 설정 변경입니다 — ' +
      'UPDATE_GOLDEN=1 로 다시 뜨십시오.',
  )

  assert.deepEqual(current.rows, golden.rows)
})
