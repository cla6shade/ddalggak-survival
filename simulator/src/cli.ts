import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { parseArgs } from 'node:util'
import { BatchRunner } from './BatchRunner'
import { Playthrough } from './Playthrough'
import { PolicyRegistry } from './policies/PolicyRegistry'
import { SimConfig } from './RunLog'
import type { BatchReport, BatchSummary } from './BatchRunner'
import type { RunLog } from './RunLog'

/**
 * 밸런스를 재는 기본 판 수와 정책.
 *
 * 사람 갈래 다섯을 나란히 돌립니다. 한 갈래에만 맞춰 수치를 고치면 그 갈래에만
 * 맞는 게임이 되므로, 서로 다르게 치는 사람들을 함께 놓고 봅니다.
 * 무작위 기준선이 필요하면 `--policy random` 으로 부릅니다.
 */
const DEFAULT_RUNS = 10_000
const DEFAULT_POLICY = PolicyRegistry.humans.join(',')

/** 진행 표시를 갱신할 간격. 너무 잦으면 그 자체가 느려집니다. */
const PROGRESS_EVERY = 20_000

const USAGE = `딸깍 서바이벌 시뮬레이터

  pnpm sim   [--seed 1] [--policy careful] [--out runs/run.json]
  pnpm batch [--runs 10000] [--policy fixer,grinder] [--seed 1] [--out runs/batch.json]

  --tick      결정 하나당 흘려보낼 게임 분 (기본 1)
  --max-days  이 날을 넘기면 「생존」으로 끊습니다 (기본 60)
  --sample    곡선 표본 간격, 게임 분 (기본 15)

  정책: ${PolicyRegistry.names.join(', ')}
`

/** 명령줄에서 들어온 것을 실물로 바꿔 실행하는 곳. */
class Cli {
  private readonly values: Record<string, string | boolean | undefined>
  private readonly command: string

  constructor(argv: readonly string[]) {
    const { values, positionals } = parseArgs({
      args: [...argv],
      allowPositionals: true,
      options: {
        seed: { type: 'string' },
        policy: { type: 'string' },
        runs: { type: 'string' },
        out: { type: 'string' },
        tick: { type: 'string' },
        'max-days': { type: 'string' },
        sample: { type: 'string' },
        help: { type: 'boolean', short: 'h' },
      },
    })

    this.values = values
    this.command = positionals[0] ?? 'run'
  }

  execute(): void {
    if (this.values.help) {
      console.log(USAGE)

      return
    }

    if (this.command === 'run') return this.runOne()
    if (this.command === 'batch') return this.runBatch()

    console.log(USAGE)
    throw new Error(`모르는 명령입니다: ${this.command}`)
  }

  private runOne(): void {
    const seed = this.number('seed', 1)
    const policyName = this.text('policy', 'careful')
    const log = Playthrough.play(seed, policyName, this.config())

    const out = this.text('out', `runs/run-${policyName}-${seed}.json`)
    Cli.write(out, log)
    Cli.reportRun(log, out)
  }

  private runBatch(): void {
    const runs = this.number('runs', DEFAULT_RUNS)
    const policies = this.text('policy', DEFAULT_POLICY).split(',')
    const started = Date.now()
    const report = new BatchRunner({
      baseSeed: this.number('seed', 1),
      runs,
      policies,
      config: this.config(),
    }).run(Cli.progress)

    process.stderr.write(`\r${' '.repeat(60)}\r`)
    const out = this.text('out', 'runs/batch.json')
    Cli.write(out, report)
    Cli.reportBatch(report, out, Date.now() - started)
  }

  /**
   * 100만 판이면 몇 분씩 걸립니다. 아무 것도 안 뜨면 멈춘 줄 알게 됩니다.
   * 표준 출력이 아니라 표준 오류로 흘려서, 결과만 파이프로 받아도 안 섞입니다.
   */
  private static progress(done: number, total: number): void {
    if (done % PROGRESS_EVERY !== 0 && done !== total) return

    const share = ((done / total) * 100).toFixed(1)
    process.stderr.write(
      `\r  ${done.toLocaleString('ko-KR')} / ${total.toLocaleString('ko-KR')}  ${share}%   `,
    )
  }

