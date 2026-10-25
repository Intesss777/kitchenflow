import {
  WORKSPACE_MEMBERS_MAX_PAGE,
  type WorkspaceMember,
  type WorkspaceMembersQuery,
} from '@kitchenflow/contracts'

import {
  acquireUserRoleMutationLock,
  type DbClient,
  userAuthorityTransitionTransactionOptions,
} from '../../../db'
import type { WorkspaceAccessRepository } from '../application/ports'
import { AccessFailure } from '../domain/errors'

const memberSelect = {
  id: true,
  userId: true,
  role: true,
  branchAccesses: {
    orderBy: { branchId: 'asc' as const },
    select: { branchId: true },
  },
  createdAt: true,
  user: { select: { email: true, displayName: true } },
} as const

export function createPrismaAccessRepository(db: DbClient): WorkspaceAccessRepository {
  return {
    async listMembers(actorUserId, { page, pageSize, q }: WorkspaceMembersQuery) {
      const actor = await ownerMembership(db, actorUserId)
      const where = {
        organizationId: actor.organizationId,
        ...(q
          ? {
              user: {
                OR: [
                  { email: { contains: q, mode: 'insensitive' as const } },
                  { displayName: { contains: q, mode: 'insensitive' as const } },
                ],
              },
            }
          : {}),
      }
      const [total, memberships, branches] = await db.$transaction([
        db.organizationMembership.count({ where }),
        db.organizationMembership.findMany({
          where,
          orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
          skip: (page - 1) * pageSize,
          take: pageSize,
          select: memberSelect,
        }),
        db.branch.findMany({
          where: { organizationId: actor.organizationId, isActive: true },
          orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
          select: { id: true, name: true },
        }),
      ])
      return {
        items: memberships.map(toMember),
        page,
        pageSize,
        total,
        hasNext: page < WORKSPACE_MEMBERS_MAX_PAGE && page * pageSize < total,
        branches,
      }
    },

    updateMemberRole(input) {
      return db.$transaction(async (tx) => {
        await acquireUserRoleMutationLock(tx)
        const actor = await ownerMembership(tx, input.actorUserId)
        const target = await tx.organizationMembership.findFirst({
          where: { id: input.membershipId, organizationId: actor.organizationId },
          select: memberSelect,
        })
        if (!target) throw new AccessFailure('not_found', 'Workspace member not found')
        if (target.role === input.role) return toMember(target)
        if (target.userId === input.actorUserId && input.role !== 'owner') {
          throw new AccessFailure('role_conflict', 'You cannot remove your own owner role')
        }
        if (target.role === 'owner' && input.role !== 'owner') {
          const ownerCount = await tx.organizationMembership.count({
            where: { organizationId: actor.organizationId, role: 'owner' },
          })
          if (ownerCount <= 1) {
            throw new AccessFailure('role_conflict', 'At least one owner must remain')
          }
        }

        const updated = await tx.organizationMembership.update({
          where: { id: target.id },
          data: {
            role: input.role,
            ...(input.role === 'owner' ? { branchAccesses: { deleteMany: {} } } : {}),
          },
          select: memberSelect,
        })
        await tx.authSession.updateMany({
          where: { userId: target.userId, revokedAt: null },
          data: { revokedAt: input.now },
        })
        return toMember(updated)
      }, userAuthorityTransitionTransactionOptions)
    },

    updateMemberBranchAccess(input) {
      return db.$transaction(async (tx) => {
        await acquireUserRoleMutationLock(tx)
        const actor = await ownerMembership(tx, input.actorUserId)
        const target = await tx.organizationMembership.findFirst({
          where: { id: input.membershipId, organizationId: actor.organizationId },
          select: memberSelect,
        })
        if (!target) throw new AccessFailure('not_found', 'Workspace member not found')
        if (target.role === 'owner') {
          throw new AccessFailure('role_conflict', 'Owners always have access to all branches')
        }

        const branchIds = [...new Set(input.access.branchIds)]
        if (!input.access.allBranches) {
          const branchCount = await tx.branch.count({
            where: {
              id: { in: branchIds },
              organizationId: actor.organizationId,
              isActive: true,
            },
          })
          if (branchCount !== branchIds.length) {
            throw new AccessFailure('not_found', 'One or more branches were not found')
          }
        }

        await tx.organizationMembershipBranch.deleteMany({
          where: { membershipId: target.id },
        })
        if (!input.access.allBranches) {
          await tx.organizationMembershipBranch.createMany({
            data: branchIds.map((branchId) => ({ membershipId: target.id, branchId })),
          })
          await tx.organizationMembership.updateMany({
            where: {
              id: target.id,
              OR: [
                { activeBranchId: null },
                { activeBranchId: { notIn: branchIds } },
              ],
            },
            data: { activeBranchId: branchIds[0] },
          })
        }
        const updated = await tx.organizationMembership.findUniqueOrThrow({
          where: { id: target.id },
          select: memberSelect,
        })
        return toMember(updated)
      }, userAuthorityTransitionTransactionOptions)
    },
  }
}

async function ownerMembership(
  db: Pick<DbClient, 'organizationMembership'>,
  userId: string,
) {
  const membership = await db.organizationMembership.findFirst({
    where: { userId, role: 'owner' },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    select: { organizationId: true },
  })
  if (!membership) throw new AccessFailure('forbidden', 'Owner access is required')
  return membership
}

function toMember(member: {
  id: string
  userId: string
  role: 'owner' | 'chef' | 'administrator'
  branchAccesses: Array<{ branchId: string }>
  createdAt: Date
  user: { email: string; displayName: string | null }
}): WorkspaceMember {
  return {
    id: member.id,
    userId: member.userId,
    email: member.user.email,
    displayName: member.user.displayName,
    role: member.role,
    branchAccess: {
      allBranches: member.role === 'owner' || member.branchAccesses.length === 0,
      branchIds: member.role === 'owner'
        ? []
        : member.branchAccesses.map(({ branchId }) => branchId),
    },
    createdAt: member.createdAt.toISOString(),
  }
}
