import { WorldObject } from '../base/WorldObject'
import { session } from '@/core/Session'

export class Door extends WorldObject {
  constructor() {
    // 그림이 벽선보다 살짝 떠 보여서 2만큼 내려 그립니다.
    super('door', 52, 64, 43, 56, { x: 52, y: 68, facing: 'back' }, null, { x: 0, y: 2 }, 56)
  }

  override onInteract(): void {
    session.openActionMenu(session.menus.door)
  }
}
