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
  const select = (id: string) => {
    const debt = debts.find(d => d.id === id);
    setId(id); setName(debt?.name || ''); setDueDay(String(debt?.dueDay ?? 1));
    setStmtDay(String(debt?.stmtDay ?? 0)); setDueMode(debt?.dueMode || 'day'); setGrace(String(debt?.grace ?? 0));
  };
  return <form onSubmit={e => { e.preventDefault(); void onSave({ name, dueDay: Number(dueDay), stmtDay: Number(stmtDay), dueMode, grace: Number(grace) }, id || undefined); }}>
    <h3>Quản lý thông tin khoản nợ</h3>
    <fieldset disabled={disabled}>
      <div className="filters">
        <label>Khoản nợ<select value={id} onChange={e => select(e.target.value)}><option value="">Tạo khoản nợ theo tháng</option>{debts.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}</select></label>
        <label>Tên khoản nợ<input required maxLength={80} value={name} onChange={e => setName(e.target.value)} /></label>
        <label>Ngày đến hạn<input required type="number" min="1" max="31" step="1" value={dueDay} onChange={e => setDueDay(e.target.value)} /></label>
        <label>Ngày sao kê (0 nếu không có)<input required type="number" min="0" max="31" step="1" value={stmtDay} onChange={e => setStmtDay(e.target.value)} /></label>
        <label>Cách tính hạn<select value={dueMode} onChange={e => setDueMode(e.target.value as 'day' | 'after')}><option value="day">Ngày cố định</option><option value="after">Sau ngày sao kê</option></select></label>
        <label>Số ngày sau sao kê<input required type="number" min="0" max="60" step="1" value={grace} onChange={e => setGrace(e.target.value)} /></label>
      </div>
      <p className="footnote">Khoản mới có dư nợ 0; dùng mua tín dụng để thêm kỳ nợ. Khoản có số dư hoặc lịch sử chỉ đổi tên. Chỉ xoá khoản trống; không thay đổi ví.</p>
      <Button type="submit">{id ? 'Lưu thông tin khoản nợ' : 'Tạo khoản nợ'}</Button>
      {id && <Button type="button" variant="outline" onClick={() => void onSave(undefined, id)}>Xoá khoản nợ trống</Button>}
    </fieldset>
  </form>;
}