import type {
  ActiveWorkspace,
  CreateWorkspaceBranchRequest,
  ManagedWorkspaceBranch,
  UpdateWorkspaceBranchRequest,
} from '@kitchenflow/contracts'

export type WorkspaceRepository = {
  switchBranch(input: { branchId: string; userId: string }): Promise<ActiveWorkspace>
  listBranches(userId: string): Promise<ManagedWorkspaceBranch[]>
  createBranch(input: {
    userId: string
    branch: CreateWorkspaceBranchRequest
  }): Promise<ManagedWorkspaceBranch>
  updateBranch(input: {
    userId: string
    branchId: string
    branch: UpdateWorkspaceBranchRequest
  }): Promise<ManagedWorkspaceBranch>
  updateBranchStatus(input: {
    userId: string
    branchId: string
    isActive: boolean
  }): Promise<ManagedWorkspaceBranch>
}
