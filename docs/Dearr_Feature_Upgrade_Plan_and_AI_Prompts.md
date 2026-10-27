# Dearr Feature Upgrade Plan: Variant Pricing & Post-Payment Personalization

**Project:** Dearr — Next.js App Router, React, TypeScript, Tailwind CSS v4, MySQL  
**Working branch:** `fixing/ui-ux` (or a dedicated feature branch created from the intended integration base)  
**Purpose:** Upgrade product variants so colour/size combinations can have dedicated prices, and allow customers to submit required text/images after successful payment. Add admin controls for product personalization and order review.

## Working rules for every task

1. **Inspect before editing.** Read the existing schema, migrations, routes, components, payment flow, and project conventions. Do not assume file names or database structure.
2. **Branch safety.** Confirm the current branch and `git status --short --branch`. Do not modify `main`. Do not switch branches if it risks losing changes.
3. **Preserve existing work.** Do not discard, reset, stash, or overwrite unrelated/uncommitted changes. Preserve the existing `package-lock.json` changes.
4. **No browser agent.** Do not launch a browser agent, browser task, Playwright UI session, or automated visual browser test. The developer/user will test the UI manually.
5. **No Git actions by the AI.** Do not stage, commit, push, merge, rebase, reset, or deploy. After implementation, report exact changed files and commands/results; wait for the user to manually test, then the user will commit.
6. **Keep tasks isolated.** Complete only the task described by the current prompt. Do not start later tasks or make unrelated redesigns.
7. **Protect commerce/security logic.** Preserve server-side price calculation, discount precedence, stock validation, authentication, HTTP-only sessions, authorization/IDOR protections, CSRF protections, payment verification, idempotency, and existing order/cart APIs unless the task explicitly requires a compatible extension.
8. **Database safety.** Use additive, reversible migrations consistent with project conventions. Never run migrations against production or destructive SQL without explicit authorization. Use the configured local/test database only.
9. **Truthful verification.** Run relevant non-browser checks available in the repository (TypeScript, lint, build, unit/integration tests). Do not claim a test passed unless it actually ran. If a test needs manual interaction, give clear manual steps and wait.
10. **Report at the end.** Include summary, files changed, migrations, commands actually run/results, manual test checklist, known limitations, and exact recommended Git diff/status commands. Then stop.

---

## Feature scope

### A. Variant-specific pricing

- A product may have colour and/or size variants.
- Every purchasable variant combination must resolve to one authoritative server-side price.
- Admin can configure price, SKU, stock, and active/inactive status for each supported combination where the existing model supports it.
- Product pages update the displayed price when the selected variant changes.
- Cart, checkout, order creation, discounts, and payment use server-calculated prices—not prices sent by the browser.
- Preserve existing discount precedence and the price snapshot saved for an already-paid order.
- Prevent duplicate combinations and reject invalid/inactive/out-of-stock variants.
- Migrate existing products without unintentionally changing their current prices or stock.

### B. Product-level personalization configuration

Admin can configure each product as:
- `none`: no personalization required.
- `text`: customer must submit text.
- `image`: customer must upload an image.
- `both`: customer must submit text and upload an image.

Configuration should support, as appropriate to the existing architecture:
- Whether personalization is enabled and required.
- Collection timing: after successful payment.
- Customer instructions.
- Maximum text length.
- Allowed image formats.
- Maximum file size and maximum number of files.
- Whether the item must wait for personalization before production.

Do not expose a field unless the product configuration requires it. Existing non-personalized products must continue to work normally.

### C. Post-payment personalization submission

- Do not require personalization text/image before checkout.
- Only after the server has verified successful payment should the order show a “Personalize Your Order” action for relevant items.
- Store submitted personalization against the specific order item, not just the product.
- Customer can return later via My Orders/order details and submit missing details.
- Enforce order ownership and authorization on the server.
- Validate text and image content server-side. Store uploaded files using the project’s existing secure storage approach; do not expose sensitive uploads through guessable public URLs.
- Make submissions resilient to retries and duplicate requests.
- Do not mark an order as fully ready for production until required personalization is submitted and, if the project supports review, approved.
- A payment failure must never mark the order paid or unlock paid-order personalization.

