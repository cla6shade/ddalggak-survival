/** 캔버스에 스스로를 그릴 수 있는 것. 어떻게 그릴지는 각자 정합니다. */
export interface Drawable {
  draw(ctx: CanvasRenderingContext2D): void
}
