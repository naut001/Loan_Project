import { useRef, useState } from 'react';
import { ArrowDownLeft, ArrowUpRight, CheckCheck, CreditCard, ExternalLink, LayoutDashboard, Moon, ShieldCheck, Sun, Upload, Wallet } from 'lucide-react';
import { Button } from './components/ui/button';
import { DebtsPage } from './components/DebtsPage';
import { SpendPage } from './components/SpendPage';
import { CloudPanel } from './components/CloudPanel';
import { parseSnapshot, summarize, type Snapshot } from './lib/snapshot';

const money = (n: number) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(n);
const liveUrl = 'https://naut001.github.io/Loan_Project/';
const labels = { income: 'Thu nhập', expense: 'Chi tiêu', credit: 'Mua tín dụng', repayment: 'Thanh toán nợ', transfer: 'Chuyển tài khoản' };
const localDate = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
type View = 'dashboard' | 'spend' | 'debts';

export function App() {
  const [dark, setDark] = useState(false);
  const [data, setData] = useState<Snapshot | null>(null);
  const [error, setError] = useState('');
  const [source, setSource] = useState('');
  const [view, setView] = useState<View>('dashboard');
  const input = useRef<HTMLInputElement>(null);
  const summary = data ? summarize(data, localDate()) : null;
  const load = (raw: string, name: string) => {
    try { setData(parseSnapshot(raw)); setSource(name); setError(''); }
    catch (e) { setError(e instanceof Error ? e.message : 'Không đọc được dữ liệu.'); }
  };
  const readLocal = () => {
    try { const raw = localStorage.getItem('so-tra-no:v1'); if (!raw) throw new Error('Không có dữ liệu trên địa chỉ này. Hãy xuất JSON từ bản hiện tại rồi mở tại đây.'); load(raw, 'Bản chụp dữ liệu trên thiết bị'); }
    catch (e) { setError(e instanceof Error ? e.message : 'Trình duyệt chặn bộ nhớ.'); }
  };

  return <div className={dark ? 'app dark' : 'app'}>
    <a className="skip" href="#main">Đến nội dung chính</a>
    <aside className="sidebar">
      <a href="#main" className="brand"><span className="brand-icon"><Wallet size={23} /></span><span>Sổ trả nợ<small>TÀI CHÍNH CÁ NHÂN</small></span></a>
      <p className="nav-label">KHÔNG GIAN CỦA BẠN</p>
      <nav aria-label="Điều hướng"><button className={`nav-link ${view === 'dashboard' ? 'active' : ''}`} onClick={() => setView('dashboard')}><LayoutDashboard size={19} /> Tổng quan</button><button className={`nav-link ${view === 'debts' ? 'active' : ''}`} onClick={() => setView('debts')}><CreditCard size={19} /> Khoản nợ</button><button className={`nav-link ${view === 'spend' ? 'active' : ''}`} onClick={() => setView('spend')}><Wallet size={19} /> Chi tiêu</button></nav>
      <div className="sidebar-bottom"><ShieldCheck size={25} /><strong>Dữ liệu vẫn thuộc về bạn</strong><p>Bản xem trước có lưu thu/chi. Không sửa lịch nợ hoặc các dữ liệu khác.</p><a href={liveUrl} className="text-link">Mở ứng dụng hiện tại <ExternalLink size={14} /></a></div>
    </aside>
    <div className="workspace">
      <header className="topbar"><span className="preview-badge">2.0 PREVIEW · THU / CHI CLOUD</span><Button variant="ghost" onClick={() => setDark(!dark)} aria-label={dark ? 'Bật giao diện sáng' : 'Bật giao diện tối'}>{dark ? <Sun size={20} /> : <Moon size={20} />}</Button></header>
      <main id="main" tabIndex={-1}>
        <div className="page-heading"><div><p className="eyebrow">MỘT GÓC NHÌN RÕ RÀNG HƠN</p><h1>{view === 'debts' ? 'Khoản nợ' : view === 'spend' ? 'Chi tiêu' : 'Tài chính của bạn'}</h1><p className="muted">{view === 'dashboard' ? 'Ít lo lắng hơn. Chủ động hơn mỗi ngày.' : 'Xem rõ dữ liệu trước khi mở quyền chỉnh sửa.'}</p></div><Button onClick={() => input.current?.click()}><Upload size={17} /> Mở bản sao lưu</Button></div>
        <input ref={input} type="file" accept=".json,application/json" className="hidden" aria-label="Mở bản sao lưu JSON" onChange={async e => { const file = e.target.files?.[0]; e.target.value = ''; if (!file) return; if (file.size > 5 * 1024 * 1024) { setError('Bản sao lưu vượt giới hạn xem trước 5 MB.'); return; } try { load(await file.text(), file.name); } catch { setError('Không đọc được tệp. Hãy thử lại.'); } }} />
        <div className="notice"><ShieldCheck size={21} /><div><strong>Không ảnh hưởng dữ liệu đang sử dụng</strong><p>Mở tệp JSON để xem giao diện với dữ liệu của bạn. Tệp chỉ được xử lý trong trình duyệt; tải lại trang sẽ đóng bản chụp này.</p></div></div>
        {error && <p role="alert" className="error">{error}</p>}
        <CloudPanel onLoad={(snapshot, name) => { setData(snapshot); setSource(name); setError(''); }} onDisconnect={() => { setData(null); setSource(''); setError(''); }} />
        {data && view !== 'dashboard' && <div className="source" role="status">{source}<Button variant="ghost" onClick={() => { setData(null); setSource(''); }}>Đóng bản chụp</Button></div>}
        {!summary ? <section className="empty panel"><div className="empty-icon"><Wallet size={34} /></div><h2>Bắt đầu từ bức tranh tài chính của bạn</h2><p>Không dùng số dư minh hoạ để tránh nhầm với tiền thật. Mở bản sao lưu từ ứng dụng hiện tại hoặc đọc dữ liệu cùng địa chỉ trình duyệt.</p><div className="actions"><Button onClick={() => input.current?.click()}><Upload size={17} /> Chọn tệp JSON</Button><Button variant="outline" onClick={readLocal}>Đọc dữ liệu trên thiết bị</Button></div><a className="text-link" href={liveUrl}>Đến bản hiện tại để xuất sao lưu <ExternalLink size={14} /></a></section> : view === 'spend' ? <SpendPage data={data!} /> : view === 'debts' ? <DebtsPage data={data!} /> : <>
          <div className="source" role="status"><CheckCheck size={16} /> {source}<Button variant="ghost" onClick={() => { setData(null); setSource(''); setError(''); }}>Đóng bản chụp</Button></div>
          <div className="stats"><section className="stat primary"><Wallet size={22} /><p>Tiền trong các tài khoản</p><h2>{money(summary.cash)}</h2><small>Số dư đến hôm nay, chưa trừ nghĩa vụ nợ</small></section><section className="stat panel"><ArrowUpRight size={22} /><p>Chi tiêu tháng này</p><h2>{money(summary.expense)}</h2><small>Gồm mua tín dụng; không đếm lại gốc trả nợ</small></section><section className="stat panel"><ArrowDownLeft size={22} /><p>Thu nhập tháng này</p><h2>{money(summary.income)}</h2><small>Không bao gồm số dư đầu kỳ và chuyển ví</small></section></div>
          <div className="content-grid"><section className="panel" id="transactions"><div className="section-heading"><h2>Giao dịch tháng này</h2><span className="muted">{summary.recent.length} giao dịch</span></div>{summary.recent.length ? summary.recent.slice(0, 10).map(t => <div className="transaction" key={t.id}><span className="transaction-icon">{t.type === 'income' ? <ArrowDownLeft size={19} /> : <ArrowUpRight size={19} />}</span><div className="transaction-info"><strong>{t.note || t.category || labels[t.type]}</strong><small>{labels[t.type]} · {t.date.split('-').reverse().join('/')}</small></div><strong className="amount">{money(t.amount)}</strong></div>) : <p className="muted section-empty">Chưa có giao dịch trong tháng này.</p>}{summary.recent.length > 10 && <p className="muted">Đang hiển thị 10 giao dịch gần nhất.</p>}</section><section className="panel" id="accounts"><div className="section-heading"><h2>Tài khoản</h2><Wallet size={20} /></div>{summary.balances.map(w => <div className="account" key={w.id}><span>{w.name}</span><strong>{money(w.balance)}</strong></div>)}<p className="footnote">Đây là số liệu từ bản chụp, không phải dữ liệu đồng bộ trực tiếp.</p></section></div>
        </>}
        <footer>Thiết kế mới, giữ nguyên sự cẩn trọng với từng con số.<br />Đã hỗ trợ lưu thu/chi. Mua tín dụng và thanh toán nợ dùng bản hiện tại.</footer>
      </main>
      <nav className="mobile-nav" aria-label="Điều hướng điện thoại"><button onClick={() => setView('dashboard')}><LayoutDashboard size={20} />Tổng quan</button><button onClick={() => setView('debts')}><CreditCard size={20} />Khoản nợ</button><button onClick={() => setView('spend')}><Wallet size={20} />Chi tiêu</button></nav>
    </div>
  </div>;
}