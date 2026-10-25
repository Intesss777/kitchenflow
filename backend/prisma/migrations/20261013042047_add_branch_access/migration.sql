-- AlterTable
ALTER TABLE "organization_memberships" ADD COLUMN     "active_branch_id" UUID;

-- CreateTable
CREATE TABLE "organization_membership_branches" (
    "membership_id" UUID NOT NULL,
    "branch_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "organization_membership_branches_pkey" PRIMARY KEY ("membership_id","branch_id")
);

-- CreateIndex
CREATE INDEX "organization_membership_branches_branch_id_idx" ON "organization_membership_branches"("branch_id");

-- AddForeignKey
ALTER TABLE "organization_memberships" ADD CONSTRAINT "organization_memberships_active_branch_id_fkey" FOREIGN KEY ("active_branch_id") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_membership_branches" ADD CONSTRAINT "organization_membership_branches_membership_id_fkey" FOREIGN KEY ("membership_id") REFERENCES "organization_memberships"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_membership_branches" ADD CONSTRAINT "organization_membership_branches_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE CASCADE ON UPDATE CASCADE;
