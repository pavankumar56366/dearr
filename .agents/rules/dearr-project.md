# Dearr Project Rules for Antigravity

Use these rules whenever you make or modify code in the Dearr project.

## 1. Project Context

Dearr is a V1 e-commerce website with:

- Customer storefront
- Founder/Admin dashboard
- Products and categories
- Discounts
- Wishlist
- Cart
- Checkout
- Orders
- Razorpay payments

### Tech Stack

- Next.js (App Router)
- TypeScript
- Tailwind CSS
- Next.js Route Handlers
- Hostinger MySQL (database)
- Dearr custom application authentication (bcryptjs + jose)
- Hostinger file storage (product media in `public/uploads/products/`)
- Razorpay (payments)
- Hostinger Node.js hosting (production)
- Git/GitHub

### Important Boundaries

- The existing `dearr.in` website is an OLD WordPress/WooCommerce site. It must **never** be modified, connected to, or used as a backend for the new Dearr application.
- Production deployment, DNS changes, and Hostinger configuration changes require **explicit approval**.
- Do **not** use Supabase, Vercel, or Lovable Cloud.

The developer is a beginner. Explain non-obvious technical decisions in plain language.

Project documentation is in `docs/`:

```text
docs/
├── PRD.md
├── TRD.md
├── APPFLOW.md
├── DESIGN.md
├── SCHEMA.md
├── IMPLEMENTATION.md
├── TRACKER.md
└── RULES.md
```

---

## 2. Source of Truth

Use each document for its intended purpose:

```text
PRD            → Product requirements and V1 scope
TRD            → Technical architecture and stack
APPFLOW        → Screens, navigation, and user flows
DESIGN         → UI/UX and visual system
SCHEMA         → Database tables and relationships
IMPLEMENTATION → Build order and task plan
TRACKER        → Current task progress
RULES          → Human-readable project rules
```

When a requested change conflicts with the documented requirements, **stop and ask before implementing it**.

---

## 3. Golden Rules

1. Follow PRD, TRD, SCHEMA, APPFLOW, and DESIGN.
2. Work on one logical task at a time.
3. Make small, reviewable changes.
4. Do not touch unrelated code.
5. Do not rewrite large amounts of working code without approval.
6. Do not guess when a requirement is unclear.
7. Prefer simple and readable solutions.
8. Stay within Dearr V1 scope.
9. Do not add V2/V3 features without approval.
10. Reuse existing components and utilities whenever possible.

---

## 4. Architecture Rules

- Keep the agreed Next.js architecture.
- Do not create a separate backend service for V1.
- Do not add microservices, Redis, Elasticsearch, or similar infrastructure unless explicitly approved.
- Keep UI, validation, server logic, and data access separated.
- Do not create new top-level folders without approval.
- Keep server-only code on the server.
- Never expose server secrets to browser code.

---

## 5. Database Rules

`docs/SCHEMA.md` is the database source of truth.

- Never invent tables or columns.
- Never silently rename database fields.
- Use `snake_case` for database tables and columns.
- Use proper foreign keys and constraints.
- Avoid duplicate business data.
- Preserve historical order snapshots such as purchase-time product names and prices.
- Never recalculate an old order from the current product price.

If a feature needs a schema change:

```text
STOP
  ↓
Explain why current schema is insufficient
  ↓
Propose exact change
  ↓
Get approval
  ↓
Update SCHEMA.md
  ↓
Update migration and affected code
```

---

## 6. Authentication & Authorization

Use **Dearr custom application authentication**:

- Passwords are hashed with `bcryptjs` and stored in the MySQL `profiles` table.
- Sessions are signed JWTs created with `jose`, stored in secure HTTP-only cookies.
- The `SESSION_SECRET` environment variable must never be exposed to client code.

Remember:

```text
Authentication = Who is the user?
Authorization  = What can the user do?
```

- Protect `/admin`.
- Check admin authorization on the server.
- Never trust a role value supplied by the browser.
- Customers may access only their own orders, carts, wishlists, and addresses.
- Handle expired sessions safely.
- Never store plaintext passwords; store only bcrypt hashes generated on the server.

---

## 7. Security — Non-Negotiable

- Never hardcode passwords, API keys, service keys, or secrets.
- Use environment variables.
- Never expose `DB_PASSWORD`, `SESSION_SECRET`, or `RAZORPAY_KEY_SECRET` to client-side code.
- Use HTTPS in production.
- Do not store raw card information or card security codes.
- Never log passwords, tokens, payment secrets, or sensitive credentials.
- Validate user input on the server.
- Protect against SQL injection, cross-site scripting (XSS), unauthorized admin access, forged payment results, insecure uploads, and accidental data exposure.
- Never trust client-side price, discount, stock, payment status, or admin role.
- Recalculate or verify important values server-side.

