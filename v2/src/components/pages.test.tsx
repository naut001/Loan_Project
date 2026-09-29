import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it } from 'vitest';
import { DebtsPage } from './DebtsPage';
import { SpendPage } from './SpendPage';
import { App } from '../App';
import { CreditForm } from './CreditForm';
import { ReceivablesPage } from './ReceivablesPage';
import { ReceivableForm } from './ReceivableForm';
import { ReportsPage } from './ReportsPage';
import { PlanPage } from './PlanPage';
import { CalculatorPage, selectedConsolidationDebts } from './CalculatorPage';
import { PlanForm } from './PlanForm';
import type { Snapshot } from '../lib/snapshot';

const data: Snapshot = { wallets: [], tx: {}, debts: [] };
it('máy tính hiển thị chọn nợ an toàn và giải thích không tự chuyển lựa chọn sang kế hoạch', () => {
  const debt = { id: 'd', name: '<script>x</script>', mode: 'formula' as const, balance: 1000000, payment: 100000, dueDay: 10, stmtDay: 0, dueMode: 'day' as const, grace: 0 };
  const html = renderToStaticMarkup(<CalculatorPage debts={[debt]} />);
  expect(html).toContain('So sánh gộp nợ');
  expect(html).toContain('type="checkbox"');
  expect(html).toContain('&lt;script&gt;');
  expect(html).not.toContain('<script>');
  expect(html).toContain('không sửa dữ liệu nợ hoặc tự chuyển lựa chọn sang kế hoạch');
  expect(renderToStaticMarkup(<CalculatorPage />)).toContain('Chưa có khoản nợ đang trả để so sánh');
});
it('không chuyển lựa chọn nợ sang bản chụp mới dù trùng ID', () => {
  const previous = { id: 'd', name: 'Nợ cũ', mode: 'formula' as const, balance: 1000000, payment: 100000, dueDay: 10, stmtDay: 0, dueMode: 'day' as const, grace: 0 };
  const replacement = { ...previous, name: 'Nợ mới', balance: 2000000 };
  expect(selectedConsolidationDebts([previous], [previous])).toEqual([previous]);
  expect(selectedConsolidationDebts([replacement], [previous])).toEqual([]);
  expect(selectedConsolidationDebts([{ ...previous, balance: 0 }], [previous])).toEqual([]);
  expect(selectedConsolidationDebts([], [previous])).toEqual([]);
});
it('biểu mẫu kế hoạch theo dòng không tự ghi nợ và khoá dữ liệu legacy lỗi', () => {
  const html = renderToStaticMarkup(<PlanForm data={{ ...data, plan: { cash: [{ id: 'a', name: '<script>x</script>', a: 50 }], buys: [], loans: [], living: 0, buffer: 0, incomePending: false } }} disabled onSave={async () => {}} />);
  expect(html).toContain('Thêm khoản vay dự định');
  expect(html).toContain('Thêm mua sắm');
  expect(html).toContain('fieldset disabled');
  expect(html).toContain('&lt;script&gt;');
  expect(html).not.toContain('<script>');
  expect(html).not.toContain('Kế hoạch JSON');
  expect(renderToStaticMarkup(<PlanForm data={{ ...data, plan: { loans: [] } }} disabled={false} onSave={async () => {}} />)).toContain('không ghi đè dữ liệu lỗi');
});
it('đề xuất từ máy tính chỉ hiển thị để nhập vào bản nháp, không tự lưu', () => {
  const proposal = { amount: 1000000, rate: 12, months: 12, upfront: 10000 };
  const html = renderToStaticMarkup(<PlanForm data={data} disabled={false} proposal={proposal} onSave={async () => {}} />);
  expect(html).toContain('Nhập đề xuất vào bản nháp');
  expect(html).toContain('Chưa lưu');
  expect(renderToStaticMarkup(<CalculatorPage onPropose={() => {}} />)).toContain('Đề xuất vào kế hoạch');
});
it('biểu mẫu tín dụng khoá khi chưa cho phép ghi và giải thích tác động', () => {
  const html = renderToStaticMarkup(<CreditForm data={data} disabled onSave={async () => {}} />);
  expect(html).toContain('<fieldset disabled=""');
  expect(html).toContain('không trừ tiền ví');
  expect(html).toContain('Hoàn tác khoản mua đã chọn');
});
it('dựng khung ứng dụng và các màn hình khi chưa có dữ liệu', () => {
  const app = renderToStaticMarkup(<App />);
  expect(app).toContain('Bắt đầu từ bức tranh tài chính');
  expect(app).toContain('Tính khoản vay');
  expect(app).toContain('Kế hoạch');
  expect(app).toContain('href="https://naut001.github.io/Loan_Project/v1/"');
  expect(app).not.toContain('2.0 PREVIEW');
  expect(renderToStaticMarkup(<CalculatorPage />)).toContain('Lịch trả chi tiết');
  expect(renderToStaticMarkup(<PlanPage data={data} />)).toContain('Không hiển thị số liệu có thể sai');
  expect(renderToStaticMarkup(<SpendPage data={data} />)).toContain('Không có giao dịch khớp bộ lọc');
  expect(renderToStaticMarkup(<SpendPage data={data} />)).toContain('Xuất CSV toàn bộ tháng');
  expect(renderToStaticMarkup(<SpendPage data={data} />)).toContain('không áp dụng bộ lọc hoặc phân trang');
  expect(renderToStaticMarkup(<DebtsPage data={data} />)).toContain('Không có khoản nợ khớp bộ lọc');
  expect(renderToStaticMarkup(<DebtsPage data={data} />)).toContain('Xuất lịch trả nợ ICS');
});
it('kế hoạch chỉ đọc hiển thị chi tiết và thoát tên nhập từ JSON', () => {
  const plan = { cash: [{ id: 'c', name: 'Ví', a: 1000000 }], living: 0, buffer: 0, incomePending: true, loans: [], buys: [{ id: 'b', name: '<script>x</script>', a: 1000, k: '2026-09' }] };
  const html = renderToStaticMarkup(<PlanPage data={{ ...data, plan, income: 10000 }} today={new Date(2026, 8, 28)} />);
  expect(html).toContain('Dòng tiền 12 tháng tới');
  expect(html).toContain('&lt;script&gt;');
  expect(html).not.toContain('<script>');
});
it('thoát HTML trong tên khoản nợ nhập từ JSON', () => {
  const html = renderToStaticMarkup(<DebtsPage data={{ ...data, debts: [{ id: 'd', name: '<script>alert(1)</script>', mode: 'custom', balance: 50, payment: 50, stmtDay: 0, dueDay: 10, dueMode: 'day', grace: 0, sched: [{ k: '2026-09', a: 50 }] }] }} />);
  expect(html).not.toContain('<script>');
  expect(html).toContain('&lt;script&gt;');
  expect(html).toContain('Xem lịch trả');
});
it('hiển thị dự báo chỉ đọc, thoát HTML và từ chối dự báo phải thu lỗi', () => {
  const recv = [{ id: 'r', name: '<script>x</script>', amount: 100, got: 20, kind: 'once', due: '2026-09-20', startK: '', day: 1, per: 0, inc: true, note: '', log: [] }];
  const html = renderToStaticMarkup(<ReceivablesPage data={{ ...data, recv }} today={new Date(2026, 8, 28)} />);
  expect(html).toContain('Lịch thu dự kiến 12 tháng');
  expect(html).toContain('Chậm thu');
  expect(html).toContain('&lt;script&gt;');
  expect(html).not.toContain('<script>');
  expect(renderToStaticMarkup(<ReceivablesPage data={{ ...data, recv: [{ id: 'incomplete' }] }} />)).toContain('Không hiển thị dự báo có thể sai');
  expect(renderToStaticMarkup(<ReceivableForm recv={[{ id: 'incomplete' }]} disabled={false} onSave={async () => {}} />)).toContain('cần đối chiếu');
});

