import { WorldObject } from '../base/WorldObject'

export class Bookshelf extends WorldObject {
  constructor() {
    super('bookshelf', 110, 64, 34, 62, { x: 110, y: 68, facing: 'back' })
  }
}
