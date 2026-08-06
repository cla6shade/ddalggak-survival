import { session } from './Session'
import type { World } from '@/world/World'
import type { Point } from '@/world/geometry/Point'

/** 한 프레임 간격이 이보다 크면 잘라냅니다 (초). 탭 복귀 시의 점프 방지. */
const MAX_DELTA = 0.1

/** 이보다 촘촘한 화면은 따라가지 않습니다. 배후 버퍼가 쓸데없이 커집니다. */
const MAX_PIXEL_RATIO = 3

/** 방을 확대하는 배율의 범위. 정수만 씁니다. */
const MINIMUM_SCALE = 2
const MAXIMUM_SCALE = 5

/** 방이 화면 세로에서 차지할 최대 비율. 위아래에 UI 가 앉을 자리를 남깁니다. */
const ROOM_HEIGHT_SHARE = 0.56

/**
 * 캔버스 한 장과 그 위의 프레임 루프를 소유합니다. 매 프레임 월드를 그립니다.
 *
 * 컨텍스트 좌표계는 **방 좌표**입니다. 화면에 맞춰 늘이지 않고 디바이스 픽셀 기준
 * 정수 배율로만 확대하므로, 어떤 화면에서도 도트가 뭉개지지 않습니다.
 */
export class GameCanvas {
  readonly element: HTMLCanvasElement
  readonly ctx: CanvasRenderingContext2D

  /** CSS 픽셀 기준 화면 크기. 포인터 좌표를 옮길 때 씁니다. */
  width = 0
  height = 0

  /** 방 좌표 한 칸이 디바이스 픽셀 몇 개인지. 정수입니다. */
  zoom = 1
  /** 방 (0, 0) 이 놓이는 디바이스 픽셀 위치. */
  originX = 0
  originY = 0

  /** 화면에 보이는 범위 (방 좌표). 방보다 넓으면 벽·바닥이 그 밖까지 흘러갑니다. */
  viewLeft = 0
  viewTop = 0
  viewWidth = 0
  viewHeight = 0

  /** 시작 이후 누적된 시간 (초). clamp 된 delta 의 합이라 벽시계와 다릅니다. */
  elapsed = 0
  /** 직전 프레임 간격 (초). 첫 프레임은 0. */
  delta = 0
  frame = 0
  running = false

  private rafId = 0
  private last: number | null = null

  private readonly world: World

  constructor(element: HTMLCanvasElement, world: World) {
    const ctx = element.getContext('2d')
    if (!ctx) throw new Error('2d 컨텍스트를 얻지 못했습니다')

    this.element = element
    this.ctx = ctx
    this.world = world
    this.onResize()
  }

  start(): void {
    if (this.running) return

    this.elapsed = 0
    this.delta = 0
    this.frame = 0
    this.last = null

    this.onResize()
    window.addEventListener('resize', this.onResize)
    this.element.addEventListener('pointerdown', this.onPointerDown)
    this.element.addEventListener('pointermove', this.onPointerMove)

    this.running = true
    this.rafId = requestAnimationFrame(this.onFrame)
  }

  stop(): void {
    if (!this.running) return

    this.running = false
    cancelAnimationFrame(this.rafId)
    window.removeEventListener('resize', this.onResize)
    this.element.removeEventListener('pointerdown', this.onPointerDown)
    this.element.removeEventListener('pointermove', this.onPointerMove)
    this.element.style.cursor = ''
    this.last = null
  }

  private onPointerDown = (event: PointerEvent): void => {
    const at = this.toWorldPoint(event)
    if (at) this.world.handleClick(at.x, at.y)
  }

  /** 누를 수 있는 것 위에서는 손가락 커서를 보여 줍니다. */
  private onPointerMove = (event: PointerEvent): void => {
    const at = this.toWorldPoint(event)
    this.element.style.cursor = at && this.world.findObjectAt(at.x, at.y) ? 'pointer' : ''
  }

  /** 포인터가 가리킨 화면 위치를 방 좌표로 옮깁니다. */
  private toWorldPoint(event: PointerEvent): Point | null {
    const rect = this.element.getBoundingClientRect()
    if (rect.width === 0 || rect.height === 0) return null

    // CSS 픽셀 → 디바이스 픽셀은 반올림된 버퍼 크기로 환산해야 어긋나지 않습니다.
    const toDeviceX = this.element.width / rect.width
    const toDeviceY = this.element.height / rect.height

    return {
      x: ((event.clientX - rect.left) * toDeviceX - this.originX) / this.zoom,
      y: ((event.clientY - rect.top) * toDeviceY - this.originY) / this.zoom,
    }
  }

  /** 배후 버퍼를 화면에 맞추고, 방을 정수 배율로 확대해 한가운데에 놓습니다. */
  private onResize = (): void => {
    const dpr = Math.min(window.devicePixelRatio || 1, MAX_PIXEL_RATIO)
    const rect = this.element.getBoundingClientRect()

    this.width = rect.width
    this.height = rect.height
    this.element.width = Math.round(rect.width * dpr)
    this.element.height = Math.round(rect.height * dpr)

    // 세로는 방이 다 차지하지 않게 몫을 줄여 잡습니다.
    const fits = Math.min(
      rect.width / this.world.width,
      (rect.height * ROOM_HEIGHT_SHARE) / this.world.height,
    )
    const scale = Math.min(Math.max(Math.floor(fits), MINIMUM_SCALE), MAXIMUM_SCALE)

    this.zoom = Math.max(1, Math.round(scale * dpr))
    this.originX = Math.round((this.element.width - this.world.width * this.zoom) / 2)
    this.originY = Math.round((this.element.height - this.world.height * this.zoom) / 2)

    this.viewLeft = -this.originX / this.zoom
    this.viewTop = -this.originY / this.zoom
    this.viewWidth = this.element.width / this.zoom
    this.viewHeight = this.element.height / this.zoom

    // width/height 를 건드리면 컨텍스트 상태가 초기화되므로 매번 다시 겁니다.
    this.ctx.setTransform(this.zoom, 0, 0, this.zoom, this.originX, this.originY)
    this.ctx.imageSmoothingEnabled = false
  }

  private onFrame = (now: number): void => {
    if (!this.running) return

    this.delta = this.last === null ? 0 : Math.min((now - this.last) / 1000, MAX_DELTA)
    this.last = now
    this.elapsed += this.delta
    this.frame += 1

    session.tick(this.delta)
    this.world.update(this.delta)

    this.ctx.clearRect(this.viewLeft, this.viewTop, this.viewWidth, this.viewHeight)
    this.world.draw(this.ctx)

    this.rafId = requestAnimationFrame(this.onFrame)
  }
}
