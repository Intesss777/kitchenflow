import type {
  ActiveWorkspace,
  ManagedWorkspaceBranch,
  WorkspaceRole,
} from '@kitchenflow/contracts'

import type { DbClient } from '../../../db'
import { Prisma } from '../../../generated/prisma/client'
import type { WorkspaceRepository } from '../application/ports'
import { WorkspaceFailure } from '../domain/errors'

export type ResolvedWorkspace = ActiveWorkspace & {
  membershipId: string
  timezone: string
}

const membershipWorkspaceSelect = {
  id: true,
  activeBranchId: true,
  organizationId: true,
  role: true,
  branchAccesses: {
    where: { branch: { isActive: true } },
    select: {
      branch: {
        select: { id: true, name: true, organizationId: true, timezone: true },
      },
    },
  },
  organization: {
    select: {
      id: true,
      name: true,
      branches: {
        where: { isActive: true },
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        select: { id: true, name: true, organizationId: true, timezone: true },
      },
    },
  },
} satisfies Prisma.OrganizationMembershipSelect

const managedBranchSelect = {
  id: true,
  name: true,
  address: true,
  timezone: true,
  isActive: true,
} satisfies Prisma.BranchSelect

export async function resolveActiveWorkspace(
  db: Pick<DbClient, 'organizationMembership'>,
  userId: string,
): Promise<ResolvedWorkspace | null> {
  const membership = await db.organizationMembership.findFirst({
    where: { userId },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    select: membershipWorkspaceSelect,
  })
  if (!membership) return null

  const branches = allowedBranches(membership)
  const activeBranch = branches.find((branch) => branch.id === membership.activeBranchId)
    ?? branches[0]
  if (!activeBranch) return null

  return {
    membershipId: membership.id,
    organizationId: membership.organization.id,
    organizationName: membership.organization.name,
    branchId: activeBranch.id,
    branchName: activeBranch.name,
    timezone: activeBranch.timezone,
    role: membership.role,
    availableBranches: branches.map(({ id, name }) => ({ id, name })),
  }
}