### D. Admin order review

- Show personalization status per order item.
- Let authorized admins view the submitted text and securely access the uploaded image.
- Support review states only if they fit existing order workflows, for example: awaiting personalization, submitted, needs revision, approved, in production.
- Do not conflate payment status with personalization/production status.
- Keep an audit-friendly record of submission/review timestamps and admin actions where practical.

---

## Task sequence and prompts

Run **one prompt at a time**. After each task, review the diff and manually test the stated checklist. Only then manually stage and commit that task. Do not start the next task until the current task is accepted.

---

# Task 1 — Read-only architecture audit and implementation plan

### Goal
Map the current implementation before changing code. No code or database changes.

### Prompt
You are working on Dearr, a Next.js App Router + React + TypeScript + Tailwind CSS v4 + MySQL e-commerce application.

I want to add variant-specific pricing and post-payment product personalization. This is an **audit-only task**.

Rules:
- First report `git branch --show-current` and `git status --short --branch`.
- Do not modify any files.
- Do not stage, commit, push, merge, rebase, reset, stash, or deploy.
- Do not touch `main` or disturb any uncommitted changes.
- Do not run a browser agent, browser task, Playwright UI session, or automated visual browser testing.
- Do not access or modify production data.

Inspect the actual project and document:
1. Product, product variant, colour, size, SKU, stock, and price schema/model.
2. Product admin create/edit forms and product APIs.
3. Product details page variant selection and price display.
4. Cart APIs and server-side cart pricing.
5. Discount engine and its precedence rules.
6. Checkout, payment creation, payment verification/webhook, idempotency, and order creation.
7. Order/order-item schema, My Orders UI, order details UI, and admin order-management UI.
8. Existing file/image upload infrastructure and storage validation.
9. Authentication, session, order ownership, admin authorization, CSRF/origin protections, and rate limits relevant to these changes.
10. Existing migrations and testing conventions.

Return:
- Actual file paths and a short description of each relevant area.
- Existing behavior that must be preserved.
- Gaps against the requested features.
- A proposed additive database migration plan.
- A task-by-task implementation plan with dependencies and test commands.
- Risks, unanswered questions, and any business-rule decisions that require my input.

Do not implement anything. Wait for my approval.

### Manual acceptance checklist
- Confirm the report lists real paths and existing schema rather than guesses.
- Confirm no files changed.
- Confirm existing uncommitted changes remain intact.

---

# Task 2 — Variant-specific pricing data model and migration

### Goal
Prepare a safe data model for dedicated pricing per colour/size combination, based on Task 1 findings. Keep UI changes out of scope unless needed for type compatibility.

### Prompt
Implement **Task 2 only**: the additive data-model and migration foundation for variant-specific pricing in Dearr.

Before editing, check the current branch and `git status --short --branch`. Preserve all pre-existing changes. Do not touch `main`. Do not run a browser agent or UI browser tests. Do not stage, commit, push, merge, reset, stash, or deploy. Do not touch production.

Use the schema findings from the approved audit. Do not assume table or column names. Follow existing migration conventions and use an additive, reversible migration where practical.

Requirements:
1. Ensure each purchasable colour/size combination can have one authoritative price, stock value, SKU, and active status as appropriate to the existing model.
2. Prevent duplicate variant combinations using an appropriate database constraint or equivalent reliable validation.
3. Preserve current products, variant IDs where possible, prices, stock, and relationships. Do not silently reprice existing products.
4. If a product currently has only colour variants or only size variants, retain compatibility.
5. Keep monetary values in the project’s established safe representation (for example integer minor units or an existing decimal convention); do not introduce floating-point currency arithmetic.
6. Update server-side types/models and validation only as needed for the new schema.
7. Do not change the product UI, payment flow, or discount behavior in this task.
8. Add migration verification or focused tests consistent with repository conventions.

Run relevant database/migration checks only against the configured local/test database. Do not use destructive SQL or production credentials.

