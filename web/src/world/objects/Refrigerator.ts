import { WorldObject } from '../base/WorldObject'
import { session } from '@/core/Session'

export class Refrigerator extends WorldObject {
  constructor() {
    super('refrigerator', 141, 64, 46, 58, { x: 141, y: 68, facing: 'back' }, null, { x: 0, y: 0 }, 58)
  }

  override onInteract(): void {
    session.openActionMenu(session.menus.refrigerator)
  }
}