it('hiển thị dự phóng công thức và báo lỗi thay vì suy diễn lãi suất sai kiểu', () => {
  const debt = { id: 'f', name: 'Vay', mode: 'formula' as const, balance: 1000000, payment: 120000, rate: 12, dueDay: 10, stmtDay: 0, dueMode: 'day' as const, grace: 0 };
  expect(renderToStaticMarkup(<DebtsPage data={{ ...data, debts: [debt] }} />)).toContain('Dự phóng công thức 12 tháng');
  expect(renderToStaticMarkup(<DebtsPage data={{ ...data, debts: [{ ...debt, rate: 'sai' as unknown as number }] }} />)).toContain('Không thể dự phóng khoản nợ công thức');
});
it('báo cáo chỉ đọc hiển thị ngân sách, xu hướng và thoát HTML', () => {
  const html = renderToStaticMarkup(<ReportsPage data={{ ...data, budgets: { '2026-09': { '<script>x</script>': 10 } } }} today="2026-09-29" />);
  expect(html).toContain('Xu hướng chi 6 tháng');
  expect(html).toContain('Danh mục và ngân sách');
  expect(html).toContain('Dự báo chi cuối tháng');
  expect(html).toContain('&lt;script&gt;');
  expect(html).not.toContain('<script>');
});