At the end, report the exact migration, files changed, how existing data is preserved, commands actually run and results, and manual verification steps. Stop without Git operations.

### Manual acceptance checklist
- Inspect migration SQL and rollback strategy.
- Verify existing variants retain their prices and stock in the local/test DB.
- Verify duplicate variant combinations are rejected.
- Verify no production database was used.
- Review diff and manually commit only after acceptance.

---

# Task 3 — Server-side variant price and stock resolution

### Goal
Make the server resolve the selected variant and its price reliably. No broad UI redesign.

### Prompt
Implement **Task 3 only**: server-side variant resolution and authoritative pricing for Dearr.

Rules: inspect branch/status first; preserve existing changes; do not touch `main`; do not use a browser agent or browser tests; do not stage/commit/push/merge/reset/stash/deploy; do not access production.

Use the approved audit and Task 2 schema. Requirements:
1. Implement or update a single well-defined server-side function/service that resolves a product’s selected variant combination to its canonical variant ID, price, SKU, stock, and active status.
2. Reject missing, ambiguous, duplicate, inactive, invalid, or out-of-stock variants appropriately.
3. Never trust a price supplied by the client. Any client-supplied price must be ignored for authoritative calculations or rejected according to existing API conventions.
4. Preserve the existing discount engine and precedence: Product > Category > Store-wide, with no stacking, unless the audit reveals a documented current rule that differs; report any discrepancy before changing it.
5. Ensure discount calculation starts from the canonical selected variant price and uses existing currency-safe arithmetic.
6. Preserve existing server-side cart validation, cart ownership, authentication, and IDOR protections.
7. Add focused unit/integration tests for valid variants, invalid combinations, price tampering, stock, inactive variants, and discount integration.
8. Do not redesign product or admin UI in this task.

Run relevant non-browser tests, TypeScript, and lint if available. Report exact files and actual test results; stop without Git operations.

### Manual acceptance checklist
- Test a product with colour variants and one with size variants.
- Test a product with both colour and size.
- Try an invalid or inactive variant.
- Try changing the submitted price in the request using a safe local test.
- Confirm the server still calculates the correct total and existing discounts still work.

---

# Task 4 — Admin variant manager with per-combination pricing

### Goal
Allow an authorized admin to create/edit variant combinations and configure each price, stock, SKU, and availability.

### Prompt
Implement **Task 4 only**: admin UI and API support for variant-specific pricing in Dearr.

Rules: inspect branch/status first; preserve uncommitted changes; do not touch `main`; no browser agent, browser task, Playwright UI test, or automated visual browser testing; no Git operations; no deployment; no production DB.

Use the approved schema and the canonical server-side variant resolver from previous tasks.

Requirements:
1. Inspect existing admin product create/edit patterns and reuse them.
2. Add a variant manager that can configure supported colour/size combinations. Each purchasable combination should have an explicit price and the appropriate SKU, stock, and active state supported by the project.
3. Allow products with colour-only, size-only, and combined variants where compatible with existing product behavior.
4. Validate inputs on the server as well as the client. Enforce admin authorization and existing CSRF/origin protections.
5. Prevent duplicate combinations and invalid prices/stock.
6. Do not silently overwrite existing variant prices when editing product metadata.
7. Keep existing product creation/editing and catalog APIs backward compatible.
8. Do not change payment, order, or personalization behavior in this task.
9. Add API/service tests and non-browser checks.

Provide manual steps to create a test product with at least two colours and two sizes, assign different prices, edit one price, disable a combination, and verify invalid combinations are rejected. Do not run browser tests; wait for my manual verification.

### Manual acceptance checklist
- Create or edit a local test product.
- Set distinct prices for at least four combinations.
- Save, reload, and confirm values persist.
- Disable one combination and confirm server rejects it.
- Verify existing products still display correctly.

---

# Task 5 — Product-page variant selection and live price display

### Goal
Connect product-page colour/size selection to the canonical variant data and update displayed prices immediately.

### Prompt
Implement **Task 5 only**: product detail page variant selection and live price display for Dearr.