  private config(): SimConfig {
    return new SimConfig({
      tickMinutes: this.number('tick', 1),
      maxDays: this.number('max-days', 60),
      sampleEveryMinutes: this.number('sample', 15),
    })
  }

  private text(name: string, fallback: string): string {
    const value = this.values[name]

    return typeof value === 'string' ? value : fallback
  }

  private number(name: string, fallback: number): number {
    const value = this.values[name]
    if (typeof value !== 'string') return fallback

    const parsed = Number(value)
    if (!Number.isFinite(parsed)) throw new Error(`--${name} 은 숫자여야 합니다: ${value}`)

    return parsed
  }

  private static write(path: string, payload: unknown): void {
    const target = resolve(process.cwd(), path)
    mkdirSync(dirname(target), { recursive: true })
    writeFileSync(target, JSON.stringify(payload), 'utf8')
  }

  private static reportRun(log: RunLog, out: string): void {
    const { outcome, stats, meta } = log
    const { snapshot } = outcome

    console.log(`시드 ${meta.seed} · 정책 ${meta.policy.name} · 설정 ${meta.configHash}`)
    console.log(
      `결과: ${outcome.title ?? outcome.reason} — ${snapshot.day}일차, 결정 ${stats.steps}회`,
    )
    console.log(
      `잔고 ${Math.round(snapshot.money).toLocaleString('ko-KR')}원 · ` +
        `체력 ${Math.round(snapshot.stamina)} · 이용자 ${Math.round(snapshot.users)} · ` +
        `품질 ${Math.round(snapshot.quality)}`,
    )
    console.log(
      `이슈 ${stats.issuesSpawned}건 발생 · ${stats.issuesSolved}건 해결 · ` +
        `${stats.choicesFailed}회 실패 · 사건 ${log.events.length}줄`,
    )
    console.log(`기록: ${out}`)
  }

  private static reportBatch(report: BatchReport, out: string, elapsedMs: number): void {
    const total = report.runs * report.summaries.length
    console.log(
      `${report.runs.toLocaleString('ko-KR')}판 × 정책 ${report.summaries.length}종 · ` +
        `기준 시드 ${report.baseSeed} · 설정 ${report.configHash} · ` +
        `${(elapsedMs / 1000).toFixed(1)}초 (판당 ${(elapsedMs / total).toFixed(3)}ms)\n`,
    )

    for (const summary of report.summaries) {
      Cli.reportSummary(summary)
    }

    console.log(`기록: ${out}`)
    if (report.rowsOmitted > 0) {
      console.log(
        `  판별 기록 ${report.rowsOmitted.toLocaleString('ko-KR')}줄은 싣지 않았습니다 ` +
          `(${BatchRunner.ROW_LIMIT.toLocaleString('ko-KR')}줄 넘음). 집계만 들어 있습니다.`,
      )
    }
  }

  private static reportSummary(summary: BatchSummary): void {
    const { days } = summary
    console.log(`■ ${summary.policy} (${summary.runs}판)`)
    console.log(
      `  생존 일수  평균 ${days.mean} · 중앙 ${days.median} · ` +
        `사분위 ${days.p25}–${days.p75} · 최소 ${days.min} · 최대 ${days.max}`,
    )
    console.log(`  해결 이슈  평균 ${summary.solvedIssues.mean} · 중앙 ${summary.solvedIssues.median}`)
    console.log(`  최종 이용자 중앙 ${summary.users.median} · 품질 중앙 ${summary.quality.median}`)

    const ranked = Object.entries(summary.results).sort((a, b) => b[1] - a[1])
    for (const [result, count] of ranked) {
      const share = ((count / summary.runs) * 100).toFixed(1)
      console.log(`  ${result.padEnd(16)} ${String(count).padStart(5)}  ${share.padStart(5)}%`)
    }
    console.log('')
  }
}

new Cli(process.argv.slice(2)).execute()
