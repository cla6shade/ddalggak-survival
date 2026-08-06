/** 프레임마다 시간을 받아 상태를 진행시키는 것. */
export interface Updatable {
  update(delta: number): void
}