---

## 8. Dearr Design Rules

`docs/DESIGN.md` is the visual source of truth.

Use:

```text
Primary       #A2CB8B
Secondary     #FFCB56
Success       #2A7C13
Warning/Error #C00707

Display Font  Telma
UI Font       Inter
Spacing       8px base grid
```

- Design mobile-first.
- Keep the provided Dearr visual identity consistent.
- Do not add random colors or fonts.
- Reuse shared UI components.
- Provide loading, empty, error, and success states where relevant.
- Avoid dead-end screens.
- Keep one clear primary action on important screens.

---

## 9. App Flow Rules

`docs/APPFLOW.md` is the navigation and behavior source of truth.

- Follow documented customer and admin flows.
- Check affected flows before changing routes or screen behavior.
- Do not silently remove a route.
- Every error state needs a recovery path.
- If a new screen is required, explain why and update the relevant documentation after approval.

---

## 10. API & Business Logic

Follow the API patterns in `docs/TRD.md`.

- Validate request data before database writes.
- Return safe, understandable errors.
- Do not expose internal stack traces.
- Keep important business rules on the server.

The server is the source of truth for:

```text
Final Price
Discount
Stock
Order Total
Payment Status
Admin Authorization
```

---

## 11. Product, Discount & Payment Rules

### Products

- Only active products should normally appear on the storefront.
- Inactive products must not be purchasable.
- Check stock before checkout.
- Do not create negative stock.
- Prefer deactivation instead of hard deletion when historical orders depend on a product.

### Discounts

- Follow `docs/SCHEMA.md`.
- Validate percentage and date ranges.
- Do not invent discount stacking behavior.
- If overlapping discounts are possible but no priority rule exists, stop and ask.

### Payments

- Use Razorpay according to `docs/TRD.md`.
- Use test mode first.
- Create payments from trusted server-side order data.
- Verify payments on the server.
- Never mark an order as paid only because the browser reports success.
- Handle success, failure, cancellation, and delayed/unknown states.

---

## 12. Testing Rules

After implementing a task:

1. Explain how to test it.
2. Test the happy path.
3. Test at least one relevant edge/error case.
4. Check affected flows for regressions.
5. Do not mark the task complete until it works.

For UI:
- Test mobile layouts.
- Test loading, empty, and error states where relevant.
- Check the browser console.

For APIs:
- Test valid and invalid input.
- Test authentication and authorization.
- Test database behavior.

For payments:
- Test success and failure/cancellation.
- Test server-side verification.

---

## 13. Git Rules

Use Conventional Commits:

```text
feat:
fix:
docs:
refactor:
chore:
test:
```

Rules:

- One logical change per commit.
- Keep commits small.
- Do not mix unrelated refactors with feature work.
- Suggest a commit message after completing a task.

---

## 14. Tracker Rules

`docs/TRACKER.md` is the progress source of truth.

Before starting:

```text
To Do → In Progress
```

After successful implementation, testing, and commit:

```text
In Progress → Done
```

When blocked:

```text
In Progress → Blocked
```

Write the exact blocker in the tracker.

If a genuinely new task or bug is discovered, add it to `TRACKER.md`.

---

## 15. AI Response Rules

Before large changes:

- Show a short plan.
- State important assumptions.
- Mention dependencies.
- Flag risky, irreversible, security-sensitive, payment-related, database-changing, or out-of-scope work.

After completing a task, report:

```text
1. What changed
2. How to test it
3. Suggested commit message
4. Tracker status
```

Keep explanations concise and beginner-friendly.

---

## 16. Do Not

- Do not add dependencies without explaining why.
- Do not add V2/V3 features without approval.
- Do not change the database schema silently.
- Do not change build/config/deployment files without explaining the impact.
- Do not perform huge multi-file rewrites for a small task.
- Do not rewrite unrelated code.
- Do not hardcode secrets.
- Do not bypass authentication or authorization.
- Do not trust client-side money or payment values.
- Do not invent undocumented business rules.
- Do not create duplicate components when reusable ones already exist.
- Do not mark work as Done if it has not been tested.

---

## 17. V1 Scope Guard

Before implementing a new feature:

```text
Is it in Dearr V1?
       │
   ┌───┴───┐
  YES     NO
   │        │
 Build    Ask first
```

When uncertain, ask instead of guessing.

---

## Final Rule

**Build the smallest correct Dearr V1, one task at a time, while keeping code, database, documentation, and tracker in sync.**
