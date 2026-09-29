import { useEffect, useRef, useState } from 'react';
import { CloudError, createCloudClient, type WalletEntry, type CashEntry } from '../lib/cloud';
import { BatchForm } from './BatchForm';
import { WalletForm } from './WalletForm';
import { BudgetForm } from './BudgetForm';
import { categories } from '../lib/budget';
import { isCashEditable, type Snapshot } from '../lib/snapshot';
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
  const [transfer, setTransfer] = useState(false);
  const [destination, setDestination] = useState('');
  const [wallet, setWallet] = useState('');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(localDate());
  const [note, setNote] = useState('');
  const [category, setCategory] = useState('');
  const [transactions, setTransactions] = useState<Snapshot['tx']>({});
  const [editing, setEditing] = useState('');
  const [budgets, setBudgets] = useState<Snapshot['budgets']>({});
  const selectTransaction = (id: string) => {
    setEditing(id);
    const item = Object.values(transactions).flat().find(t => t.id === id);
    setAmount(item ? String(item.amount) : ''); setNote(item?.note || '');
    setCategory(item?.category && categories.includes(item.category) ? item.category : '');
    setDate(item?.date || localDate()); setTransfer(item?.type === 'transfer');
    setEntryType(item?.type === 'income' ? 'income' : 'expense');
    setDestination(item?.to || ''); setWallet(item?.wallet || wallets[0]?.id || '');
  };
  useEffect(() => () => { pending.current?.abort(); client.current?.disconnect(); }, []);

  const disconnect = () => {
    setTransactions({}); setEditing('');
    setBudgets({});
    setCategory('');
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
      setTransactions(data?.tx || {}); setEditing(''); setAmount(''); setNote('');
      setBudgets(data?.budgets || {});
      setCategory('');
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
  const saveEntry = async (remove = false) => {
    if (pending.current || !client.current?.canSave()) return;
    if (remove && (!editing || !window.confirm('Xoá giao dịch đã chọn? Số dư sẽ được tính lại. Hãy xuất sao lưu trước nếu cần.'))) return;
    const controller = new AbortController(); pending.current = controller; setBusy(true); setMessage('Đang lưu…');
    try {
      const data = remove ? await client.current.removeCashEntry(editing, controller.signal) : await client.current.addCashEntry({ type: transfer ? 'transfer' : entryType, wallet, to: destination, amount: Number(amount), date, note, category: category || undefined }, controller.signal, editing || undefined);
      if (controller.signal.aborted) return;
      setTransactions(data.tx); setEditing('');
      setCategory('');
      onLoad(data, `Tài khoản ${account} · đã lưu lúc ${new Date().toLocaleTimeString('vi-VN')}`);
      setAmount(''); setNote(''); setMessage(client.current.canSave() ? 'Đã lưu lên Supabase. Không nhập lại giao dịch này ở bản 1.3.' : 'Máy chủ đã phản hồi nhưng mốc cập nhật không hợp lệ. Đã khoá ghi; tải lại và kiểm tra lịch sử trước khi tiếp tục.');
    } catch (error) {
      if (!controller.signal.aborted && error instanceof CloudError && (error.status === 401 || error.status === 403)) { setAccount(''); setWallets([]); onDisconnect(); }
      if (!controller.signal.aborted) setMessage(`${error instanceof Error ? error.message : 'Lưu thất bại.'} Tải lại và kiểm tra lịch sử trước khi thử lại; nếu mất mạng, giao dịch có thể đã được lưu.`);
    } finally { if (pending.current === controller) { pending.current = null; setBusy(false); } }
  };
  const saveBatch = async (entries: CashEntry[]): Promise<boolean> => {
    if (pending.current || !client.current?.canSave()) return false;
    const controller = new AbortController(); pending.current = controller; setBusy(true); setMessage('Đang lưu lô chi tiền…');
    try {
      const data = await client.current.addCashBatch(entries, controller.signal);
      if (controller.signal.aborted) return false;
      setTransactions(data.tx);
      onLoad(data, `Tài khoản ${account} · đã lưu lô chi tiền`);
      setMessage(client.current.canSave() ? `Đã lưu ${entries.length} khoản chi. Không nhập lại ở bản 1.3.` : 'Máy chủ đã phản hồi; cần tải lại kiểm tra mốc cập nhật trước khi lưu tiếp.');
      return true;
    } catch (error) {
      if (controller.signal.aborted) return false;
      if (error instanceof CloudError && (error.status === 401 || error.status === 403)) { setAccount(''); onDisconnect(); }
      setMessage(`${error instanceof Error ? error.message : 'Không lưu được lô.'} Nếu đã gửi yêu cầu, tải lại kiểm tra trước khi thử lại.`);
      return false;
    } finally { if (pending.current === controller) { pending.current = null; setBusy(false); } }
  };
  const saveBudget = async (month: string, category: string, amount: number) => {
    if (pending.current || !client.current?.canSave()) return;
    const controller = new AbortController(); pending.current = controller; setBusy(true); setMessage('Đang lưu ngân sách…');
    try {
      const data = await client.current.putBudget(month, category, amount, controller.signal);
      if (controller.signal.aborted) return;
      setBudgets(data.budgets || {});
      onLoad(data, `Tài khoản ${account} · đã lưu ngân sách`);
      setMessage(client.current.canSave() ? 'Đã lưu ngân sách.' : 'Mốc cập nhật không hợp lệ. Tải lại và kiểm tra trước khi tiếp tục.');
    } catch (error) {
      if (controller.signal.aborted) return;
      if (error instanceof CloudError && (error.status === 401 || error.status === 403)) { setAccount(''); onDisconnect(); }
      setMessage(`${error instanceof Error ? error.message : 'Không lưu được ngân sách.'} Tải lại để kiểm tra trước khi thử lại.`);
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
  const saveWallet = async (values: WalletEntry | undefined, id?: string) => {
    const remove = values === undefined;
    if (pending.current || !client.current?.canSave()) return;
    if (remove) {
      const selected = wallets.find(w => w.id === id);
      if (!selected || !window.confirm(`Xoá tài khoản “${selected.name}”? Số dư đầu kỳ ${selected.opening.toLocaleString('vi-VN')} đ sẽ bị loại khỏi tổng tiền. Chỉ xoá được tài khoản chưa có giao dịch. Hãy xuất sao lưu trước nếu cần.`)) return;
    }
    const controller = new AbortController(); pending.current = controller; setBusy(true); setMessage('Đang lưu tài khoản…');
    try {
      const data = values === undefined ? await client.current.removeWallet(id!, controller.signal) : await client.current.putWallet(values, id, controller.signal);
      if (controller.signal.aborted) return;
      setWallets(data.wallets);
      if (!data.wallets.some(w => w.id === wallet)) setWallet(data.wallets[0]?.id || '');
      if (!data.wallets.some(w => w.id === destination)) setDestination('');
      onLoad(data, `Tài khoản ${account} · đã lưu lúc ${new Date().toLocaleTimeString('vi-VN')}`);
      setMessage(client.current.canSave() ? (remove ? 'Đã xoá tài khoản tiền. Lịch sử giao dịch không bị thay đổi.' : 'Đã lưu tài khoản tiền lên Supabase.') : 'Mốc cập nhật không hợp lệ. Đã khoá ghi; tải lại và kiểm tra trước khi tiếp tục.');
    } catch (error) {
      if (controller.signal.aborted) return;
      if (error instanceof CloudError && (error.status === 401 || error.status === 403)) { setAccount(''); setWallets([]); onDisconnect(); }
      setMessage(`${error instanceof Error ? error.message : 'Không lưu được tài khoản.'} Nếu đã gửi yêu cầu, tải lại và kiểm tra trước khi thử lại.`);
    } finally { if (pending.current === controller) { pending.current = null; setBusy(false); } }
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
        <h3>Ghi giao dịch vào tài khoản {account}</h3>
        <fieldset disabled={busy || !client.current?.canSave()}>
          <label>Thêm hoặc sửa giao dịch<select value={editing} onChange={e => selectTransaction(e.target.value)}><option value="">Thêm giao dịch mới</option>{Object.values(transactions).flat().filter(isCashEditable).sort((a, b) => b.date.localeCompare(a.date)).map(t => <option key={t.id} value={t.id}>{t.date} · {t.amount.toLocaleString('vi-VN')} đ · {t.note || t.category || t.type}</option>)}</select></label>
          {editing && <Button type="button" variant="outline" onClick={() => void saveEntry(true)}>Xoá giao dịch đã chọn</Button>}
          {!transfer && <label>Danh mục<select value={category} onChange={e => setCategory(e.target.value)}><option value="">{editing ? 'Giữ danh mục hiện có' : `Mặc định: ${entryType === 'income' ? 'Lương' : 'Khác'}`}</option>{categories.map(c => <option key={c}>{c}</option>)}</select></label>}
          <label><input type="checkbox" checked={transfer} onChange={e => setTransfer(e.target.checked)} /> Chuyển giữa hai tài khoản (thay cho loại thu/chi bên dưới)</label>
          {transfer && <label>Tài khoản nhận<select required value={destination} onChange={e => setDestination(e.target.value)}><option value="">Chọn tài khoản nhận</option>{wallets.filter(w => w.id !== wallet).map(w => <option key={w.id} value={w.id}>{w.name}</option>)}</select></label>}
          <div className="filters"><label>Loại<select value={entryType} onChange={e => setEntryType(e.target.value as 'income' | 'expense')}><option value="expense">Chi tiền</option><option value="income">Thu tiền</option></select></label><label>Tài khoản<select value={wallet} onChange={e => setWallet(e.target.value)}>{wallets.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}</select></label><label>Số tiền (đ)<input type="number" inputMode="numeric" required min="1" max="1000000000000" step="1" value={amount} onChange={e => setAmount(e.target.value)} /></label><label>Ngày<input type="date" required max={localDate()} value={date} onChange={e => setDate(e.target.value)} /></label><label>Ghi chú<input maxLength={200} value={note} onChange={e => setNote(e.target.value)} /></label></div>
          <p className="footnote">{transfer ? 'Tài khoản gửi giảm, tài khoản nhận tăng cùng số tiền; không tính vào thu nhập hoặc chi tiêu.' : `${entryType === 'expense' ? 'Tài khoản tiền giảm' : 'Tài khoản tiền tăng'} đúng số tiền nhập.`} Không dùng biểu mẫu này để trả nợ hoặc mua tín dụng.</p>
          <Button type="submit">Lưu giao dịch lên Supabase</Button>
        </fieldset>
      </form>}
      {account && <WalletForm key={`${account}:${JSON.stringify(wallets)}`} wallets={wallets} disabled={busy || !client.current?.canSave()} onSave={saveWallet} onRemove={id => saveWallet(undefined, id)} />}
      {account && wallets.length > 0 && <BatchForm key={`${account}:${JSON.stringify(wallets)}`} wallets={wallets} disabled={busy || !client.current?.canSave()} onSave={saveBatch} />}
      {account && <BudgetForm data={{ wallets, tx: transactions, debts: [], budgets }} disabled={busy || !client.current?.canSave()} onSave={saveBudget} />}
      {account && <Button variant="outline" disabled={busy || !client.current?.canSave()} onClick={exportBackup}>Tải sao lưu đầy đủ từ tài khoản</Button>}
      {message && <p className="footnote" role="status">{message}</p>}
    </>}
  </section>;
}