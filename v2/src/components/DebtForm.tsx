import { useState } from 'react';
import type { Debt } from '../lib/debt';
import type { DebtDetails } from '../lib/debt-edit';
import { Button } from './ui/button';

export function DebtForm({ debts, disabled, onSave }: { debts: Debt[]; disabled: boolean; onSave: (values: DebtDetails | undefined, id?: string) => Promise<void> }) {
  const [id, setId] = useState('');
  const [name, setName] = useState('');
  const [dueDay, setDueDay] = useState('1');
  const [stmtDay, setStmtDay] = useState('0');
  const [dueMode, setDueMode] = useState<'day' | 'after'>('day');
  const [grace, setGrace] = useState('0');
  const [formula, setFormula] = useState(false);
  const [balance, setBalance] = useState('');
  const [payment, setPayment] = useState('');
  const [rate, setRate] = useState('0');
  const select = (id: string) => {
    const debt = debts.find(d => d.id === id);
    setId(id); setName(debt?.name || ''); setDueDay(String(debt?.dueDay ?? 1));
    setStmtDay(String(debt?.stmtDay ?? 0)); setDueMode(debt?.dueMode || 'day'); setGrace(String(debt?.grace ?? 0));
    setFormula(false); setBalance(String(debt?.balance ?? '')); setPayment(String(debt?.payment ?? ''));
    setRate(String((debt as unknown as { rate?: number } | undefined)?.rate ?? 0));
  };
  return <form onSubmit={e => { e.preventDefault(); void onSave({ name, dueDay: Number(dueDay), stmtDay: Number(stmtDay), dueMode, grace: Number(grace), ...(formula ? { formula: { balance: Number(balance), payment: Number(payment), rate: Number(rate) } } : {}) }, id || undefined); }}>
    <h3>Quản lý thông tin khoản nợ</h3>
    <fieldset disabled={disabled}>
      <div className="filters">
        <label>Khoản nợ<select value={id} onChange={e => select(e.target.value)}><option value="">Tạo khoản nợ mới</option>{debts.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}</select></label>
        <label>Tên khoản nợ<input required maxLength={80} value={name} onChange={e => setName(e.target.value)} /></label>
        <label>Ngày đến hạn<input required type="number" min="1" max="31" step="1" value={dueDay} onChange={e => setDueDay(e.target.value)} /></label>
        <label>Ngày sao kê (0 nếu không có)<input required type="number" min="0" max="31" step="1" value={stmtDay} onChange={e => setStmtDay(e.target.value)} /></label>
        <label>Cách tính hạn<select value={dueMode} onChange={e => setDueMode(e.target.value as 'day' | 'after')}><option value="day">Ngày cố định</option><option value="after">Sau ngày sao kê</option></select></label>
        <label>Số ngày sau sao kê<input required type="number" min="0" max="60" step="1" value={grace} onChange={e => setGrace(e.target.value)} /></label>
      </div>
      {(!id || debts.find(d => d.id === id)?.mode === 'formula') && <label><input type="checkbox" checked={formula} onChange={e => setFormula(e.target.checked)} />{id ? 'Sửa thông số công thức (chỉ khi chưa có lịch sử)' : 'Tạo khoản vay công thức thay cho lịch tháng'}</label>}
      {formula && <div className="filters">
        <label>Dư nợ gốc hiện tại (đ)<input required type="number" min="1" max="1000000000000" step="1" value={balance} onChange={e => setBalance(e.target.value)} /></label>
        <label>Số trả mỗi tháng (đ)<input required type="number" min="1" max="1000000000000" step="1" value={payment} onChange={e => setPayment(e.target.value)} /></label>
        <label>Lãi suất năm (%)<input required type="number" min="0" step="any" value={rate} onChange={e => setRate(e.target.value)} /></label>
        <p className="footnote">Nhập khoản vay đã có; không ghi nhận tiền giải ngân vào ví. Số tháng được tính từ dư nợ, lãi suất và số trả; mô phỏng tối đa 600 kỳ, kỳ cuối có thể lớn hơn số trả thường kỳ. Không sửa thông số khi có lịch sử thanh toán.</p>
      </div>}
      <p className="footnote">Khoản theo tháng mới có dư nợ 0; nhập lịch có sẵn bằng chỉnh lịch trả, hoặc dùng mua tín dụng cho chi tiêu mới. Khoản có số dư không được đổi hạn trả; có lịch sử thì chỉ đổi tên. Chỉ xoá khoản trống; không thay đổi ví.</p>
      <Button type="submit">{id ? 'Lưu thông tin khoản nợ' : 'Tạo khoản nợ'}</Button>
      {id && <Button type="button" variant="outline" onClick={() => void onSave(undefined, id)}>Xoá khoản nợ trống</Button>}
    </fieldset>
  </form>;
}