Rules: check branch/status first; preserve changes; do not touch `main`; do not run a browser agent, Playwright, or automated visual testing; do not stage/commit/push/merge/reset/stash/deploy; no production data.

Requirements:
1. Reuse the current product detail architecture and design system.
2. Show valid colour and size choices based on actual active variants.
3. When a selection changes, resolve the exact variant combination and update the displayed price from canonical variant data.
4. Show unavailable combinations as disabled or clearly unavailable; do not allow adding them to cart.
5. Keep product image/variant image behavior compatible with existing implementation.
6. Keep discounts, sale prices, stock indicators, quantity rules, and accessibility consistent with existing behavior.
7. Add the selected variant ID—not a trusted client price—to the cart request.
8. Ensure cart server recalculates price regardless of what the UI displays.
9. Do not change checkout or payment logic in this task.
10. Run non-browser tests, TypeScript, lint, and build as feasible. Give me precise manual steps to test the product page.

Do not launch any browser or browser automation. Report actual checks only and stop.

### Manual acceptance checklist
- Select each colour and size and confirm the correct price.
- Test all valid and unavailable combinations.
- Refresh the page and confirm default selection is valid.
- Add each selected variant to cart and verify the cart shows the same server-calculated price.
- Test mobile layout manually.

---

# Task 6 — Product-level personalization configuration in admin

### Goal
Allow admin to choose `none`, `text`, `image`, or `both` for each product and configure validation/instructions. Do not yet build the post-payment submission UI.

### Prompt
Implement **Task 6 only**: product-level personalization configuration for Dearr’s admin product create/edit workflow.

Rules: inspect branch/status first; preserve existing work; do not touch `main`; do not run a browser agent or UI browser tests; do not perform Git operations or deploy; no production database.

Use the approved audit and existing database conventions. Add an additive migration only if needed.

Requirements:
1. Add a product setting with supported modes: `none`, `text`, `image`, `both`.
2. Support after-payment collection timing. Do not introduce a pre-payment personalization requirement.
3. Add configuration for required/optional input, customer instructions, maximum text length, allowed image MIME types/extensions, maximum image size, and maximum number of images where appropriate.
4. Use sensible safe limits and validate all settings server-side.
5. Existing products must default to `none` or another backward-compatible state so they remain purchasable without new fields.
6. Reuse current admin authorization, validation, and product create/update patterns.
7. Do not add client-side upload submission, order-item storage, payment changes, or customer-facing personalization forms in this task.
8. Add focused tests for create/edit validation and default behavior.

Do not run browser tests. Report schema defaults, files changed, tests actually run, and manual steps for creating one text product, one image product, one both product, and one non-personalized product. Stop for my review.

### Manual acceptance checklist
- Admin can save each personalization mode.
- Editing an existing product without personalization does not break it.
- Invalid text limits/file limits are rejected.
- Product pages and checkout remain unchanged at this stage.

---

# Task 7 — Order-item personalization data model and API

### Goal
Store customer-submitted text/image references per order item and securely expose authorized APIs. Do not yet add the full customer UI.

### Prompt
Implement **Task 7 only**: the secure order-item personalization data model and APIs for Dearr.

Rules: inspect branch/status; preserve uncommitted work; do not touch `main`; no browser agent or UI browser testing; no Git operations; no deployment; no production database.

Requirements:
1. Inspect the existing order and order-item schema and payment state machine. Link personalization to a specific order item, not only to a product or cart.
2. Store a personalization status independently from payment status. Support at minimum “not required”, “awaiting personalization”, and “submitted”; add review states only if compatible with the existing workflow.
3. Store submitted text safely and image object/storage references securely, along with timestamps and relevant metadata.
4. Keep paid order item price/variant snapshots immutable when the catalog changes.
5. Create narrowly scoped APIs/services for reading personalization requirements and submitting required data for an order item.
6. Enforce authentication, order ownership, role-based admin access, CSRF/origin protections, rate limits, and existing authorization conventions.
7. Verify the order is genuinely paid on the server before accepting post-payment personalization. Never trust a client-supplied payment status.
8. Validate required text, length, file type/content, file size, file count, and duplicate submissions server-side.
9. Use existing secure upload/storage infrastructure if suitable; do not make sensitive uploaded images publicly accessible through predictable URLs. If secure storage is not available, report the gap rather than implementing unsafe public uploads.
10. Make retries safe and prevent one customer from accessing another customer’s order.
11. Do not change the payment provider integration in this task. Do not build the complete customer UI yet.
12. Add focused API/service tests for ownership, unpaid orders, invalid data, valid submission, and duplicate/retry behavior.

