import { useState } from 'react';
import type { Snapshot } from '../lib/snapshot';
import { categories } from '../lib/budget';
import { localDate, money } from '../lib/format';
import { monthReport, shiftMonth } from '../lib/report';

export function ReportsPage({ data, today = localDate() }: { data: Snapshot; today?: string }) {
  const [month, setMonth] = useState(today.slice(0, 7));
  const current = monthReport(data, month);
  const previousKey = shiftMonth(month, -1);
  const previous = monthReport(data, previousKey);
  const budget = data.budgets?.[month] || {};
  const names = [...new Set([...categories, ...Object.keys(current.categories), ...Object.keys(budget)])].filter(c => current.categories[c] || budget[c]);
  const trend = Array.from({ length: 6 }, (_, i) => { const key = shiftMonth(month, i - 5); return { key, ...monthReport(data, key) }; });
  const forecast = month === today.slice(0, 7) ? Math.round(monthReport(data, month, today).expense / Number(today.slice(8)) * new Date(Number(month.slice(0, 4)), Number(month.slice(5)), 0).getDate()) : null;
  return <div className="reports-page">
    <section className="panel"><h2>Báo cáo thu chi</h2><div className="filters"><label>Tháng báo cáo<input type="month" value={month} onChange={e => setMonth(e.target.value)} /></label></div>
      <div className="stats">{([['Thu', current.income], ['Chi tiêu (gồm lãi/phí ngoài lịch)', current.expense], ['Tiền trả nợ', current.repayment], ['Dòng tiền ròng', current.net]] as const).map(([label, value]) => <div className="stat panel" key={label}><p>{label}</p><h2>{money(value)}</h2></div>)}</div>
      <p>Chi {current.expense >= previous.expense ? 'tăng' : 'giảm'} <strong>{money(Math.abs(current.expense - previous.expense))}</strong> so với toàn bộ tháng {previousKey}.</p>
      <p className="footnote">So sánh số đã ghi, không suy ra tháng không có dữ liệu là không chi tiêu.{forecast !== null ? ` Tháng hiện tại chưa kết thúc. Dự báo chi cuối tháng: ${money(forecast)} (bình quân theo số ngày đã qua, chỉ tham khảo).` : ''}</p>
    </section>
    <section className="panel"><h2>Danh mục và ngân sách</h2>{names.length ? names.map(name => <div className="report-line" key={name}><strong>{name}</strong><span>{money(current.categories[name] || 0)}{budget[name] ? ` / ${money(budget[name])}` : ' · chưa đặt ngân sách'}{budget[name] > 0 && (current.categories[name] || 0) > budget[name] ? ` · Vượt ${money(current.categories[name] - budget[name])}` : ''}</span></div>) : <p className="muted">Chưa có chi tiêu hoặc ngân sách.</p>}</section>
    <section className="panel"><h2>Xu hướng chi 6 tháng</h2>{trend.map(row => <div className="report-line" key={row.key}><strong>{row.key}</strong><span>{money(row.expense)}</span></div>)}</section>
    <p className="footnote">Chuyển giữa các ví không tính là thu nhập hay chi tiêu. Báo cáo chỉ dùng giao dịch đã nhập, không tự lấy lương dự kiến hay lịch trả nợ. Chỉ đọc; không ghi dữ liệu.</p>
  </div>;
}