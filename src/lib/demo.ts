import bcrypt from "bcryptjs";
import { db } from "./db";

/**
 * The public demo workspace.
 *
 * Baton is more useful to look at than to read about, so the seed creates a
 * small, realistic company with requests at different stages of the pipeline.
 * `seedDemoWorkspace` is idempotent: it returns immediately once the demo owner
 * exists, so it is safe to call on every boot and from the "Explore the demo"
 * button.
 */
export const DEMO = {
  email: "ada@acme.test",
  password: "password123",
  companyName: "Acme Inc.",
  companySlug: "acme",
  ownerName: "Ada Lovelace",
} as const;

const DONE_GHERKIN = `Feature: Saved payment methods at checkout
  As a returning customer
  I want to reuse a saved card
  So that checkout takes one step instead of three

  Scenario: Pay with a saved card
    Given I am signed in and have at least one saved payment method
    When I reach the payment step at checkout
    Then the saved cards are listed above the new-card form
    And the card I used last is selected by default

  Scenario: Add a new card without losing the order
    Given I am on the payment step
    When I choose to add a new card and the card is declined
    Then I stay on the payment step with my basket intact
    And the decline reason is shown against the card field

  Scenario: Saved cards are bound to the customer
    Given another customer is signed in
    When they open the payment step
    Then they cannot see or select my saved cards`;

const VAT_GHERKIN = `Feature: Correct VAT rounding on invoice totals
  As a finance user
  I want invoice totals rounded consistently
  So that the invoice total equals the sum of its displayed lines

  Scenario: A one-line invoice with a half-penny
    Given an invoice line of 10.01 and a VAT rate of 20 percent
    When the invoice is saved
    Then the VAT amount is 2.00
    And the total is 12.01

  Scenario: Many small lines
    Given ten invoice lines of 0.99 each and a VAT rate of 20 percent
    When the invoice is saved
    Then VAT is calculated on the summed net, not line by line
    And the total equals the net plus VAT

  Scenario: Existing paid invoices do not change
    Given a paid invoice created before this fix
    When it is viewed or reprinted
    Then its stored totals are unchanged`;

const CSV_GHERKIN = `Feature: Export rejected expenses as CSV
  As a finance analyst
  I want a CSV of rejected expense claims
  So that I can review them with the department heads

  Scenario: Export the current period
    Given I am on the expenses report
    When I choose "Export rejected to CSV"
    Then a CSV downloads with one row per rejected claim
    And it includes claimant, amount, currency, rejection reason and date

  Scenario: Nothing to export
    Given there are no rejected claims in the period
    When I choose the export
    Then I am told there is nothing to export
    And no empty file is downloaded`;

