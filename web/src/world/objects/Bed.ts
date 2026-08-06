import { WorldObject } from '../base/WorldObject'

export class Bed extends WorldObject {
  constructor() {
    super(
      'bed',
      152,
      152,
      56,
      64,
      { x: 152, y: 156, facing: 'back' },
      { left: 124, right: 180, top: 106, bottom: 152 },
    )
  }
}
