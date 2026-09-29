import { useState } from 'react';
import type { Snapshot } from '../lib/snapshot';
import { debtRows } from '../lib/debt';
import { money } from '../lib/format';
import { debtCalendar } from '../lib/exports';
import { formulaForecast } from '../lib/formula-forecast';
import { Button } from './ui/button';

export function DebtsPage({ data }: { data: Snapshot }) {
  const [query, setQuery] = useState('');
  const [onlyOutstanding, setOnlyOutstanding] = useState(false);
  const [exportMessage, setExportMessage] = useState('');
  const exportCalendar = () => {
    let url: string | undefined;
    let link: HTMLAnchorElement | undefined;
    try {
      url = URL.createObjectURL(new Blob([debtCalendar(data)], { type: 'text/calendar;charset=utf-8' }));
      link = document.createElement('a'); link.href = url; link.download = 'so-tra-no-lich-tra-no.ics';
      document.body.appendChild(link); link.click();
      setExportMessage('Đã yêu cầu tải lịch trả nợ. Tệp chứa dữ liệu tài chính riêng tư; lịch không tự cập nhật.');
    } catch (error) {
      setExportMessage(error instanceof Error ? error.message : 'Không tạo được tệp lịch. Dữ liệu không bị thay đổi.');
    } finally {
      link?.remove();
      if (url) { const objectURL = url; setTimeout(() => URL.revokeObjectURL(objectURL), 1000); }
    }
  };
  const balance = (debt: Snapshot['debts'][number]) => debt.mode === 'custom' ? debtRows(debt, new Date()).reduce((sum, row) => sum + row.left, 0) : debt.balance;
  const debts = data.debts.filter(d => d.name.toLocaleLowerCase('vi').includes(query.trim().toLocaleLowerCase('vi')) && (!onlyOutstanding || balance(d) > 0));
  return <section>
    <div className="panel"><Button variant="outline" onClick={exportCalendar}>Xuất lịch trả nợ ICS</Button><p className="footnote">Xuất lịch nhập tay chưa trả và dự phóng công thức trong 12 tháng kể từ tháng hiện tại, gồm kỳ quá hạn; không áp dụng bộ lọc. Nhắc trước một ngày; kiểm tra lại sao kê. Lịch không tự cập nhật. Nhập lại tệp có thể tạo nhắc trùng tuỳ ứng dụng lịch.</p>{exportMessage && <p className="footnote" role="status">{exportMessage}</p>}</div>
    <div className="panel filters"><label>Tìm khoản nợ<input type="search" placeholder="Tên khoản nợ…" value={query} onChange={e => setQuery(e.target.value)} /></label><label className="checkbox-label"><input type="checkbox" checked={onlyOutstanding} onChange={e => setOnlyOutstanding(e.target.checked)} /> Chỉ khoản còn phải trả</label></div>
    <p className="footnote">Lịch nhập tay hiển thị nghĩa vụ còn lại gồm các khoản đã nhập. Dự phóng công thức chỉ đọc, không tự ghi thanh toán hoặc thay đổi số dư.</p>
    <div className="debt-grid">{debts.map(debt => {
      const rows = debtRows(debt, new Date()), left = balance(debt);
      const late = rows.filter(r => r.status === 'Quá hạn').reduce((sum, r) => sum + r.left, 0);
      return <article className="panel" key={debt.id}><div className="section-heading"><h2>{debt.name}</h2><span className="debt-tag">{debt.mode === 'custom' ? 'Lịch nhập tay' : 'Theo công thức'}</span></div><p className="muted">{debt.mode === 'custom' ? 'Còn phải trả theo lịch' : 'Dư nợ trong bản sao lưu'}</p><h3 className="debt-balance">{money(left)}</h3>{late > 0 && <p className="late-note">Quá hạn: {money(late)}</p>}
        {debt.mode === 'custom' ? <details><summary>Xem lịch trả · {rows.length} kỳ</summary><div className="schedule-list">{rows.map(row => <div className="schedule-row" key={row.index}><div><strong>Kỳ {row.k.split('-').reverse().join('/')}</strong><small>Hạn {row.due.toLocaleDateString('vi-VN')}</small><small>{row.status}{row.status === 'Quá hạn' && !!row.settled ? ' · đã trả một phần' : ''}</small></div><div><strong>{money(row.left)}</strong><small>Còn lại / {money(row.a)}</small></div></div>)}{!rows.length && <p className="muted">Chưa có kỳ trả.</p>}</div></details> : <FormulaSchedule debt={debt} />}
      </article>;
    })}</div>{!debts.length && <p className="panel section-empty muted" role="status">Không có khoản nợ khớp bộ lọc.</p>}
  </section>;
}

function FormulaSchedule({ debt }: { debt: Snapshot['debts'][number] }) {
  try {
    const today = new Date();
    const last = today.getFullYear() * 12 + today.getMonth() + 12;
    const rows = debt.balance === 0 ? [] : formulaForecast(debt, today).filter(r => r.due.getFullYear() * 12 + r.due.getMonth() < last);
    return <details><summary>Dự phóng công thức 12 tháng · {rows.length} kỳ</summary><p className="footnote">Ước tính từ dư nợ, lãi suất và số trả hiện tại; đối chiếu sao kê trước khi trả.</p><div className="schedule-list">{rows.map(row => <div className="schedule-row" key={row.key}><span>Hạn {row.due.toLocaleDateString('vi-VN')}</span><strong>{money(row.pay)}</strong></div>)}</div></details>;
  } catch (error) {
    return <p className="footnote" role="alert">{error instanceof Error ? error.message : 'Không thể dự phóng khoản nợ.'}</p>;
  }
}