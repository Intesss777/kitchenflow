import type {
  CreateWorkspaceBranchRequest,
  SwitchWorkspaceBranchRequest,
  UpdateWorkspaceBranchRequest,
  UpdateWorkspaceBranchStatusRequest,
} from '@kitchenflow/contracts'

import type { WorkspaceRepository } from './ports'

export class WorkspaceService {
  constructor(private readonly repository: WorkspaceRepository) {}

  async switchBranch(userId: string, input: SwitchWorkspaceBranchRequest) {
    return { workspace: await this.repository.switchBranch({ userId, branchId: input.branchId }) }
  }

  async listBranches(userId: string) {
    return { items: await this.repository.listBranches(userId) }
  }

  async createBranch(userId: string, input: CreateWorkspaceBranchRequest) {
    return { branch: await this.repository.createBranch({ userId, branch: input }) }
  }

  async updateBranch(
    userId: string,
    branchId: string,
    input: UpdateWorkspaceBranchRequest,
  ) {
    return { branch: await this.repository.updateBranch({ userId, branchId, branch: input }) }
  }

  async updateBranchStatus(
    userId: string,
    branchId: string,
    input: UpdateWorkspaceBranchStatusRequest,
  ) {
    return {
      branch: await this.repository.updateBranchStatus({
        userId,
        branchId,
        isActive: input.isActive,
      }),
    }
  }
}
