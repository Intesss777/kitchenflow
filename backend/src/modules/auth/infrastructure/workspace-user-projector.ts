import type { UserDto } from '@kitchenflow/contracts'

import type { DbClient } from '../../../db'
import type { AuthUserRecord } from '../domain/user'
import { toBaseUserDto } from '../domain/user'
import { activeWorkspaceDto, resolveActiveWorkspace } from '../../workspace'

export function createWorkspaceUserProjector(db: DbClient) {
  return async (user: AuthUserRecord): Promise<UserDto> => {
    const workspace = await resolveActiveWorkspace(db, user.id)

    return {
      ...toBaseUserDto(user),
      workspace: workspace ? activeWorkspaceDto(workspace) : null,
    }
  }
}
