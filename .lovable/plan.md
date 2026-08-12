# Podium Introductions — intake chatbot + real matching

Rebuild the Introductions chatbot with the revised question tree, load the 399-member export as the membership database, and run the documented matching algorithm so the demo returns real member profiles with real scores.

## 1. The chat flow (revised tree)

Same conversational chat UI as the current demo (Podium branding, chat bubbles, tap-to-answer chips, mobile-first).

**Step 0 — Contact (new, at the very start):** name, email, phone, one question at a time, validated. Also captures date of birth (needed for the age filter).

**Step 1 — ICP chip:** the six seasons from the tree (Career Crossroads, Side Hustler, Early-Stage Founder, Late-Stage Founder, Portfolio / Independent, Established Career).

**Step 2 — Gate + reroute:** each branch except Established Career asks its yes/no gate. "No" opens that branch's reroute question, which can jump the visitor to another branch (Side Hustler Step 3, Portfolio Step 3, or the founder "how long have you been building this?" question that splits Early vs Late-stage). Exactly as drawn in the tree, including the shared Early/Late gate.

**Step 3 — Branch questions:** the stage question for the branch, business-type question where the branch has one (Side Hustler, Early-Stage, Late-Stage), then the open text "What would you want someone to just understand in this journey, without having to explain it?"

**Step 4 — Shared:** the 10 life-context tags, multi-select.

**Also collected for matching:** role level, company type, company size, area of expertise, countries lived, child status, interests — asked as short chips near the end, because the algorithm's hard filters need them. (The tree doesn't include these; flagging it as an addition.)

Internal tag for the 3+ year founder branch: `late_stage_founder`, labelled "Established founder" in copy — resolves the naming flag in the tree.

## 2. Membership database

The 399 rows from `Export.xlsx` are imported into a `members` table via a migration (literal INSERTs, so results work on first load): name, DOB, LinkedIn, email, phone, ICP, child status, relationship status, role, company type, company size, area of expertise, countries lived, "other parts of me", interests.

Cleaning applied during import:
- Deduplicate label variants (`1-10 employees` / `1 - 10 employees`, `Parent of infants (0–5)` en-dash vs hyphen, `Individual Contributor` vs `Individual contributor (early or mid-career)`).
- Map export ICP names onto the six intake ICPs: Aspiring Pivot → Career Crossroads, Career Maximizer → Established Career, Portfolio Career → Portfolio / Independent, Early/Late Stage Founder and Side Hustler unchanged. `Financial Consultant` (7) and `Uncategorized` (3) are mapped to Portfolio / Independent and flagged in the data so you can correct them later.
- Age derived from DOB at match time.
- Role mapped to a 6-level ladder (IC → senior IC → manager → senior manager/manager-of-managers → director/VP → C-suite; "Founder" and "Between roles" handled as special cases) so "Role ± 1 level" works.
- Company size mapped to 5 ordered bands so "± 1 band" works.

**Important gap:** the export has no stage answers — those only come from the new form. Per section 6 of the rules, that makes the whole export the Route B fallback pool. So the demo would only ever produce Route B matches, and the 40% stage signal would never fire.

Recommended handling: implement both paths properly, and for the demo assign each member a plausible stage within their ICP (deterministic, derived from role/company size/age so it isn't random) stored in a separate `derived_stage` column that is clearly labelled as inferred in the UI. Route A (full cascade) then runs against them, and Route B stays implemented for members whose stage is unknown. If you'd rather not infer, say so and the demo runs Route B only.

## 3. Matching algorithm

Implemented server-side, exactly as documented, weights in one editable config file.

**Stage 1 — hard filters**, in order, each loosening only if fewer than 2 candidates remain:
- ICP must match — never loosens.
- Age/role/company ladder: (1) age ±3 · role ±1 · same company type → (2) age ±5 · role ±1 · size ±1 band → (3) age ±5 · role ±1 → (4) age ±5 only.
- Child status last: child-free with child-free, parents with parents.
- If still short: hobby-only mode — drop ICP, keep age ±5, rank purely on "other parts of me" + interests overlap, and say so in the result ("you're both third culture kids who love yoga").

**Stage 2 — priority cascade, then weighted score out of 100:** stage proximity 40 (per-ICP matrices from the doc, all six transcribed verbatim), business type 15, area of expertise 15, life context Jaccard 15, interests Jaccard 10, countries lived 5 (exact overlap = 1.0, else the 4-tier breadth fallback capped at 0.5). Weights of dimensions that don't apply to an ICP are redistributed proportionally.

**Selection:** top 3, each with its score, the threshold band (Strong 75+, Good 55–74, Workable 40–54, Weak <40), which filter step and which route produced it, and 3 plain-language reasons generated from the dimensions that actually scored (e.g. "Both stabilizing an early-stage business", "Shared expertise in Marketing & Brand", "Both expats in Singapore"). Open-text answers are stored and shown as intro-writing context but never scored.

## 4. Results screen

Top 3 member cards: name, ICP, stage, role/company, score badge with band, why-you-match reasons, expertise and interests. A collapsible "how this was scored" panel shows the per-dimension breakdown, the filter step reached, and the route used — that's what makes it read as a real algorithm demo rather than a mockup. Email, phone and LinkedIn shown as the intro handoff. Below that, the existing "what happens next" completion message.

## 5. Technical notes

- Lovable Cloud enabled: `members` (seeded via migration, public read of non-contact columns only) and `responses` (intake submissions with partial-fill tracking, service-role only).
- Matching runs in a `createServerFn` so contact details of members are never shipped to the browser except for the 3 selected matches.
- `src/lib/matching/` holds the ICP stage matrices, weights, tier tables and ladders as plain data — tunable without touching flow code.
- Intake tree lives in `src/lib/intake-tree.ts` as data (nodes, gates, reroute jumps) so wording changes stay in one file.
- Reuse the existing chat components, Podium assets and design from the previous project.
