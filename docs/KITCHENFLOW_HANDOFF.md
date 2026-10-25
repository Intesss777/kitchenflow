# KitchenFlow continuation handoff

Updated: 2026-10-12.

This file is the compact continuation context for a fresh Codex task. Read `AGENTS.md`, then this file, `CHECKLIST.md`, and only the area guides needed for the next slice. Do not restart the project, replace the foundation, or discard existing uncommitted work.

## Product decisions

KitchenFlow is a private internal restaurant-control application, not a consumer ordering or delivery product.

Primary users:

- owner;
- chef;
- optional administrator for clients that delegate invoices, supplier debt, and stock intake.

Ordinary cooks do not sign in. Training remains intentionally small: dish photo, name, ingredients, and gram weights. There is no delivery, POS integration, production planning, quality-control platform, course system, tests, videos, step-by-step cooking, allergen workflow, or automatic payroll deduction.

The product must remain simple, premium-looking, and usable first on phones and tablets, then laptops. Client-specific modules should be additive. Each branch has isolated operational data and is billed separately.

## Implemented foundation

The checkout is `/Users/admin/Desktop/iShop`. It began from the `di-sukharev/vibe` foundation and is now branded KitchenFlow. The working tree intentionally contains many uncommitted project changes. Preserve them. Do not reset, clean, stash, switch branches, commit, or push without an explicit user request.

Implemented full-stack slices:

- authentication and separate owner/chef workspaces;
- owner operations dashboard with PostgreSQL data;
- suppliers, invoices, payments, debt, and payment history;
- inventory products, units, balances, receipts, write-offs, stocktakes, and movement history;
- purchase-invoice photo intake with private storage, demo OCR, human review, atomic stock receipt, and supplier debt posting;
- simple dish cards with private photos, ingredients and gram weights; financials visible only to the owner;
- shared purchase draft with stock context and WhatsApp handoff;
- employee directory separate from login accounts, manual lateness, manual fines, and monthly calendar;
- end-of-day sales shift: multiple receipt photos, demo OCR, reviewed dish quantities, theoretical ingredient consumption preview, and one idempotent atomic stock write-off.
- installable PWA for laptops, phones, and tablets with branded icons, standalone launch, settings guidance, and an offline fallback that never caches authenticated business data.
- active branch switching with server-side branch isolation and owner-managed per-employee branch restrictions.
- owner-managed branch lifecycle: create, rename, soft archive, and restore with history-preserving safety checks.

Important routes:

- owner: `/admin`, `/admin/inventory`, `/admin/purchases`, `/admin/invoices`, `/admin/dishes`, `/admin/shifts`, `/admin/staff`, `/admin/suppliers`, `/admin/users`;
- chef: equivalent `/app/*` routes;
- the latest completed screen is `/admin/shifts`.

`/admin/users` is labelled `Доступы`. It is for application accounts. `/admin/staff` is the employee directory and does not create logins.

## Latest slice: shift closing

Owning files:

- `packages/contracts/src/shifts.ts`;
- `backend/prisma/schema/shifts.prisma`;
- migrations `20261012041150_add_sales_shift_closing` and `20261012042035_fix_sales_shift_cascade`;
- `backend/src/modules/shifts/`;
- `webapp/src/features/shifts/`;
- `webapp/tests/sales-receipt-upload.test.ts`;
- `backend/src/modules/shifts/shifts.integration.test.ts`.

Rules that must remain load-bearing:

- receipt photos stay private and are validated by size, declared type, and file signature;
- many receipts for one branch and business date aggregate into one review shift;
- OCR is currently `demo`, never presented as production recognition;
- a human can edit dish quantities before confirmation;
- consumption is derived from the current simple dish ingredients;
- confirmation locks the shift and product balances, checks all balances first, then writes every balance, audit snapshot, and inventory movement in one transaction;
- insufficient stock rolls the whole confirmation back;
- repeated confirmation is idempotent and creates no duplicate write-offs;
- the business date comes from the branch timezone, not the device timezone;
- deleting an entire organization cascades through shift audit records, while the app itself does not physically delete ordinary products or dishes.

## Installable PWA

The production webapp exposes `/manifest.webmanifest`, branded 180/192/512 px icons, and `/sw.js`. Owners, administrators, and chefs see an installation panel in Settings. Chromium browsers can show a one-click native prompt; Apple mobile devices receive Safari home-screen instructions. The prompt is captured when the app starts, so it is still available if Settings opens later.

The service worker caches only hashed static assets and a dedicated offline page. It does not cache navigations, API responses, private uploads, or user data. KitchenFlow therefore remains an online operational system: invoice posting, inventory mutations, payments, and shift closing fail safely when the backend is unavailable.

