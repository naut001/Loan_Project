# Migration status

This is a partial migration, not a production replacement for v1.3.

Implemented in the current preview: conditional cloud writes, full-payload backup export,
wallet create/edit/delete, ordinary transaction create/edit/delete and transfers,
category selection, monthly budgets, monthly CSV, and atomic cash-expense batches.
Cash batches do not yet include credit purchases. Linked debt transactions cannot
be edited or deleted with the ordinary cash editor.

Still required before switching the main site:
- Debt CRUD, linked partial payments/undo, credit purchases/undo, schedule conversion.
- Receivable CRUD and collection history/undo.
- Full planning/calculator/report parity and ICS export.
- Full backup restoration and local persistence/synchronization.
- Registration, password recovery/change, and email callback handling.
- Staging PostgreSQL/RLS/history verification and browser/mobile acceptance tests.
- Service-worker, authentication URL, legacy rollback and simultaneous-writer checks.

Automated unit tests and builds are necessary but do not establish complete parity.
Do not edit the same account simultaneously in v1.3 and v2.