Do not run browser tests. Report endpoints, authorization rules, storage behavior, tests, and manual API test instructions using local/test data only. Stop for review.

### Manual acceptance checklist
- Unpaid order cannot accept personalization.
- Paid order owner can submit valid required data.
- Another user cannot read or modify that order item.
- Invalid/oversized uploads are rejected.
- Uploaded content is not publicly accessible without authorization.
- Retry does not create duplicate or inconsistent submissions.

---

# Task 8 — Payment success integration and customer personalization UI

### Goal
After confirmed payment, show customers the appropriate text/image form and allow them to complete it later from My Orders.

### Prompt
Implement **Task 8 only**: integrate post-payment personalization into Dearr’s existing order confirmation and My Orders/order details experience.

Rules: inspect branch/status; preserve changes; do not touch `main`; no browser agent, browser task, Playwright, or automated visual browser testing; no Git operations; no deployment; no production database.

Use the approved order-item personalization APIs and product configuration.

Requirements:
1. Inspect the actual payment verification flow and existing confirmation routes. Only show the personalization CTA after the server confirms payment is successful.
2. For each paid order item, show the correct state:
   - no personalization required,
   - awaiting personalization,
   - submitted / awaiting review if supported,
   - approved if supported.
3. Show “Personalize Your Order” for relevant paid items that still need required input.
4. Form mode must follow product settings: text, image, or both. Show configured instructions and validation limits.
5. Allow the customer to return later and complete personalization from My Orders/order details after signing in.
6. Submit using the secure APIs from Task 7; do not duplicate authorization or upload logic in client components.
7. Preserve authentication/session behavior and prevent cross-account order access.
8. Handle upload progress, submission errors, retry, success confirmation, and already-submitted states accessibly.
9. Never treat a redirect query parameter or client-side payment-success screen as proof of payment.
10. Do not change variant pricing, discounts, or the underlying payment integration unless the audit proves a small compatibility change is necessary; if so, explain it clearly.
11. Run relevant non-browser tests, TypeScript, lint, and build. Do not launch a browser agent.

Report precise manual test steps covering payment success, payment failure, closing the page and returning later, each input mode, and access-control checks. Stop for my review.

### Manual acceptance checklist
- Paid text product asks for text after payment.
- Paid image product asks for an image after payment.
- Paid both product asks for both.
- Non-personalized product shows no personalization form.
- Failed/unpaid order cannot submit.
- Customer can return later from My Orders.
- Customer cannot access another user’s order.
- Submission failures can be retried safely.

---

# Task 9 — Admin personalization review and production readiness

### Goal
Show submitted text/images and pending personalization in the admin order workflow, with secure review actions.

### Prompt
Implement **Task 9 only**: admin personalization review and production-readiness controls in Dearr.

Rules: inspect branch/status; preserve existing changes; do not touch `main`; no browser agent, Playwright, or automated visual testing; no Git operations; no deployment; no production data.

Requirements:
1. Reuse the existing admin order list and order-detail UI.
2. Add a filter/count for orders or items awaiting personalization.
3. Show personalization status per order item, submitted text, submission timestamp, and authorized image preview/download through the existing secure storage/API approach.
4. Ensure only authorized admin roles can access customer personalization data.
5. Add approve/reject/needs-revision actions only if the product workflow supports them; validate each transition server-side.
6. If revisions are supported, provide a safe customer resubmission path and retain an appropriate history of status changes.
7. Keep payment status separate from personalization status.
8. Do not allow an item requiring personalization to enter production-ready status before required data is submitted and approved if approval is part of the configured workflow.
9. Avoid silently changing legacy orders or unrelated fulfillment statuses.
10. Add focused tests for admin authorization and valid/invalid status transitions.
11. Run non-browser checks only. Do not use a browser agent.

