// 바닥 길찾기.
//
// 캐릭터의 위치는 **발**입니다. 그래서 충돌도 발이 딛는 바닥 면에서만 봅니다 —
// 상체는 물건과 겹쳐도 되고, 겹칠 때 누가 앞인지는 깊이 정렬(y 기준)이 정합니다.
//
// 격자 위 너비우선탐색입니다. 이웃을 상하좌우 넷으로만 두면 나오는 경로가 애초에
// 축에 정렬돼서, 대각선으로 걷지 않는다는 규칙이 길찾기 단계에서 지켜집니다.

import type { Point } from './geometry/Point'
import type { Rect } from './geometry/Rect'

/**
 * 격자 한 칸의 크기(방 좌표계). 1 이라 좌표↔칸 변환에 반올림 오차가 없습니다 —
 * 키우면 정해 둔 도착 위치에 정확히 설 수 없게 됩니다.
 */
const CELL = 1

const NEIGHBOURS: readonly (readonly [number, number])[] = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
]

/** 걷는 놈이 바닥에서 차지하는 면의 절반. 장애물을 이만큼 부풀려 둡니다. */
export interface FootPrint {
  halfWidth: number
  halfDepth: number
}

export class Navigation {
  private readonly floor: Rect
  private readonly columns: number
  private readonly rows: number
  private readonly blocked: Uint8Array

  constructor(floor: Rect, blockers: readonly Rect[], foot: FootPrint) {
    this.floor = floor
    this.columns = Math.max(1, Math.ceil((floor.right - floor.left) / CELL))
    this.rows = Math.max(1, Math.ceil((floor.bottom - floor.top) / CELL))
    this.blocked = new Uint8Array(this.columns * this.rows)

    for (const blocker of blockers) {
      // 장애물을 발 상자만큼 부풀려 두면 경로는 발의 중심점만 보면 됩니다.
      const fromColumn = this.toColumn(blocker.left - foot.halfWidth)
      const toColumn = this.toColumn(blocker.right + foot.halfWidth)
      const fromRow = this.toRow(blocker.top - foot.halfDepth)
      const toRow = this.toRow(blocker.bottom + foot.halfDepth)

      for (let row = fromRow; row <= toRow; row += 1) {
        for (let column = fromColumn; column <= toColumn; column += 1) {
          if (this.isInside(column, row)) this.blocked[row * this.columns + column] = 1
        }
      }
    }
  }

  isWalkable(point: Point): boolean {
    const column = this.toColumn(point.x)
    const row = this.toRow(point.y)

    return this.isInside(column, row) && this.blocked[row * this.columns + column] === 0
  }

  /** 막힌 자리를 가리켰을 때 가장 가까운 설 수 있는 칸. */
  findNearestWalkable(point: Point): Point {
    if (this.isWalkable(point)) return point

    const startColumn = this.toColumn(point.x)
    const startRow = this.toRow(point.y)
    let best: Point | undefined
    let bestDistance = Infinity

    for (let row = 0; row < this.rows; row += 1) {
      for (let column = 0; column < this.columns; column += 1) {
        if (this.blocked[row * this.columns + column] === 1) continue

        const distance = (column - startColumn) ** 2 + (row - startRow) ** 2
        if (distance < bestDistance) {
          bestDistance = distance
          best = this.getCellCenter(column, row)
        }
      }
    }

    return best ?? point
  }

  /**
   * 축에 정렬된 웨이포인트 목록. 갈 수 없으면 빈 배열입니다.
   * 같은 방향으로 이어지는 칸은 하나로 합쳐서, 한 다리가 한 번의 걸음이 됩니다.
   */
  findPath(from: Point, to: Point): Point[] {
    const startColumn = this.toColumn(from.x)
    const startRow = this.toRow(from.y)
    const goalColumn = this.toColumn(to.x)
    const goalRow = this.toRow(to.y)
    if (!this.isInside(startColumn, startRow) || !this.isInside(goalColumn, goalRow)) return []

    const total = this.columns * this.rows
    const cameFrom = new Int32Array(total).fill(-1)
    const seen = new Uint8Array(total)
    const startIndex = startRow * this.columns + startColumn
    const goalIndex = goalRow * this.columns + goalColumn

    const queue: number[] = [startIndex]
    seen[startIndex] = 1
    let head = 0
    let found = false

    while (head < queue.length) {
      const index = queue[head] as number
      head += 1
      if (index === goalIndex) {
        found = true
        break
      }

      const column = index % this.columns
      const row = (index - column) / this.columns

      for (const [dx, dy] of NEIGHBOURS) {
        const nextColumn = column + dx
        const nextRow = row + dy
        if (!this.isInside(nextColumn, nextRow)) continue

        const next = nextRow * this.columns + nextColumn
        if (seen[next] === 1 || this.blocked[next] === 1) continue

        seen[next] = 1
        cameFrom[next] = index
        queue.push(next)
      }
    }

    if (!found) return []

    const cells: number[] = []
    for (let index = goalIndex; index !== -1; index = cameFrom[index] as number) {
      cells.push(index)
      if (index === startIndex) break
    }
    cells.reverse()

    return this.compressPath(cells)
  }

  /** 같은 방향으로 이어지는 칸을 하나의 꺾이는 점으로 줄입니다. */
  private compressPath(cells: number[]): Point[] {
    const points: Point[] = []
    let previousDx = 0
    let previousDy = 0

    for (let index = 1; index < cells.length; index += 1) {
      const current = cells[index] as number
      const before = cells[index - 1] as number
      const dx = Math.sign((current % this.columns) - (before % this.columns))
      const dy = Math.sign(
        Math.floor(current / this.columns) - Math.floor(before / this.columns),
      )

      if ((dx !== previousDx || dy !== previousDy) && index > 1) {
        const column = before % this.columns
        points.push(this.getCellCenter(column, (before - column) / this.columns))
      }

      previousDx = dx
      previousDy = dy
    }

    const last = cells[cells.length - 1]
    if (last !== undefined) {
      const column = last % this.columns
      points.push(this.getCellCenter(column, (last - column) / this.columns))
    }

    return points
  }

  private getCellCenter(column: number, row: number): Point {
    return {
      x: this.floor.left + column * CELL + CELL / 2,
      y: this.floor.top + row * CELL + CELL / 2,
    }
  }

  private toColumn(x: number): number {
    return Math.round((x - this.floor.left - CELL / 2) / CELL)
  }

  private toRow(y: number): number {
    return Math.round((y - this.floor.top - CELL / 2) / CELL)
  }

  private isInside(column: number, row: number): boolean {
    return column >= 0 && column < this.columns && row >= 0 && row < this.rows
  }
}