export async function seedDemoWorkspace(): Promise<boolean> {
  const existing = await db.user.findUnique({ where: { email: DEMO.email } });
  if (existing) return false;

  const passwordHash = await bcrypt.hash(DEMO.password, 10);

  const owner = await db.user.create({
    data: {
      email: DEMO.email,
      name: DEMO.ownerName,
      passwordHash,
      memberships: {
        create: {
          role: "OWNER",
          company: {
            create: {
              name: DEMO.companyName,
              slug: DEMO.companySlug,
              githubConnected: true,
              githubLogin: "acme",
              githubDefaultRepo: "acme/storefront",
              appBaseUrl: "https://storefront.example.com",
            },
          },
        },
      },
    },
    include: { memberships: true },
  });

  const companyId = owner.memberships[0].companyId;

  const grace = await db.user.create({
    data: {
      email: "grace@acme.test",
      name: "Grace Hopper",
      passwordHash: await bcrypt.hash(DEMO.password, 10),
    },
  });
  const stan = await db.user.create({
    data: {
      email: "stan@acme.test",
      name: "Stan Stakeholder",
      passwordHash: await bcrypt.hash(DEMO.password, 10),
    },
  });
  await db.membership.createMany({
    data: [
      { userId: grace.id, companyId, role: "BA" },
      { userId: stan.id, companyId, role: "STAKEHOLDER" },
    ],
  });

  const project = await db.project.create({
    data: {
      companyId,
      name: "Acme Storefront",
      slug: "acme-storefront",
      repoFullName: "acme/storefront",
      jiraProjectKey: "ACME",
      baselineAt: new Date(Date.now() - 22 * 86_400_000),
    },
  });

  await db.requirementDoc.createMany({
    data: [
      {
        companyId,
        repo: "acme/storefront",
        reqId: "REQ-2f8a1c04",
        category: "ux",
        title: "Checkout keeps the basket visible on every step",
        body: `Feature: Checkout keeps the basket visible\n\n  Scenario: Basket summary on the payment step\n    Given I am at any checkout step\n    Then the basket summary is visible without scrolling\n    And the total matches the server-calculated total`,
        filePath: "requirements/ux/REQ-2f8a1c04.feature",
        codeAreas: JSON.stringify(["src/app/checkout/**"]),
      },
      {
        companyId,
        repo: "acme/storefront",
        reqId: "REQ-7b1e9d22",
        category: "backend",
        title: "VAT is calculated on the summed net, not per line",
        body: `Feature: VAT calculation\n\n  Scenario: Multi-line invoice\n    Given an invoice with several lines\n    When VAT is calculated\n    Then it is applied to the summed net amount\n    And the stored total is the net plus VAT`,
        filePath: "requirements/backend/REQ-7b1e9d22.feature",
        codeAreas: JSON.stringify(["src/lib/vat.ts", "src/app/api/invoices/**"]),
      },
      {
        companyId,
        repo: "acme/storefront",
        reqId: "REQ-9c4d0a18",
        category: "api",
        title: "Expense exports are scoped to the caller's company",
        body: `Feature: Expense export authorisation\n\n  Scenario: A viewer from another company requests an export\n    Given a signed-in user from company B\n    When they request company A's expense export\n    Then the request is rejected with 404\n    And no rows are returned`,
        filePath: "requirements/api/REQ-9c4d0a18.feature",
        codeAreas: JSON.stringify(["src/app/api/expenses/**"]),
      },
      {
        companyId,
        repo: "acme/storefront",
        reqId: "REQ-4e6f2b31",
        category: "design",
        title: "Saved payment methods use the existing card component",
        body: `Feature: Saved card presentation\n\n  Scenario: Saved card list\n    Given the customer has saved cards\n    Then each card uses the shared CardTile component\n    And the selected state uses the existing focus ring`,
        filePath: "requirements/design/REQ-4e6f2b31.feature",
        codeAreas: JSON.stringify(["src/components/CardTile.tsx"]),
      },
    ],
  });

  // 1. Done: a real pull request with Jira delivery tickets.
  const savedCards = await db.request.create({
    data: {
      companyId,
      createdById: stan.id,
      projectId: project.id,
      title: "Saved payment methods at checkout",
      description:
        "Returning customers have to re-enter card details every time. They should be able to pick a card they have used before, and adding a new card should not lose the basket if the card is declined. Finance also wants it clear that one customer can never see another customer's cards.",
      type: "FEATURE",
      status: "DONE",
      priority: "high",
      repoFullName: "acme/storefront",
      jiraIssueKey: "ACME-1001",
      designPrototypeUrl: "https://figma.example.com/file/checkout-cards",
    },
  });

  await db.uxCheck.create({
    data: {
      requestId: savedCards.id,
      classifiedType: "FEATURE",
      reproduced: false,
      summary:
        "Feature, not a bug. The checkout already has a CardTile component and a payment-step layout. The change is additive: read the customer's stored payment methods, render them above the new-card form, and keep the decline path on the same step.",
      steps: JSON.stringify([
        "Opened checkout/payment as a signed-in returning customer.",
        "Confirmed the current form always asks for a new card.",
        "Read the payment API and CardTile component to find the extension points.",
      ]),
      screenshots: "[]",
    },
  });

  await db.brd.create({
    data: {
      requestId: savedCards.id,
      narrative:
        "Returning customers should be able to pay with a card they have saved, without re-entering it. The payment step lists saved cards above the new-card form and preselects the one used most recently. If a new card is declined, the customer stays on the payment step with the basket intact and a plain reason against the card field. Saved cards are scoped to the signed-in customer; no card is ever visible to another customer or to another company.",
      gherkin: DONE_GHERKIN,
      acceptanceCriteria: JSON.stringify([
        "A signed-in customer with saved cards sees them on the payment step.",
        "The most recently used card is selected by default.",
        "A declined new card leaves the basket and the rest of the form intact.",
        "A customer cannot see or select another customer's saved cards.",
        "The order total is unchanged by choosing a saved card.",
      ]),
      devOpsNotes: "[]",
      model: "claude-sonnet-4-5",
      version: 2,
    },
  });

  await db.requirementImpact.create({
    data: {
      requestId: savedCards.id,
      summary:
        "Adds a requirement for saved-card selection and tightens the existing checkout requirement so the basket stays visible through the new decline path.",
      related: JSON.stringify([
        {
          reqId: "REQ-2f8a1c04",
          title: "Checkout keeps the basket visible on every step",
          category: "ux",
          filePath: "requirements/ux/REQ-2f8a1c04.feature",
          affected: true,
          reason: "The new decline path adds a state the basket requirement must cover.",
        },
        {
          reqId: "REQ-4e6f2b31",
          title: "Saved payment methods use the existing card component",
          category: "design",
          filePath: "requirements/design/REQ-4e6f2b31.feature",
          affected: true,
          reason: "New saved-card list reuses CardTile.",
        },
      ]),
      drafts: JSON.stringify([
        {
          op: "new",
          category: "backend",
          title: "Saved payment methods are read from the payment provider",
          filePath: "requirements/backend/REQ-saved-cards.feature",
          body: `Scenario: Load saved cards\n  Given I am signed in\n  When I open the payment step\n  Then the cards returned belong only to my customer record`,
        },
      ]),
    },
  });

  await db.plan.create({
    data: {
      requestId: savedCards.id,
      summary:
        "Add a saved-card reader and a SavedCards component, then wire both into the existing payment step without changing the totals calculation.",
      steps: JSON.stringify([
        "Add a server function that lists the customer's saved payment methods.",
        "Render a SavedCards list above the new-card form using CardTile.",
        "Preselect the most recently used card.",
        "Keep the decline path on the same step and show the provider reason.",
        "Add Playwright coverage for the three acceptance scenarios.",
      ]),
      files: JSON.stringify([
        "src/app/checkout/payment/page.tsx",
        "src/components/SavedCards.tsx",
        "src/app/api/payments/methods/route.ts",
        "src/lib/payments.ts",
      ]),
    },
  });

  await db.build.create({
    data: {
      requestId: savedCards.id,
      branch: "baton-acme-1042",
      summary:
        "Added the saved-card reader, the SavedCards component, preselection and decline handling. The totals path is untouched.",
      diff: `+ export async function listSavedCards(customerId: string) { ... }
+ export function SavedCards({ cards, selectedId }: SavedCardsProps) { ... }
~ payment/page.tsx: render <SavedCards /> above the new-card form
+ tests/checkout/saved-cards.spec.ts`,
    },
  });

  await db.verificationCheck.createMany({
    data: [
      {
        requestId: savedCards.id,
        kind: "acceptance",
        passed: true,
        summary: "All three acceptance scenarios passed against the preview URL.",
        output: JSON.stringify([
          "PASS  pay with a saved card",
          "PASS  add a new card without losing the order",
          "PASS  saved cards are bound to the customer",
        ]),
      },
      {
        requestId: savedCards.id,
        kind: "regression",
        passed: true,
        summary: "Checkout, basket and invoice totals regression suite passed.",
        output: JSON.stringify([
          "PASS  checkout totals unchanged",
          "PASS  basket persists through the payment step",
          "PASS  invoice total equals net plus VAT",
        ]),
      },
    ],
  });

  await db.pullRequestRef.create({
    data: {
      requestId: savedCards.id,
      number: 1042,
      url: "https://github.com/acme/storefront/pull/1042",
      title: "Add saved payment methods to checkout",
    },
  });

  await db.approval.create({
    data: {
      requestId: savedCards.id,
      userId: owner.id,
      decision: "ACCEPTED",
      note: "Scope is right. Ship it.",
    },
  });

  const ticketRows = [
    { kind: "product", issueKey: "ACME-1002", title: "Saved payment methods at checkout" },
    { kind: "design", issueKey: "ACME-1003", title: "Design - Saved payment methods" },
    { kind: "backend", issueKey: "ACME-1004", title: "Backend - Saved payment methods" },
    { kind: "frontend", issueKey: "ACME-1005", title: "Frontend - Saved payment methods" },
  ];
  await db.deliveryTicket.createMany({
    data: ticketRows.map((t) => ({
      requestId: savedCards.id,
      kind: t.kind,
      parentKey: t.kind === "product" ? "ACME-1001" : "ACME-1002",
      issueKey: t.issueKey,
      url: `https://acme.atlassian.net/browse/${t.issueKey}`,
      title: t.title,
      body: "Filed from Baton after the BRD was approved.",
      status: "created",
      needsHuman: false,
    })),
  });

  await db.pipelineEvent.createMany({
    data: [
      { requestId: savedCards.id, stage: "intake", message: "Request filed by Stan Stakeholder." },
      { requestId: savedCards.id, stage: "ux_check", message: "Classified as FEATURE; scoped against the checkout module." },
      { requestId: savedCards.id, stage: "brd", message: "BRD v1 drafted with 3 Gherkin scenarios." },
      { requestId: savedCards.id, stage: "approval", message: "Ada Lovelace accepted the BRD." },
      { requestId: savedCards.id, stage: "tickets", message: "Filed ACME-1002 to ACME-1005 under ACME-1001." },
      { requestId: savedCards.id, stage: "build", message: "Committed on baton-acme-1042." },
      { requestId: savedCards.id, stage: "verification", message: "Acceptance and regression checks passed." },
      { requestId: savedCards.id, stage: "pr", message: "Opened PR #1042." },
    ],
  });

  // 2. Awaiting approval: the human gate, with a bug that was reproduced.
  const vat = await db.request.create({
    data: {
      companyId,
      createdById: stan.id,
      projectId: project.id,
      title: "Fix VAT rounding on invoice totals",
      description:
        "On invoices with several small lines, the VAT shown does not match the VAT in the total. The printed invoice can be a penny out, which finance has to correct by hand before sending it. It only happens on multi-line invoices.",
      type: "BUG",
      status: "AWAITING_APPROVAL",
      priority: "high",
      repoFullName: "acme/storefront",
      jiraIssueKey: "ACME-1010",
    },
  });

  await db.uxCheck.create({
    data: {
      requestId: vat.id,
      classifiedType: "BUG",
      reproduced: true,
      summary:
        "Reproduced on an invoice with ten lines of 0.99 at 20 percent VAT. VAT is rounded per line before summing, so the displayed VAT is 1.98 while the total is calculated from 1.9800000001. The invoice total and the VAT line disagree by a penny.",
      steps: JSON.stringify([
        "Signed in as Ada and opened Invoices -> New invoice.",
        "Added ten lines of 0.99 with a 20 percent VAT rate.",
        "Compared the VAT line (1.98) with the total (11.86 vs 11.87).",
        "Confirmed the mismatch survives a reload and the print view.",
      ]),
      screenshots: "[]",
    },
  });

  await db.brd.create({
    data: {
      requestId: vat.id,
      narrative:
        "VAT must be calculated once, on the summed net amount, and rounded once at the end. The VAT line, the total and the printed invoice must agree to the penny. Invoices that are already paid are historical records and must not be recalculated or changed when they are viewed or reprinted.",
      gherkin: VAT_GHERKIN,
      acceptanceCriteria: JSON.stringify([
        "A one-line invoice of 10.01 at 20 percent shows VAT of 2.00 and a total of 12.01.",
        "A ten-line invoice of 0.99 at 20 percent shows VAT on the summed net.",
        "The displayed VAT, the total and the printed invoice agree.",
        "Paid invoices created before the fix keep their stored totals.",
      ]),
      devOpsNotes: "[]",
      model: "claude-sonnet-4-5",
      version: 1,
    },
  });

  await db.requirementImpact.create({
    data: {
      requestId: vat.id,
      summary:
        "Tightens the existing VAT requirement and adds a regression requirement for historical invoices.",
      related: JSON.stringify([
        {
          reqId: "REQ-7b1e9d22",
          title: "VAT is calculated on the summed net, not per line",
          category: "backend",
          filePath: "requirements/backend/REQ-7b1e9d22.feature",
          affected: true,
          reason: "The current implementation rounds per line, contrary to this requirement.",
        },
      ]),
      drafts: "[]",
    },
  });

  await db.clarifyingQuestion.createMany({
    data: [
      {
        requestId: vat.id,
        question:
          "Should the fix recalculate drafts that already have a stored per-line VAT breakdown, or only new invoices?",
        state: "open",
      },
      {
        requestId: vat.id,
        question:
          "Is the penny tolerance in the finance export acceptable, or must the export also be regenerated?",
        state: "open",
      },
    ],
  });

  await db.pipelineEvent.createMany({
    data: [
      { requestId: vat.id, stage: "intake", message: "Request filed by Stan Stakeholder." },
      { requestId: vat.id, stage: "ux_check", message: "Classified as BUG and reproduced in the preview app." },
      { requestId: vat.id, stage: "brd", message: "BRD v1 drafted. Waiting for a human decision." },
    ],
  });

  // 3. Blocked on questions: the BA needs answers before writing the BRD.
  const csv = await db.request.create({
    data: {
      companyId,
      createdById: grace.id,
      projectId: project.id,
      title: "Let finance export rejected expenses as CSV",
      description:
        "Finance reviews rejected expense claims with department heads every month. Today they screenshot the report. They want a CSV with one row per rejected claim, including the rejection reason and the date. It should only ever include the signed-in user's company.",
      type: "FEATURE",
      status: "QUESTIONS",
      priority: "normal",
      repoFullName: "acme/storefront",
    },
  });

  await db.uxCheck.create({
    data: {
      requestId: csv.id,
      classifiedType: "FEATURE",
      reproduced: false,
      summary:
        "Feature. The expenses report already has the rejected filter and the row data; the export is a new endpoint plus a button. The authorisation model needs to be explicit because exports cross a company boundary if it is wrong.",
      steps: JSON.stringify([
        "Opened the expenses report and applied the Rejected filter.",
        "Read the report query and confirmed the fields exist.",
        "Checked the existing export pattern used by the invoices report.",
      ]),
      screenshots: "[]",
    },
  });

  await db.clarifyingQuestion.createMany({
    data: [
      {
        requestId: csv.id,
        question: "Which period should the export use: the current calendar month, the selected date range, or all time?",
        state: "open",
      },
      {
        requestId: csv.id,
        question: "Should the CSV include the claimant's email address, or only their name and department?",
        state: "open",
      },
      {
        requestId: csv.id,
        question: "Do you need a fixed column order for an existing finance spreadsheet import?",
        state: "open",
      },
    ],
  });

  await db.pipelineEvent.createMany({
    data: [
      { requestId: csv.id, stage: "intake", message: "Request filed by Grace Hopper." },
      { requestId: csv.id, stage: "ux_check", message: "Classified as FEATURE; scoped against the expenses report." },
      { requestId: csv.id, stage: "questions", message: "Three clarifying questions need an answer before the BRD." },
    ],
  });

  // 4. Just filed: queued for the UX check.
  await db.request.create({
    data: {
      companyId,
      createdById: stan.id,
      projectId: project.id,
      title: "Show the delivery estimate on the product page",
      description:
        "Customers only see the delivery estimate at checkout. Put the same estimate on the product page, based on the postcode they enter, so they know before they start the basket.",
      type: "FEATURE",
      status: "INTAKE",
      priority: "normal",
      repoFullName: "acme/storefront",
    },
  });

  const release = await db.release.create({
    data: {
      companyId,
      projectId: project.id,
      version: "2026.10.1",
      summary:
        "Saved payment methods, a corrected VAT calculation, and a safer expense export.",
      ticketLinks: JSON.stringify([
        {
          requestId: savedCards.id,
          prUrl: "https://github.com/acme/storefront/pull/1042",
          title: "Saved payment methods at checkout",
        },
      ]),
      publishedAt: new Date(Date.now() - 4 * 86_400_000),
    },
  });

  await db.releaseNote.createMany({
    data: [
      {
        releaseId: release.id,
        audience: "user",
        body: "You can now pay with a card you have saved. If a new card is declined, your basket stays where it is.",
      },
      {
        releaseId: release.id,
        audience: "technical",
        body: "Adds GET /api/payments/methods and the SavedCards component. No schema change. Checkout totals path untouched.",
      },
      {
        releaseId: release.id,
        audience: "internal",
        body: "VAT rounding fix is in review. Invoice export authorisation requirement added after the CSV request.",
      },
    ],
  });

  return true;
}
