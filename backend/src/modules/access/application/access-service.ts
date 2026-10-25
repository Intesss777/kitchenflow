import type {
  UpdateWorkspaceMemberRoleRequest,
  UpdateWorkspaceMemberBranchAccessRequest,
  WorkspaceMembersQuery,
} from '@kitchenflow/contracts'

import type { Clock, WorkspaceAccessRepository } from './ports'

export class AccessService {
  constructor(
    private readonly dependencies: {
      clock: Clock
      repository: WorkspaceAccessRepository
    },
  ) {}

  listMembers(actorUserId: string, query: WorkspaceMembersQuery) {
    return this.dependencies.repository.listMembers(actorUserId, query)
  }

  async updateMemberRole(
    actorUserId: string,
    membershipId: string,
    input: UpdateWorkspaceMemberRoleRequest,
  ) {
    return {
      member: await this.dependencies.repository.updateMemberRole({
        actorUserId,
        membershipId,
        role: input.role,
        now: this.dependencies.clock.now(),
      }),
    }
  }

  async updateMemberBranchAccess(
    actorUserId: string,
    membershipId: string,
    input: UpdateWorkspaceMemberBranchAccessRequest,
  ) {
    return {
      member: await this.dependencies.repository.updateMemberBranchAccess({
        actorUserId,
        membershipId,
        access: input,
      }),
    }
  }
}
