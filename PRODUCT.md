# Maniman

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Existing HTML/CSS/JavaScript PWA and Node local server. A separate Python tool converts local statement PDFs into versioned JSON.

## Users

Initially the owner's personal finance tracking and analysis. The product is intended to support other independent users later, with isolated vaults and user-managed configuration.

## Product Purpose

Continuously record and reconcile transactions from overlapping sources, understand spending patterns, assign reusable purposes and priorities, identify recurring commitments, establish a monthly baseline, and review possible credit-card-influenced spending.

## Operating Context

Both local-only use and hosted phone/laptop use with encrypted sync are required. Users manage accounts, cards, wallets, aliases, ownership and funding relationships inside the app. Historical and ongoing imports use the same process; a three-month assessment is a validation scenario rather than a product limit.

## Capabilities and Constraints

- Statement workflow: local PDF extraction/OCR → statement JSON → local validation and account/period confirmation → reviewed import → encrypted ledger.
- Preserve evidence while reconciling duplicates, self-transfers, card repayments, refunds and shared-expense recoveries. Date filters never delete recorded history.
- Purposes, priority definitions, defaults and rules are user configurable. Recurring patterns and subjective card influence need review and exceptions.
- Financial persistence and sync must be encrypted. AI, OCR and document parsing remain local only, with no remote fallback.
- Initial implementation has schema validation, a limited generic PDF profile, reviewed JSON import/undo and encrypted snapshots. Advanced automatic reconciliation, rule management, baseline and card-influence analysis remain roadmap features; concept screens may illustrate them but must be marked as proposals.

## Brand Commitments

The name is Maniman. The user selected option 1, Finance Workspace, informed by UI/UX Pro Max. Use a navy sidebar, blue primary actions, pale workspace, compact readable tables and restrained surfaces. See DESIGN.md.

## Evidence on Hand

Confirmed product requirements and implementation status are in `docs/EXPENSE_ANALYSIS_IMPLEMENTATION_PLAN.md` and `docs/IMPLEMENTATION_STATUS.md`. App source supplies current workflow context. Wireframes must use clearly labeled synthetic data rather than the user's financial files.

## Product Principles

- Count a real financial event once while retaining its evidence.
- Make uncertain classification and incomplete coverage visible.
- Learn confirmed mappings while preserving user overrides.
- Keep personal configuration inside the product rather than developer setup.
- Separate observed card funding from the user's subjective assessment of card influence.

## Open Decisions

Purpose and priority defaults remain user-defined. Advanced analytics and account relationship management follow the implementation milestones.
