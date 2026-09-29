import { useEffect, useRef, useState } from 'react';
import { CloudError, createCloudClient } from '../lib/cloud';
import type { Snapshot } from '../lib/snapshot';
import { Button } from './ui/button';
import { localDate } from '../lib/format';

export function CloudPanel({ onLoad, onDisconnect }: { onLoad: (data: Snapshot | null, source: string) => void; onDisconnect: () => void }) {
  const url = (import.meta.env.VITE_SUPABASE_URL || '').trim();
  const key = (import.meta.env.VITE_SUPABASE_KEY || '').trim();
  const client = useRef<ReturnType<typeof createCloudClient> | null>(null);
  const pending = useRef<AbortController | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [account, setAccount] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [wallets, setWallets] = useState<Snapshot['wallets']>([]);
  const [entryType, setEntryType] = useState<'income' | 'expense'>('expense');
  const [wallet, setWallet] = useState('');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(localDate());
  const [note, setNote] = useState('');
  useEffect(() => () => { pending.current?.abort(); client.current?.disconnect(); }, []);

  const disconnect = () => {
    pending.current?.abort(); pending.current = null;
    client.current?.disconnect(); setAccount(''); setPassword(''); setBusy(false); setWallets([]); setAmount(''); setNote('');
    setMessage('Đã đóng kết nối và dữ liệu đang xem. Phiên bản 1.3 không bị ảnh hưởng.'); onDisconnect();
  };
  const run = async (login: boolean) => {
    if (pending.current) return;
    const controller = new AbortController(); pending.current = controller;
    setBusy(true); setMessage('');
    let name = account;
    try {
      client.current ||= createCloudClient(url, key);
      if (login) {
        name = await client.current.signIn(email, password, controller.signal);
        if (controller.signal.aborted) return;
        setAccount(name); setPassword('');
      }
      const data = await client.current.load(controller.signal);
      if (controller.signal.aborted) return;
      onLoad(data, `Tài khoản ${name} · tải lúc ${new Date().toLocaleTimeString('vi-VN')}`);
      setWallets(data?.wallets || []); setWallet(data?.wallets[0]?.id || '');
      setMessage(data ? 'Đã tải dữ liệu. Chỉ ghi khi bạn bấm lưu giao dịch bên dưới.' : 'Tài khoản chưa có dữ liệu. Hãy khởi tạo trong bản 1.3 rồi tải lại.');
    } catch (error) {
      if (controller.signal.aborted) return;
      if (error instanceof CloudError && (error.status === 401 || error.status === 403)) { setAccount(''); onDisconnect(); }
      setPassword('');
      setMessage(error instanceof Error ? error.message : 'Không tải được dữ liệu.');
    } finally {
      if (pending.current === controller) { pending.current = null; setBusy(false); }
    }
  };
  const saveEntry = async () => {
    if (pending.current || !client.current?.canSave()) return;
    const controller = new AbortController(); pending.current = controller; setBusy(true); setMessage('Đang lưu…');
    try {
      const data = await client.current.addCashEntry({ type: entryType, wallet, amount: Number(amount), date, note }, controller.signal);
      if (controller.signal.aborted) return;
      onLoad(data, `Tài khoản ${account} · đã lưu lúc ${new Date().toLocaleTimeString('vi-VN')}`);
      setAmount(''); setNote(''); setMessage('Đã lưu lên Supabase. Không nhập lại giao dịch này ở bản 1.3.');
    } catch (error) {
      if (!controller.signal.aborted && error instanceof CloudError && (error.status === 401 || error.status === 403)) { setAccount(''); setWallets([]); onDisconnect(); }
      if (!controller.signal.aborted) setMessage(`${error instanceof Error ? error.message : 'Lưu thất bại.'} Tải lại và kiểm tra lịch sử trước khi thử lại; nếu mất mạng, giao dịch có thể đã được lưu.`);
    } finally { if (pending.current === controller) { pending.current = null; setBusy(false); } }
  };
  const exportBackup = () => {
    try {
      if (!client.current) return;
      const url = URL.createObjectURL(new Blob([client.current.exportBackup()], { type: 'application/json' }));
      const link = document.createElement('a'); link.href = url; link.download = `so-tra-no-${localDate()}.json`;
      document.body.appendChild(link); link.click(); link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setMessage('Đã yêu cầu tải sao lưu đầy đủ. Tệp chứa dữ liệu tài chính riêng tư; hãy lưu ở nơi an toàn.');
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Không xuất được sao lưu.'); }
  };
  return <section className="panel cloud-panel" aria-label="Tài khoản Supabase">
    <h2>Dữ liệu từ tài khoản</h2>
    {!url || !key ? <p className="footnote">Chưa cấu hình Supabase cho bản 2.0. Bạn vẫn có thể mở JSON. Cấu hình URL và khoá publishable/anon trong tệp môi trường theo hướng dẫn.</p> : <>
      <p className="footnote">Phiên giữ trong bộ nhớ. Không mở đồng thời bản 1.3 để chỉnh sửa: bản cũ chưa có bảo vệ xung đột. Giao dịch bên dưới luôn lưu vào tài khoản này, không lưu vào tệp JSON đang xem.</p>
      {account ? <div className="source"><span>{account}</span><Button disabled={busy} onClick={() => void run(false)}>{busy ? 'Đang tải…' : 'Tải lại dữ liệu'}</Button><Button variant="outline" onClick={disconnect}>Đóng kết nối</Button></div> : <form onSubmit={e => { e.preventDefault(); void run(true); }}>
        <div className="filters"><label>Email<input type="email" autoComplete="username" required value={email} disabled={busy} onChange={e => setEmail(e.target.value)} /></label><label>Mật khẩu<input type="password" autoComplete="current-password" required value={password} disabled={busy} onChange={e => setPassword(e.target.value)} /></label></div>
        <Button type="submit" disabled={busy}>{busy ? 'Đang kết nối…' : 'Đăng nhập và tải dữ liệu'}</Button>{busy && <Button type="button" variant="ghost" onClick={disconnect}>Huỷ</Button>}
      </form>}
      {account && wallets.length > 0 && <form onSubmit={e => { e.preventDefault(); void saveEntry(); }}>
        <h3>Ghi thu / chi vào tài khoản {account}</h3>
        <fieldset disabled={busy || !client.current?.canSave()}>
          <div className="filters"><label>Loại<select value={entryType} onChange={e => setEntryType(e.target.value as 'income' | 'expense')}><option value="expense">Chi tiền · danh mục Khác</option><option value="income">Thu tiền · danh mục Lương</option></select></label><label>Tài khoản<select value={wallet} onChange={e => setWallet(e.target.value)}>{wallets.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}</select></label><label>Số tiền (đ)<input type="number" inputMode="numeric" required min="1" max="1000000000000" step="1" value={amount} onChange={e => setAmount(e.target.value)} /></label><label>Ngày<input type="date" required max={localDate()} value={date} onChange={e => setDate(e.target.value)} /></label><label>Ghi chú<input maxLength={200} value={note} onChange={e => setNote(e.target.value)} /></label></div>
          <p className="footnote">{entryType === 'expense' ? 'Tài khoản tiền giảm' : 'Tài khoản tiền tăng'} đúng số tiền nhập. Không dùng biểu mẫu này để trả nợ hoặc mua tín dụng.</p>
          <Button type="submit">Lưu giao dịch lên Supabase</Button>
        </fieldset>
      </form>}
      {account && <Button variant="outline" disabled={busy || !client.current?.canSave()} onClick={exportBackup}>Tải sao lưu đầy đủ từ tài khoản</Button>}
      {message && <p className="footnote" role="status">{message}</p>}
    </>}
  </section>;
}