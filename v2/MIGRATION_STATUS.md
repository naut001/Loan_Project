# Migration status

This is a partial migration. The Pages workflow now prepares v2 as the main site
at `/Loan_Project/` at the user's request; v1.3 is preserved at `/Loan_Project/v1/`
and the v2 preview remains at `/Loan_Project/v2/`. This is not staging acceptance
or proof that the live Supabase policies/triggers have been tested.

Implemented in the current preview: conditional cloud writes, full-payload backup export,
wallet create/edit/delete, ordinary transaction create/edit/delete and transfers,
category selection, monthly budgets, monthly CSV, and atomic cash-expense batches.
Expense batches support mixed cash and credit purchases. Linked debt transactions cannot
be edited or deleted with the ordinary cash editor.
Partial/full payments into custom monthly schedule rows are implemented with atomic
wallet/debt updates, separate extra interest/fees, and confirmation. Linked payment undo
is implemented with atomic updates, validation, and preservation of legacy paid markers.
Individual credit purchases and undo are implemented: statement-period selection,
linked schedule rows, no cash deduction, and protection against undoing paid purchases.
Mixed batches validate all 1–100 entries on a draft before one conditional write.
Formula-to-monthly-schedule conversion is implemented with confirmation and conditional
cloud writes. It retains legacy paid markers and extension fields without generating
historical payments or changing wallet balances. VM tests compare schedules with v1.3.
Conversion has no reverse action; export a backup first and reconcile with the lender.

Basic debt management supports creating empty custom debts, renaming existing debts,
editing due-date settings only without balances/history, and deleting empty debts only.
Existing schedules, paid markers, transaction links and extension fields are retained.
Individual monthly schedule rows can be added, edited or deleted without cash or
expense transactions. Paid/partially paid and transaction-linked rows are protected;
duplicate row IDs and orphan links block edits. Totals are recalculated atomically.

Still required for feature parity and live acceptance (even after promotion):
- Remaining debt-editor parity: term/payment calculators, additional metadata and
  lender reconciliation. Formula creation and guarded editing now accept current
  principal, annual rate and monthly payment, using the conversion amortization engine.
  Editing formula parameters requires no paid history, schedule or linked transactions;
  due-date changes remain blocked for debts with balances. No disbursement is recorded.
- Receivable create/edit, guarded delete, collection history and latest-collection undo
  are available. As in v1.3, recording a collection does not credit a wallet; manual
  cash entries remain separate. Invalid legacy receivables block writes to that list
  until reconciled; other payload fields remain untouched. A read-only receivables
  page shows outstanding/late/soon amounts and a 12-month forecast matching v1.3
  recvInfo/recvArray semantics. Forecasts do not credit wallets or income.
  The editor/forecast require complete typed receivable fields; incomplete legacy
  rows remain in full backups but cannot be edited or forecast until reconciled.
- Full planning/consolidation parity: a read-only 12-month plan projection uses existing v1.3 plan/income fields and has planSim parity tests. A per-row cloud planning form edits cash, purchases, planned loans and payoff selections. Calculator-to-plan transfer is available through a RAM-only proposal and explicit draft import before confirmed cloud saving. The standalone read-only loan calculator has amortization, early-payoff and selected-debt consolidation comparisons against v1.3 formulas. Read-only income/expense reporting covers six-month trends, categories/budgets and month-end estimates with v1.3 spendSummary parity tests. Debt ICS export includes explicit custom schedules and formula schedules matched against v1.3; invalid formula records block export instead of inventing amounts. Formula forecasts are read-only.
- Conditional full backup restoration is available for an existing cloud row, with file validation, size limits and replacement confirmation. It does not merge data or create an empty account row. Staging acceptance remains required. Local persistence/synchronization is not implemented.
- Registration, password recovery/change, and email callback handling.
- Staging PostgreSQL/RLS/history verification and browser/mobile acceptance tests.
- Service-worker, authentication URL, legacy rollback and simultaneous-writer checks.

Automated unit tests and builds are necessary but do not establish complete parity.
A per-row planning form replaces the advanced JSON editor and saves plan/income with
conditional cloud writes, preserving extension fields on retained rows. Invalid legacy
plans block editing; missing, zero-balance or duplicate payoff selections block saving.
Payoff selections only affect the projection, not recorded debts or wallet transactions.
Calculator-to-plan transfer is available as an explicit RAM-only proposal followed by
manual import into the cloud planning draft, review and a separate confirmed save.
It copies amount/rate/term/upfront fee only, defaults disbursement to next month and
rejects terms above the plan's 120-month limit. It creates no actual debt or transaction.
Calculator consolidation is read-only: selected debts come from the loaded snapshot,
missing custom principal or insufficient net loan funds suppress savings claims.
Selections do not transfer to the planning draft or cause a cloud write.
The projection itself remains read-only. Live Supabase and physical-device acceptance remain pending.
Use `ACCEPTANCE_CHECKLIST.md` to record staging, desktop and mobile results after this user-requested promotion.
Do not edit the same account simultaneously in v1.3 and v2.