Provide manual steps for pending, submitted, approved, and unauthorized-admin cases. Report actual results and stop.

### Manual acceptance checklist
- Pending personalization is easy to find.
- Admin can inspect only authorized order data.
- Unauthorized access is rejected.
- Status transitions follow the defined rules.
- Existing order fulfillment and payment statuses still work.

---

# Task 10 — End-to-end non-browser regression audit and release readiness

### Goal
Audit the combined implementation, fix only confirmed issues with approval, and produce a manual test plan. No browser agent and no Git operations.

### Prompt
Perform a **read-only release audit** of the completed Dearr variant pricing and post-payment personalization features.

Rules:
- Do not edit files in the initial audit.
- Do not touch `main`.
- Do not stage, commit, push, merge, rebase, reset, stash, or deploy.
- Do not launch a browser agent, browser task, Playwright UI session, or automated visual browser testing.
- Do not access production data.
- Preserve all uncommitted changes.

Check:
1. Migrations and backward compatibility for existing products, variants, carts, and orders.
2. Variant price/stock resolution, duplicate combinations, inactive variants, and client price tampering.
3. Product/category/store discount precedence and no-stacking behavior.
4. Cart, checkout, order snapshots, shipping/tax behavior, and payment amount consistency.
5. Payment verification, idempotency, and the rule that only server-confirmed paid orders can submit personalization.
6. Text/image validation, upload security, storage access control, file size/count limits, retries, and order ownership.
7. Admin authorization and personalization status transitions.
8. Customer flow for `none`, `text`, `image`, and `both`.
9. Pending personalization handling, notifications if implemented, and production-readiness rules.
10. Accessibility, error handling, loading states, and responsive layout by code inspection only.
11. Existing regression tests and relevant security tests.
12. TypeScript, lint, build, and non-browser automated test commands.

Run only non-browser checks. Clearly report each check as PASS, FAIL, or NOT TESTED based on evidence. Do not claim manual UI behavior is verified. Provide a prioritized issue list and a complete manual test checklist. Do not fix issues yet; wait for my approval.

### Manual acceptance checklist
- Run the full manual test plan on a local environment.
- Confirm the branch diff contains only intended feature work.
- Review `git diff --check`, `git status --short --branch`, and `git diff`.
- Manually commit only the task changes that have passed testing.
- Push and merge only after all tasks and final regression checks pass.

---

## Suggested manual Git workflow after each task

The AI must not execute Git write operations. After you personally review and test a task, run these commands yourself:

```powershell
git branch --show-current
git status --short --branch
git diff --check
git diff
```

Stage only the files belonging to that completed task. For example:

```powershell
git add path\to\file1 path\to\file2
git diff --cached
git commit -m "feat: add variant-specific pricing foundation"
```

Use a commit message appropriate to the task. Before each commit, confirm that unrelated changes—especially existing `package-lock.json` changes—are not accidentally included. Do not use `git add .` unless you have reviewed every changed and untracked file and intentionally want all of them in that commit.

After all tasks:
1. Run the final non-browser audit.
2. Perform the manual UI and checkout tests yourself.
3. Review the complete branch diff and commit history.
4. Push the feature branch.
5. Open a pull request and merge only after reviewing CI and the final diff.
6. Deploy separately after the merge and release checks.

## Final product behavior expected

- Admin chooses the personalization mode per product.
- Customer chooses a valid colour/size variant and sees the correct price.
- The server independently validates the selected variant and calculates the final amount.
- Customer completes payment without being forced to upload/type personalization beforehand.
- After payment is verified, the customer can submit the required text/image immediately or later from My Orders.
- Admin can find pending personalization, securely review submissions, and manage production readiness.
- Non-personalized products and existing order/payment flows continue to work.
