-- CreateEnum
CREATE TYPE "staff_event_type" AS ENUM ('lateness', 'fine');

-- CreateTable
CREATE TABLE "staff_employees" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "organization_id" UUID NOT NULL,
    "branch_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "position" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "staff_employees_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "staff_events" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "organization_id" UUID NOT NULL,
    "branch_id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "created_by_user_id" UUID,
    "type" "staff_event_type" NOT NULL,
    "occurred_on" DATE NOT NULL,
    "arrival_time" TEXT,
    "fine_amount" DECIMAL(14,2),
    "reason" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "staff_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "staff_employees_organization_id_is_active_idx" ON "staff_employees"("organization_id", "is_active");

-- CreateIndex
CREATE INDEX "staff_employees_branch_id_is_active_idx" ON "staff_employees"("branch_id", "is_active");

-- CreateIndex
CREATE INDEX "staff_events_branch_id_occurred_on_idx" ON "staff_events"("branch_id", "occurred_on");

-- CreateIndex
CREATE INDEX "staff_events_employee_id_occurred_on_idx" ON "staff_events"("employee_id", "occurred_on");

-- CreateIndex
CREATE INDEX "staff_events_created_by_user_id_idx" ON "staff_events"("created_by_user_id");

-- AddForeignKey
ALTER TABLE "staff_employees" ADD CONSTRAINT "staff_employees_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_employees" ADD CONSTRAINT "staff_employees_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_events" ADD CONSTRAINT "staff_events_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_events" ADD CONSTRAINT "staff_events_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_events" ADD CONSTRAINT "staff_events_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "staff_employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_events" ADD CONSTRAINT "staff_events_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
