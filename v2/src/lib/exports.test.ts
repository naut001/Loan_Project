import { readFileSync } from 'node:fs';
import { createContext, runInContext } from 'node:vm';
import { expect, it } from 'vitest';
import { csvCell, customDebtCalendar, debtCalendar, transactionsCSV } from './exports';
import { parseSnapshot, type Snapshot } from './snapshot';

const data: Snapshot = {
  wallets: [{ id: 'cash', name: 'Tiền mặt', opening: 0 }, { id: 'bank', name: '=SUM(1,2)', opening: 0 }], debts: [],
  tx: { '2026-09': (['income', 'expense', 'transfer', 'credit', 'repayment'] as const).map((type, i) => ({
    id: String(i), date: `2026-09-0${i + 1}`, type, amount: 100 + i, wallet: type === 'credit' ? '' : 'cash',
    to: type === 'transfer' ? 'bank' : '', category: 'Khác', note: 'Mua "đồ",\nxong', debt: 'd', row: 'r', interest: 10, fee: 5,
  })), '2026-08': [{ id: 'old', date: '2026-08-01', type: 'income', wallet: 'cash', amount: 999 }] },
};

it('CSV trùng bản 1.3 cho mọi loại giao dịch và không sửa dữ liệu nguồn', () => {
  const ctx = createContext({});
  for (const file of ['util.js', 'loan.js', 'model.js', 'spend.js', 'exports.js']) {
    runInContext(readFileSync(new URL(`../../../js/${file}`, import.meta.url), 'utf8'), ctx);
  }
  const before = JSON.stringify(data);
  expect(transactionsCSV('2026-09', data)).toBe(runInContext(`transactionsCSV('2026-09', ${before})`, ctx));
  expect(JSON.stringify(data)).toBe(before);
});
it.each(['=1+1', '+SUM(A1)', '-1+2', '@SUM(A1)', '  =1', '\ttext', '\rtext', '\ntext'])('vô hiệu công thức hoặc tiền tố nguy hiểm %j', value => {
  expect(csvCell(value)).toBe(`"'${value}"`);
});
it('thoát dấu nháy, giữ tiếng Việt, dấu phẩy và xuống dòng trong ô', () => {
  expect(csvCell('Ăn "sáng",\ntrưa')).toBe('"Ăn ""sáng"",\ntrưa"');
  expect(csvCell(undefined)).toBe('""');
  expect(csvCell(123)).toBe('"123"');
});
it('tháng trống vẫn có BOM, tiêu đề 11 cột và CRLF', () => {
  const csv = transactionsCSV('2026-01', data);
  expect(csv.startsWith('\uFEFF"Ngày"')).toBe(true);
  expect(csv.split('\r\n')).toHaveLength(2);
  expect(csv.split(',')).toHaveLength(11);
  expect(csv.endsWith('"Phí ngoài lịch"\r\n')).toBe(true);
});
it('xuất đủ hơn 25 dòng, chỉ tháng đã chọn và giữ thứ tự dữ liệu nguồn', () => {
  const rows = Array.from({ length: 30 }, (_, i) => ({ id: String(i).padStart(2, '0'), date: '2026-09-01', type: 'expense' as const, wallet: 'cash', amount: i + 1, note: `dòng ${i}` })).reverse();
  const source = { ...data, tx: { ...data.tx, '2026-09': rows } };
  const csv = transactionsCSV('2026-09', source);
  expect(csv.split('\r\n')).toHaveLength(32);
  expect(csv).not.toContain('2026-08');
  expect(csv.indexOf('dòng 0')).toBeLessThan(csv.indexOf('dòng 29'));
  expect(source.tx['2026-09'][0].id).toBe('29');
});
it('giữ mã nợ và kỳ qua parser tới CSV; chuyển ví không xuất danh mục', () => {
  const snapshot = parseSnapshot(JSON.stringify({ v: 1, ...data }));
  const csv = transactionsCSV('2026-09', snapshot);
  expect(csv).toContain('"d","r","10","5"');
  expect(csv).toContain('"Chuyển ví","102","Tiền mặt","\'=SUM(1,2)",""');
});
it('từ chối tháng không hợp lệ', () => {
  for (const month of ['', '2026-13', '2026-00', '../2026-09']) expect(() => transactionsCSV(month, data)).toThrow('Tháng');
});

