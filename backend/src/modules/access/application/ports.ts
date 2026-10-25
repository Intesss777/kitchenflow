import type {
  WorkspaceMember,
  WorkspaceMembersQuery,
  WorkspaceMembersResponse,
  WorkspaceRole,
  UpdateWorkspaceMemberBranchAccessRequest,
} from '@kitchenflow/contracts'

export type WorkspaceAccessRepository = {
  listMembers(actorUserId: string, query: WorkspaceMembersQuery): Promise<WorkspaceMembersResponse>
  updateMemberRole(input: {
    actorUserId: string
    membershipId: string
    role: WorkspaceRole
    now: Date
  }): Promise<WorkspaceMember>
  updateMemberBranchAccess(input: {
    actorUserId: string
    membershipId: string
    access: UpdateWorkspaceMemberBranchAccessRequest
  }): Promise<WorkspaceMember>
}

export type Clock = { now(): Date }
