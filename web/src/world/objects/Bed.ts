import { WorldObject } from '../base/WorldObject'
import { BED_MENU } from '@/game/actions/RoomActionCatalog'
import { session } from '@/core/Session'

export class Bed extends WorldObject {
  constructor() {
    super(
      'bed',
      138,
      152,
      56,
      64,
      { x: 138, y: 156, facing: 'back' },
      { left: 110, right: 166, top: 106, bottom: 152 },
      { x: 0, y: 0 },
      64,
    )
  }

  override onInteract(): void {
    session.openActionMenu(BED_MENU)
  }
}
