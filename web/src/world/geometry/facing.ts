/** 바라보는 쪽. 옆모습은 그림이 한 벌뿐이라 왼쪽은 뒤집어 씁니다. */
export type Facing = 'front' | 'back' | 'left' | 'right'

/** 옆모습 원본이 바라보는 쪽. 이 반대로 갈 때 좌우를 뒤집습니다. */
export const SIDE_SOURCE_FACING: Facing = 'right'

export function isSideFacing(facing: Facing): boolean {
  return facing === 'left' || facing === 'right'
}

/** 좌우를 뒤집어 그려야 하는지. */
export function isFlipped(facing: Facing): boolean {
  return isSideFacing(facing) && facing !== SIDE_SOURCE_FACING
}
