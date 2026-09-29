import { readFileSync } from 'node:fs';
import { createContext, runInContext } from 'node:vm';
import { expect, it } from 'vitest';
import { receivableArray, receivableForecast, receivableInfo } from './receivable-forecast';
import type { Receivable } from './snapshot';

const base: Receivable = { id: 'r', name: 'Lan', amount: 1200, got: 0, kind: 'once', due: '', startK: '', day: 1, per: 0, inc: true, note: '', log: [] };

it('đối chiếu thông tin và dự báo phải thu với recvInfo/recvArray của 1.3', () => {
  const today = new Date(2026, 8, 28);
  const ctx = createContext({ __TODAY__: '2026-09-28', document: {} });
  for (const file of ['util.js', 'loan.js', 'model.js']) runInContext(readFileSync(new URL(`../../../js/${file}`, import.meta.url), 'utf8'), ctx);
  const cases: Receivable[] = [
    { ...base, due: '2026-09-20' }, { ...base, got: 200, due: '2026-09-28' },
    { ...base, got: 1200, due: '2026-09-20' }, { ...base, due: '' },
    { ...base, kind: 'plan', startK: '2026-08', day: 31, per: 200 },
    { ...base, kind: 'plan', startK: '2026-09', day: 28, per: 250, got: 100 },
    { ...base, kind: 'plan', startK: '2027-01', day: 5, per: 800, inc: false },
    { ...base, kind: 'plan', startK: '2024-02', day: 29, per: 100 },
  ];
  for (const r of cases) {
    const before = JSON.stringify(r);
    const old = runInContext(`recvInfo(${JSON.stringify(r)})`, ctx) as { out: number; next: Date | null; nextAmt: number; late: number; lateSince: Date | null; lateDays: number };
    const actual = receivableInfo(r, today);
    expect({ ...actual, next: actual.next?.getTime() ?? null, lateSince: actual.lateSince?.getTime() ?? null }).toEqual({ ...old, next: old.next?.getTime() ?? null, lateSince: old.lateSince?.getTime() ?? null });
    expect(receivableArray(r, 12, today)).toEqual(Array.from(runInContext(`recvArray(${JSON.stringify(r)}, 12)`, ctx) as number[]));
    expect(JSON.stringify(r)).toBe(before);
  }
  const sum = cases.filter(r => r.inc !== false).map(r => receivableArray(r, 12, today));
  expect(receivableForecast(cases, 12, today)).toEqual(Array.from({ length: 12 }, (_, i) => sum.reduce((total, row) => total + row[i], 0)));
});