export function createPrismaWorkspaceRepository(db: DbClient): WorkspaceRepository {
  return {
    async switchBranch({ branchId, userId }) {
      return db.$transaction(async (tx) => {
        const membership = await tx.organizationMembership.findFirst({
          where: { userId },
          orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
          select: membershipWorkspaceSelect,
        })
        if (!membership) {
          throw new WorkspaceFailure('not_found', 'KitchenFlow workspace not found')
        }

        const organizationBranch = membership.organization.branches.find(
          (branch) => branch.id === branchId,
        )
        if (!organizationBranch) {
          throw new WorkspaceFailure('not_found', 'Branch not found')
        }
        if (!allowedBranches(membership).some((branch) => branch.id === branchId)) {
          throw new WorkspaceFailure('forbidden', 'You do not have access to this branch')
        }

        await tx.organizationMembership.update({
          where: { id: membership.id },
          data: { activeBranchId: branchId },
        })
        const workspace = await resolveActiveWorkspace(tx, userId)
        if (!workspace) {
          throw new WorkspaceFailure('not_found', 'KitchenFlow workspace not found')
        }
        return activeWorkspaceDto(workspace)
      })
    },

    async listBranches(userId) {
      const organizationId = await ownerOrganizationId(db, userId)
      return db.branch.findMany({
        where: { organizationId },
        orderBy: [{ isActive: 'desc' }, { createdAt: 'asc' }, { id: 'asc' }],
        select: managedBranchSelect,
      })
    },

    async createBranch({ branch, userId }) {
      const organizationId = await ownerOrganizationId(db, userId)
      try {
        return await db.branch.create({
          data: { organizationId, name: branch.name, address: branch.address },
          select: managedBranchSelect,
        })
      } catch (error) {
        throwBranchNameConflict(error)
      }
    },

    async updateBranch({ branch, branchId, userId }) {
      const organizationId = await ownerOrganizationId(db, userId)
      const existing = await db.branch.findFirst({
        where: { id: branchId, organizationId },
        select: { id: true },
      })
      if (!existing) throw new WorkspaceFailure('not_found', 'Branch not found')
      try {
        return await db.branch.update({
          where: { id: branchId },
          data: { name: branch.name, address: branch.address },
          select: managedBranchSelect,
        })
      } catch (error) {
        throwBranchNameConflict(error)
      }
    },

    async updateBranchStatus({ branchId, isActive, userId }) {
      return db.$transaction(async (tx) => {
        const organizationId = await ownerOrganizationId(tx, userId)
        await tx.$queryRaw(
          Prisma.sql`SELECT id FROM organizations WHERE id = ${organizationId}::uuid FOR UPDATE`,
        )
        const branch = await tx.branch.findFirst({
          where: { id: branchId, organizationId },
          select: managedBranchSelect,
        })
        if (!branch) throw new WorkspaceFailure('not_found', 'Branch not found')
        if (branch.isActive === isActive) return branch
        if (isActive) {
          return tx.branch.update({
            where: { id: branchId },
            data: { isActive: true },
            select: managedBranchSelect,
          })
        }

        const fallbackBranch = await tx.branch.findFirst({
          where: { organizationId, isActive: true, id: { not: branchId } },
          orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
          select: { id: true },
        })
        if (!fallbackBranch) {
          throw new WorkspaceFailure('conflict', 'At least one active branch must remain')
        }

        const restrictedMemberships = await tx.organizationMembership.findMany({
          where: {
            organizationId,
            role: { not: 'owner' },
            branchAccesses: { some: { branchId } },
          },
          select: {
            id: true,
            branchAccesses: {
              where: {
                branchId: { not: branchId },
                branch: { isActive: true },
              },
              select: { branchId: true },
            },
          },
        })
        if (restrictedMemberships.some((membership) => membership.branchAccesses.length === 0)) {
          throw new WorkspaceFailure(
            'conflict',
            'Reassign members who only have access to this branch before archiving it',
          )
        }

        const affectedMemberships = await tx.organizationMembership.findMany({
          where: { organizationId, activeBranchId: branchId },
          select: {
            id: true,
            role: true,
            branchAccesses: {
              where: {
                branchId: { not: branchId },
                branch: { isActive: true },
              },
              select: { branchId: true },
            },
          },
        })
        for (const membership of affectedMemberships) {
          const replacementBranchId = membership.role === 'owner'
            || membership.branchAccesses.length === 0
            ? fallbackBranch.id
            : membership.branchAccesses[0]!.branchId
          await tx.organizationMembership.update({
            where: { id: membership.id },
            data: { activeBranchId: replacementBranchId },
          })
        }
        await tx.organizationMembershipBranch.deleteMany({ where: { branchId } })
        return tx.branch.update({
          where: { id: branchId },
          data: { isActive: false },
          select: managedBranchSelect,
        })
      })
    },
  }
}

export function activeWorkspaceDto(workspace: ResolvedWorkspace): ActiveWorkspace {
  const { membershipId: _membershipId, timezone: _timezone, ...activeWorkspace } = workspace
  return activeWorkspace
}

function allowedBranches(membership: {
  role: WorkspaceRole
  organizationId: string
  organization: {
    branches: Array<{ id: string; name: string; organizationId: string; timezone: string }>
  }
  branchAccesses: Array<{
    branch: { id: string; name: string; organizationId: string; timezone: string }
  }>
}) {
  const explicitBranchIds = new Set(
    membership.branchAccesses
      .map(({ branch }) => branch)
      .filter((branch) => branch.organizationId === membership.organizationId)
      .map((branch) => branch.id),
  )
  const explicitBranches = membership.organization.branches.filter((branch) =>
    explicitBranchIds.has(branch.id),
  )
  if (membership.role !== 'owner' && explicitBranches.length > 0) return explicitBranches
  return membership.organization.branches
}

async function ownerOrganizationId(
  db: Pick<DbClient, 'organizationMembership'>,
  userId: string,
) {
  const membership = await db.organizationMembership.findFirst({
    where: { userId, role: 'owner' },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    select: { organizationId: true },
  })
  if (!membership) throw new WorkspaceFailure('forbidden', 'Owner access is required')
  return membership.organizationId
}

function throwBranchNameConflict(error: unknown): never {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
    throw new WorkspaceFailure('conflict', 'A branch with this name already exists')
  }
  throw error
}
