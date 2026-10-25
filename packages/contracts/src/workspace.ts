import { z } from 'zod'

import { emailSchema } from './identity'

export const workspaceRoleSchema = z.enum(['owner', 'chef', 'administrator'])

export const workspaceBranchSchema = z
  .object({
    id: z.uuid(),
    name: z.string().min(1),
  })
  .strict()

export const managedWorkspaceBranchSchema = z
  .object({
    id: z.uuid(),
    name: z.string().min(1),
    address: z.string().nullable(),
    timezone: z.string().min(1),
    isActive: z.boolean(),
  })
  .strict()

export const activeWorkspaceSchema = z
  .object({
    organizationId: z.uuid(),
    organizationName: z.string().min(1),
    branchId: z.uuid(),
    branchName: z.string().min(1),
    role: workspaceRoleSchema,
    availableBranches: z.array(workspaceBranchSchema).min(1),
  })
  .strict()

export const workspaceMemberSchema = z
  .object({
    id: z.uuid(),
    userId: z.uuid(),
    email: emailSchema,
    displayName: z.string().nullable(),
    role: workspaceRoleSchema,
    branchAccess: z
      .object({
        allBranches: z.boolean(),
        branchIds: z.array(z.uuid()),
      })
      .strict(),
    createdAt: z.string().datetime(),
  })
  .strict()

const positiveIntegerQuerySchema = (defaultValue: number, maximum?: number) =>
  z.coerce.number().int().positive().max(maximum ?? Number.MAX_SAFE_INTEGER).default(defaultValue)

export const WORKSPACE_MEMBERS_MAX_PAGE = 100

export const workspaceMembersQuerySchema = z
  .object({
    q: z.preprocess(
      (value) => (typeof value === 'string' && value.trim() === '' ? undefined : value),
      z.string().trim().max(100).optional(),
    ),
    page: positiveIntegerQuerySchema(1, WORKSPACE_MEMBERS_MAX_PAGE),
    pageSize: positiveIntegerQuerySchema(20, 100),
  })
  .strict()

export const workspaceMembersResponseSchema = z
  .object({
    items: z.array(workspaceMemberSchema),
    page: z.number().int().positive().max(WORKSPACE_MEMBERS_MAX_PAGE),
    pageSize: z.number().int().positive().max(100),
    total: z.number().int().nonnegative(),
    hasNext: z.boolean(),
    branches: z.array(workspaceBranchSchema),
  })
  .strict()

export const workspaceMemberParamsSchema = z
  .object({ membershipId: z.uuid() })
  .strict()

export const updateWorkspaceMemberRoleRequestSchema = z
  .object({ role: workspaceRoleSchema })
  .strict()

export const updateWorkspaceMemberRoleResponseSchema = z
  .object({ member: workspaceMemberSchema })
  .strict()

export const updateWorkspaceMemberBranchAccessRequestSchema = z
  .object({
    allBranches: z.boolean(),
    branchIds: z.array(z.uuid()).max(100),
  })
  .strict()
  .superRefine((value, context) => {
    if (!value.allBranches && value.branchIds.length === 0) {
      context.addIssue({
        code: 'custom',
        message: 'Choose at least one branch',
        path: ['branchIds'],
      })
    }
  })

export const updateWorkspaceMemberBranchAccessResponseSchema = z
  .object({ member: workspaceMemberSchema })
  .strict()

export const switchWorkspaceBranchRequestSchema = z
  .object({ branchId: z.uuid() })
  .strict()

export const switchWorkspaceBranchResponseSchema = z
  .object({ workspace: activeWorkspaceSchema })
  .strict()

const branchNameSchema = z.string().trim().min(1).max(100)
const branchAddressSchema = z.preprocess(
  (value) => (typeof value === 'string' && value.trim() === '' ? null : value),
  z.string().trim().max(200).nullable(),
)

export const workspaceBranchesResponseSchema = z
  .object({ items: z.array(managedWorkspaceBranchSchema) })
  .strict()

export const createWorkspaceBranchRequestSchema = z
  .object({ name: branchNameSchema, address: branchAddressSchema })
  .strict()

export const updateWorkspaceBranchRequestSchema = createWorkspaceBranchRequestSchema

export const workspaceBranchParamsSchema = z
  .object({ branchId: z.uuid() })
  .strict()

export const updateWorkspaceBranchStatusRequestSchema = z
  .object({ isActive: z.boolean() })
  .strict()

export const workspaceBranchResponseSchema = z
  .object({ branch: managedWorkspaceBranchSchema })
  .strict()

export type WorkspaceRole = z.infer<typeof workspaceRoleSchema>
export type WorkspaceBranch = z.infer<typeof workspaceBranchSchema>
export type ManagedWorkspaceBranch = z.infer<typeof managedWorkspaceBranchSchema>
export type ActiveWorkspace = z.infer<typeof activeWorkspaceSchema>
export type WorkspaceMember = z.infer<typeof workspaceMemberSchema>
export type WorkspaceMembersQuery = z.infer<typeof workspaceMembersQuerySchema>
export type WorkspaceMembersResponse = z.infer<typeof workspaceMembersResponseSchema>
export type UpdateWorkspaceMemberRoleRequest = z.infer<
  typeof updateWorkspaceMemberRoleRequestSchema
>
export type UpdateWorkspaceMemberRoleResponse = z.infer<
  typeof updateWorkspaceMemberRoleResponseSchema
>
export type UpdateWorkspaceMemberBranchAccessRequest = z.infer<
  typeof updateWorkspaceMemberBranchAccessRequestSchema
>
export type UpdateWorkspaceMemberBranchAccessResponse = z.infer<
  typeof updateWorkspaceMemberBranchAccessResponseSchema
>
export type SwitchWorkspaceBranchRequest = z.infer<typeof switchWorkspaceBranchRequestSchema>
export type SwitchWorkspaceBranchResponse = z.infer<typeof switchWorkspaceBranchResponseSchema>
export type WorkspaceBranchesResponse = z.infer<typeof workspaceBranchesResponseSchema>
export type CreateWorkspaceBranchRequest = z.infer<typeof createWorkspaceBranchRequestSchema>
export type UpdateWorkspaceBranchRequest = z.infer<typeof updateWorkspaceBranchRequestSchema>
export type UpdateWorkspaceBranchStatusRequest = z.infer<
  typeof updateWorkspaceBranchStatusRequestSchema
>
export type WorkspaceBranchResponse = z.infer<typeof workspaceBranchResponseSchema>
