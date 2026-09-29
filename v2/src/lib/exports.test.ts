import { readFileSync } from 'node:fs';
import { createContext, runInContext } from 'node:vm';
import { expect, it } from 'vitest';
import { csvCell, transactionsCSV } from './exports';
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