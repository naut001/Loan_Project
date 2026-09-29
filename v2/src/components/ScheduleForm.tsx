import { useState } from 'react';
import type { Debt } from '../lib/debt';
import type { ScheduleEdit } from '../lib/schedule-edit';
import { Button } from './ui/button';

export function ScheduleForm({ debts, disabled, onSave }: { debts: Debt[]; disabled: boolean; onSave: (entry: ScheduleEdit) => Promise<void> }) {
  const [id, setId] = useState('');
  const [index, setIndex] = useState('');
  const [month, setMonth] = useState('');
  const [amount, setAmount] = useState('');
  const debt = debts.find(d => d.id === id);
  const select = (value: string) => {
    setIndex(value);
    const row = value === '' ? undefined : debt?.sched?.[Number(value)];
    setMonth(row?.k || ''); setAmount(row ? String(row.a) : '');
  };
  const entry = { debt: id, index: index === '' ? undefined : Number(index) };
  return <form onSubmit={e => { e.preventDefault(); void onSave({ ...entry, values: { month, amount: Number(amount) } }); }}>
    <h3>Chỉnh lịch trả theo tháng</h3>
    <fieldset disabled={disabled}>
      <div className="filters">
        <label>Khoản nợ<select required value={id} onChange={e => { setId(e.target.value); setIndex(''); setMonth(''); setAmount(''); }}><option value="">Chọn khoản nợ</option>{debts.filter(d => d.mode === 'custom').map(d => <option key={d.id} value={d.id}>{d.name}</option>)}</select></label>
        <label>Kỳ trả<select value={index} onChange={e => select(e.target.value)}><option value="">Thêm kỳ mới</option>{debt?.sched?.map((r, i) => <option key={i} value={i}>{i + 1}. {r.k} · {r.a.toLocaleString('vi-VN')} đ{r.p || r.settled ? ' · Đã thanh toán' : ''}</option>)}</select></label>
        <label>Tháng kỳ trả<input required type="month" value={month} onChange={e => setMonth(e.target.value)} /></label>
        <label>Số tiền (đ)<input required type="number" min="1" max="1000000000000" step="1" value={amount} onChange={e => setAmount(e.target.value)} /></label>
      </div>
      <p className="footnote">Có sao kê: tháng là tháng sao kê; không có sao kê: tháng đến hạn. Chỉnh lịch thay đổi dư nợ, không ghi chi tiêu hay trừ ví. Không dùng thay cho mua tín dụng hoặc trả nợ. Kỳ đã trả hoặc liên kết giao dịch được bảo vệ.</p>
      <Button type="submit" disabled={!id}>Lưu kỳ trả</Button>
      {index !== '' && <Button type="button" variant="outline" onClick={() => void onSave(entry)}>Xoá kỳ đã chọn</Button>}
    </fieldset>
  </form>;
}