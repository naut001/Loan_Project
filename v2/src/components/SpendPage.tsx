import { useState } from 'react';
import type { Snapshot, Transaction } from '../lib/snapshot';
import { money, labels, localDate } from '../lib/format';
import { transactionsCSV } from '../lib/exports';
import { Button } from './ui/button';

export function SpendPage({ data }: { data: Snapshot }) {
  const [month, setMonth] = useState(localDate().slice(0, 7));
  const [wallet, setWallet] = useState('');
  const [type, setType] = useState('');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [exportMessage, setExportMessage] = useState('');
  const exportCSV = () => {
    let url: string | undefined;
    let link: HTMLAnchorElement | undefined;
    try {
      url = URL.createObjectURL(new Blob([transactionsCSV(month, data)], { type: 'text/csv;charset=utf-8' }));
      link = document.createElement('a'); link.href = url; link.download = `so-tra-no-${month}.csv`;
      document.body.appendChild(link); link.click();
      setExportMessage(`Đã yêu cầu tải CSV toàn bộ tháng ${month}. Tệp chứa dữ liệu tài chính riêng tư.`);
    } catch {
      setExportMessage('Không tạo được tệp CSV. Vui lòng thử lại. Dữ liệu không bị thay đổi.');
    } finally {
      link?.remove();
      if (url) { const objectURL = url; setTimeout(() => URL.revokeObjectURL(objectURL), 1000); }
    }
  };
  const months = [...new Set([localDate().slice(0, 7), ...Object.keys(data.tx)])].sort().reverse();
  const rows = (data.tx[month] || []).filter(t => (!wallet || t.wallet === wallet || t.to === wallet) && (!type || t.type === type) && `${t.note || ''} ${t.category || ''}`.toLocaleLowerCase('vi').includes(query.trim().toLocaleLowerCase('vi'))).slice().sort((a, b) => b.date.localeCompare(a.date) || a.id.localeCompare(b.id));
  const walletName = (id?: string) => data.wallets.find(w => w.id === id)?.name || '—';
  const source = (t: Transaction) => t.type === 'credit' ? 'Tín dụng · không trừ tài khoản' : `${walletName(t.wallet)}${t.type === 'transfer' ? ` → ${walletName(t.to)}` : ''}`;
  return <section className="panel">
    <div className="section-heading"><h2>Sổ giao dịch</h2><span className="muted">{rows.length} kết quả</span></div>
    <div className="filters">
      <label>Tháng<select value={month} onChange={e => { setMonth(e.target.value); setPage(1); }}>{months.map(m => <option key={m}>{m}</option>)}</select></label>
      <label>Tài khoản<select value={wallet} onChange={e => { setWallet(e.target.value); setPage(1); }}><option value="">Tất cả tài khoản</option>{data.wallets.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}</select></label>
      <label>Loại giao dịch<select value={type} onChange={e => { setType(e.target.value); setPage(1); }}><option value="">Tất cả loại</option>{Object.entries(labels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
      <label>Tìm kiếm<input type="search" value={query} placeholder="Ghi chú hoặc danh mục…" onChange={e => { setQuery(e.target.value); setPage(1); }} /></label>
    </div>
    <p className="footnote">Thanh toán gốc nợ và chuyển tài khoản được tách khỏi chi tiêu. Bộ lọc tài khoản bao gồm cả giao dịch chuyển đến.</p>
    <Button variant="outline" onClick={exportCSV}>Xuất CSV toàn bộ tháng {month}</Button>
    <p className="footnote">CSV xuất dữ liệu đang xem của cả tháng, không áp dụng bộ lọc hoặc phân trang. Đây không phải bản sao lưu đầy đủ để khôi phục ứng dụng.</p>
    {exportMessage && <p className="footnote" role="status">{exportMessage}</p>}
    {rows.slice(0, page * 25).map(t => <article className="transaction" key={t.id}><div className="transaction-info"><strong>{t.note || t.category || labels[t.type]}</strong><small>{labels[t.type]} · {t.date.split('-').reverse().join('/')}</small><small>{source(t)}</small>{t.type === 'repayment' && <small>Lãi/phí ngoài lịch: {money((t.interest || 0) + (t.fee || 0))}</small>}</div><strong className="amount">{t.type === 'income' ? '+' : ''}{money(t.amount)}</strong></article>)}
    {!rows.length && <p className="section-empty muted" role="status">Không có giao dịch khớp bộ lọc.</p>}
    {rows.length > page * 25 && <button className="text-link" onClick={() => setPage(page + 1)}>Xem thêm 25 giao dịch</button>}
  </section>;
}