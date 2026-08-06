import { WorldObject } from '../base/WorldObject'

export class Refrigerator extends WorldObject {
  constructor() {
    super('refrigerator', 152, 64, 46, 58, { x: 152, y: 68, facing: 'back' })
  }
}
