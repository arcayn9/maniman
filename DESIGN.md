# Finance Workspace

Approved direction: option 1, selected on 2026-11-21. Based on the Finance Workspace comparison in `output/design/maniman-ui-directions-preview.html` and UI/UX Pro Max guidance. Production screens show implemented features and recorded data; the comparison's synthetic roadmap metrics are not live functionality.

## Visual system

| Element | Light value |
| --- | --- |
| Page | `#f5f7fb` |
| Surface | `#ffffff` |
| Sidebar | `#18315b` |
| Active navigation | `#305185` |
| Primary action | `#244fb4` |
| Text | `#182c48` |
| Secondary text | `#53647b` |
| Border | `#dde4ee` |

System sans-serif, tabular monetary amounts, 6–8px corners, restrained borders and no decorative gradients or shadows. Semantic success/warning/error colors remain distinct from the blue brand. CSS variables in `styles.css` include the corresponding system dark-theme values. Navigation uses locally embedded Lucide SVGs; attribution is in `vendor/lucide-PROVENANCE.md`.

## Layout and interaction

- Desktop: 220px sidebar, grouped workspace/planning navigation, topbar period picker and primary Import statement action. Vault operations are in a separate menu.
- Overview: recorded spending, income and net cash flow; import/review prompt; category and trend panels; confirmed statement coverage. Quick entry stays collapsed until requested.
- Transactions: searchable/filterable ledger and expandable entry editor. Imports & review: local conversion guidance, upload, account/period/treatment review and undo history.
- Mobile at 720px and below: four-item bottom navigation, More menu for secondary views, 16px form controls, 44px touch targets and ledger records that reflow without losing table semantics. Statement evidence tables retain contained horizontal scrolling.
- Vault: branded setup/unlock/recovery dialog, background inertness, contained keyboard focus, field-linked errors, selectable recovery key and password-manager support.

## Reporting honesty

Monthly selectors filter reports; they never bound stored history. Ledger and imports retain all dates. Statement coverage displays only confirmed periods intersecting the selected month and never infers coverage from observed transaction dates. Income/spending exclude own-account transfers. No baseline, priority or card-influence figures appear until their underlying features exist.

## Checks

Automated workspace regressions cover route persistence, async file/vault ownership safety, coverage filtering and ledger escaping/filter composition. Desktop and 375px rendering were inspected with isolated synthetic data. Physical-device, vault-dialog visual and live hosted multi-device checks remain release validation work.

## Typography and logo refinement — 2026-11-21

The Maniman mark is an M-shaped wallet frame: upright sides, a central fold, a separate horizontal bottom edge and a clasp. A small gap separates the M from the bottom edge so the letter remains distinct. The same master SVG (`icons/maniman-icon.svg`) appears in desktop navigation, the mobile header, vault access and the PWA icon.

The mobile secondary navigation uses a three-line SVG button with the accessible name “App menu”. Native disclosure state remains available to assistive technology. Summary values use a restrained 16–24px scale based on card width. Cards reflow before text collides; mobile ledger amounts occupy their own line. Digits never wrap or become ellipses. Exceptionally long values retain their full precision in a contained horizontal scroll area. At very narrow widths, period and import controls occupy separate rows.

The visible app header reads “Maniman”; the design-direction name is documentation only.

## Currency and action icons

New vaults and starter data default to Indian rupees (INR, ₹), formatted with Indian digit grouping. Saved currencies, including older records that used the former USD default, retain their original denomination.

Common actions use locally embedded Lucide SVGs: pencil, trash, plus, save, cancel, clear, undo, payment check and page chevrons. Each icon-only control keeps its existing event binding, a contextual accessible name, hover title and 44px hit area. Destructive controls use the semantic danger color. Workflow-specific statement commitment, import and authentication actions retain descriptive text.

## In-app User’s Guide

User’s Guide is available from the desktop sidebar and mobile App menu. Its 28 numbered walkthroughs describe implemented features and explicit limits. Search and five topic groups operate entirely in the browser; matching topics expand without injecting search input into HTML. Context buttons open the relevant app screens. The guide ships in the offline app shell. `docs/USER_GUIDE.md` is generated from the same catalog and checked for drift by tests.
