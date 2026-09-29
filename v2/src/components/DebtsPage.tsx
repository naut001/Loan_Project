import { useState } from 'react';
import type { Snapshot } from '../lib/snapshot';
import { debtRows } from '../lib/debt';
import { money } from '../lib/format';

export function DebtsPage({ data }: { data: Snapshot }) {
  const [query, setQuery] = useState('');
  const [onlyOutstanding, setOnlyOutstanding] = useState(false);
  const balance = (debt: Snapshot['debts'][number]) => debt.mode === 'custom' ? debtRows(debt, new Date()).reduce((sum, row) => sum + row.left, 0) : debt.balance;
  const debts = data.debts.filter(d => d.name.toLocaleLowerCase('vi').includes(query.trim().toLocaleLowerCase('vi')) && (!onlyOutstanding || balance(d) > 0));
  return <section>
    <div className="panel filters"><label>Tìm khoản nợ<input type="search" placeholder="Tên khoản nợ…" value={query} onChange={e => setQuery(e.target.value)} /></label><label className="checkbox-label"><input type="checkbox" checked={onlyOutstanding} onChange={e => setOnlyOutstanding(e.target.checked)} /> Chỉ khoản còn phải trả</label></div>
    <p className="footnote">Lịch nhập tay hiển thị nghĩa vụ còn lại gồm các khoản đã nhập. Khoản theo công thức hiển thị dư nợ từ bản sao lưu; chưa dựng lịch dự phóng ở bản alpha.</p>
    <div className="debt-grid">{debts.map(debt => {
      const rows = debtRows(debt, new Date()), left = balance(debt);
      const late = rows.filter(r => r.status === 'Quá hạn').reduce((sum, r) => sum + r.left, 0);
      return <article className="panel" key={debt.id}><div className="section-heading"><h2>{debt.name}</h2><span className="debt-tag">{debt.mode === 'custom' ? 'Lịch nhập tay' : 'Theo công thức'}</span></div><p className="muted">{debt.mode === 'custom' ? 'Còn phải trả theo lịch' : 'Dư nợ trong bản sao lưu'}</p><h3 className="debt-balance">{money(left)}</h3>{late > 0 && <p className="late-note">Quá hạn: {money(late)}</p>}
        {debt.mode === 'custom' ? <details><summary>Xem lịch trả · {rows.length} kỳ</summary><div className="schedule-list">{rows.map(row => <div className="schedule-row" key={row.index}><div><strong>Kỳ {row.k.split('-').reverse().join('/')}</strong><small>Hạn {row.due.toLocaleDateString('vi-VN')}</small><small>{row.status}{row.status === 'Quá hạn' && !!row.settled ? ' · đã trả một phần' : ''}</small></div><div><strong>{money(row.left)}</strong><small>Còn lại / {money(row.a)}</small></div></div>)}{!rows.length && <p className="muted">Chưa có kỳ trả.</p>}</div></details> : <p className="footnote">Mức trả định kỳ: {money(debt.payment)}. Xem hạn trả và lịch dự phóng trong bản hiện tại; không suy diễn trạng thái đã trả từ số dư.</p>}
      </article>;
    })}</div>{!debts.length && <p className="panel section-empty muted" role="status">Không có khoản nợ khớp bộ lọc.</p>}
  </section>;
}