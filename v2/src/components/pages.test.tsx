import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it } from 'vitest';
import { DebtsPage } from './DebtsPage';
import { SpendPage } from './SpendPage';
import { App } from '../App';
import type { Snapshot } from '../lib/snapshot';

const data: Snapshot = { wallets: [], tx: {}, debts: [] };
it('dựng khung ứng dụng và các màn hình khi chưa có dữ liệu', () => {
  expect(renderToStaticMarkup(<App />)).toContain('Bắt đầu từ bức tranh tài chính');
  expect(renderToStaticMarkup(<SpendPage data={data} />)).toContain('Không có giao dịch khớp bộ lọc');
  expect(renderToStaticMarkup(<DebtsPage data={data} />)).toContain('Không có khoản nợ khớp bộ lọc');
});
it('thoát HTML trong tên khoản nợ nhập từ JSON', () => {
  const html = renderToStaticMarkup(<DebtsPage data={{ ...data, debts: [{ id: 'd', name: '<script>alert(1)</script>', mode: 'custom', balance: 50, payment: 50, stmtDay: 0, dueDay: 10, dueMode: 'day', grace: 0, sched: [{ k: '2026-09', a: 50 }] }] }} />);
  expect(html).not.toContain('<script>');
  expect(html).toContain('&lt;script&gt;');
  expect(html).toContain('Xem lịch trả');
});