it('xuất ICS chỉ cho lịch nhập tay, gộp tháng, bỏ kỳ đã trả và giữ kỳ quá hạn', () => {
  const snapshot = parseSnapshot(JSON.stringify({ v: 1, wallets: [], tx: {}, debts: [
    { id: 'custom', name: 'Khoản, cần trả', mode: 'custom', balance: 80, payment: 80, stmtDay: 0, dueDay: 10, dueMode: 'day', grace: 0, sched: [
      { id: 'a', k: '2026-08', a: 30 }, { id: 'b', k: '2026-08', a: 20, settled: 10 }, { id: 'c', k: '2026-09', a: 50, p: '2026-09-01' },
    ] },
    { id: 'formula', name: 'Không tự suy diễn', mode: 'formula', balance: 100, payment: 10, stmtDay: 0, dueDay: 10, dueMode: 'day', grace: 0 },
  ] }));
  const ics = customDebtCalendar(snapshot, new Date(2026, 8, 29));
  expect(ics).toContain('DTSTART;VALUE=DATE:20260810');
  expect(ics).toContain('Dự kiến 40 đ');
  expect(ics.match(/BEGIN:VEVENT/g)).toHaveLength(1);
  expect(ics).not.toContain('20260910');
  expect(ics).not.toContain('Không tự suy diễn');
  expect(ics).toContain('\\,');
  expect(ics).toContain('TRIGGER:-P1D');
});

it('ICS giữ ngày địa phương, kết thúc độc quyền và gấp dòng UTF-8 tối đa 75 byte', () => {
  const source: Snapshot = { ...data, debts: [{ id: 'd', name: 'Nợ tiếng Việt;\\\n'.repeat(20), mode: 'custom', balance: 100, payment: 10, dueDay: 31, stmtDay: 0, dueMode: 'day', grace: 0, sched: [
    { k: '2027-02', a: 20 }, { k: '2027-09', a: 80 },
  ] }] };
  const before = JSON.stringify(source);
  const calendar = customDebtCalendar(source, new Date(2026, 8, 29));
  expect(calendar).toContain('DTSTART;VALUE=DATE:20270228');
  expect(calendar).toContain('DTEND;VALUE=DATE:20270301');
  expect(calendar).not.toContain('20270930');
  for (const line of calendar.split('\r\n')) expect(new TextEncoder().encode(line).length).toBeLessThanOrEqual(75);
  expect(calendar.replace(/\r\n /g, '')).toContain('\\;\\\\\\n');
  expect(JSON.stringify(source)).toBe(before);
  expect(() => customDebtCalendar(source, new Date(NaN))).toThrow('Ngày');
});

it('ICS lịch nhập tay đối chiếu byte-for-byte với bản 1.3 ngoại trừ thời điểm xuất', () => {
  const ctx = createContext({ __TODAY__: '2026-09-29' });
  for (const file of ['util.js', 'loan.js', 'model.js', 'spend.js', 'exports.js']) {
    runInContext(readFileSync(new URL(`../../../js/${file}`, import.meta.url), 'utf8'), ctx);
  }
  const snapshot = parseSnapshot(JSON.stringify({ v: 1, wallets: [], tx: {}, debts: [{
    id: 'd', name: 'Nợ, nhà; thử', mode: 'custom', balance: 110, payment: 20, dueDay: 31, stmtDay: 0, dueMode: 'day', grace: 0,
    sched: [{ k: '2026-08', a: 20 }, { k: '2026-08', a: 30, settled: 10 }, { k: '2027-02', a: 40 }, { k: '2027-09', a: 40 }],
  }] }));
  const legacy = runInContext(`debtCalendar(${JSON.stringify(snapshot)})`, ctx) as string;
  const modern = customDebtCalendar(snapshot, new Date(2026, 8, 29));
  const normalize = (ics: string) => ics.replace(/DTSTAMP:\d{8}T\d{6}Z/g, 'DTSTAMP:EXPORT-TIME');
  expect(normalize(modern)).toBe(normalize(legacy));
});

it('ICS khoản công thức đối chiếu bản 1.3, gồm đã trả tháng này và sao kê chuyển tháng', () => {
  const ctx = createContext({ __TODAY__: '2026-09-29' });
  for (const file of ['util.js', 'loan.js', 'model.js', 'spend.js', 'exports.js']) runInContext(readFileSync(new URL(`../../../js/${file}`, import.meta.url), 'utf8'), ctx);
  for (const paid of [{}, { '2026-09': '2026-09-01' }]) {
    const snapshot = parseSnapshot(JSON.stringify({ v: 1, wallets: [], tx: {}, debts: [{
      id: 'f', name: 'Vay nhà', mode: 'formula', balance: 1000000, payment: 100000, rate: 12, paid,
      dueDay: 10, stmtDay: 27, dueMode: 'day', grace: 0,
    }] }));
    const legacy = runInContext(`debtCalendar(${JSON.stringify(snapshot)})`, ctx) as string;
    const modern = debtCalendar(snapshot, new Date(2026, 8, 29));
    expect(modern.replace(/DTSTAMP:\d{8}T\d{6}Z/g, 'STAMP')).toBe(legacy.replace(/DTSTAMP:\d{8}T\d{6}Z/g, 'STAMP'));
  }
});