## Local data and preview

The development seed creates the KitchenFlow organization, two branches, suppliers, ledger, inventory, purchase draft, staff events, invoices, dishes, and one review sales shift with three receipts and 41 dishes. Do not store or print local credentials in documentation; read the existing development configuration when needed.

Expected local origins:

- webapp: `http://localhost:5173`;
- backend: `http://localhost:3000`;
- PostgreSQL: Docker Compose, loopback port from the existing environment.

Verify running processes before starting duplicates. The previous task left the in-app browser on `http://localhost:5173/admin/shifts`.

Latest screenshots were saved outside the repository:

- `/private/tmp/kitchenflow-shifts-desktop.png`;
- `/private/tmp/kitchenflow-shifts-mobile.png`.

## Last verification

All passed after the role slice and the existing 14 migrations:

- webapp tests: 65 passed;
- contract tests: 34 passed;
- backend unit tests: 186 passed;
- backend integration tests: 98 passed;
- webapp production build;
- Prisma validation and clean deployment of all 14 migrations;
- architecture check;
- ESLint;
- `git diff --check`;
- browser QA for `/admin/users` at 375 and 1280 px in light and dark themes, including the empty state;
- no horizontal overflow in the reviewed access screens.

The Vite build still reports the pre-existing large vendor-chunk warning. It is not a failure and is not a reason to add a dependency.

After the branch-isolation slice, verification passed:

- contract tests: 36 passed;
- webapp tests: 71 passed;
- backend unit tests: 186 passed;
- backend integration tests: 100 passed, including active-branch switching, forbidden-branch enforcement, and safe branch lifecycle management;
- backend and webapp typechecks, ESLint, production build, architecture check, and `git diff --check`;
- eight `/admin/users` screenshots and four `/admin/settings` screenshots at 375 and 1280 px in light and dark themes.

## Completed role slice

The active workspace role now comes from `organization_memberships.role` and is projected into every authenticated `UserDto`. The global `users.role` remains only for platform bootstrap compatibility and no longer chooses product navigation or module access.

The fixed first-client matrix is server-enforced:

- owner: all modules and organization access management;
- chef: inventory with costs redacted, purchase draft, dish cards, shift closing, and staff;
- administrator: inventory, invoice intake/review, suppliers, debt, and payments;
- no membership: no workspace.

Owners manage membership roles through `/api/access`; role changes revoke the affected sessions and protect the last owner. No Prisma migration was required because the enum and membership table already existed. Per-client module toggles are deliberately not added yet: introduce them only when a real client needs a matrix different from this baseline.

## Completed branch-isolation slice

The active branch now belongs to the organization membership, not to the browser. The sidebar exposes every allowed active branch and switching it invalidates all session-scoped queries. The selected branch therefore follows the same account between a laptop, phone, and installed PWA.

Owners always have every active branch. Chefs and administrators default to all branches when they have no explicit access rows, preserving existing installations. On `/admin/users`, the owner can replace that default with one or more selected branches. The backend refuses foreign, inactive, and unassigned branches and resolves the same active workspace for inventory, purchases, invoices, dishes, shifts, staff, suppliers, and the owner dashboard.

Owning files:

- `packages/contracts/src/workspace.ts`;
- `backend/prisma/schema/operations.prisma` and migration `20261013042047_add_branch_access`;
- `backend/src/modules/workspace/`;
- `backend/src/modules/access/`;
- `webapp/src/features/workspace/`;
- `webapp/src/features/admin/BranchAccessDialog.tsx` and `UserDirectory.tsx`.

## Completed branch-management slice

Owners manage branches from `/admin/settings`. They can add a name and optional address, edit either value, archive a closed location, and restore it later. Archive is deliberately not deletion: every invoice, movement, shift, employee event, and financial row remains linked to its original branch.

The backend serializes status changes per organization. It refuses to archive the last active branch and refuses to strand a chef or administrator whose explicit access contains no other active branch. When archive succeeds, affected memberships move to an allowed fallback and the archived branch is removed from explicit access lists.

Owning files:

- branch-management schemas in `packages/contracts/src/workspace.ts`;
- lifecycle operations in `backend/src/modules/workspace/`;
- `webapp/src/features/workspace/BranchManagementPanel.tsx`;
- owner settings composition in `webapp/src/features/admin/pages.tsx`.

## Deferred or externally blocked work

- Production OCR needs representative real invoice and receipt photos plus a provider decision. Keep human confirmation mandatory even after a provider is connected.
- Start 1C support with CSV/XLSX only after receiving a real client export. Direct 1C integration is configuration-specific.
- SaaS billing remains manual until pricing and billing rules are confirmed.
