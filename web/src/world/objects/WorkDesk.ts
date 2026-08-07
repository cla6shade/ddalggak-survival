import { WorldObject } from '../base/WorldObject'

export class WorkDesk extends WorldObject {
  constructor() {
    super(
      'work_desk',
      58,
      134,
      64,
      52,
      { x: 58, y: 138, facing: 'back' },
      { left: 26, right: 90, top: 116, bottom: 134 },
      { x: 0, y: 0 },
      64,
    )
  }
}
