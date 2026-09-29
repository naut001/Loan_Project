import { useState } from 'react';
import type { Snapshot } from '../lib/snapshot';
import type { DebtPayment } from '../lib/payment';
import { remaining } from '../lib/debt';
import { localDate, money } from '../lib/format';
import { Button } from './ui/button';

export function PaymentForm({ data, disabled, onSave, onUndo }: { data: Snapshot; disabled: boolean; onSave: (values: DebtPayment) => Promise<void>; onUndo: (id: string) => Promise<void> }) {
  const [undoId, setUndoId] = useState('');
  const [debt, setDebt] = useState('');
  const [index, setIndex] = useState('');
  const [wallet, setWallet] = useState(data.wallets[0]?.id || '');
  const [date, setDate] = useState(localDate());
  const [principal, setPrincipal] = useState('');
  const [interest, setInterest] = useState('0');
  const [fee, setFee] = useState('0');
  const [note, setNote] = useState('');
  const selected = data.debts.find(d => d.id === debt);
  const row = index === '' ? undefined : selected?.sched?.[Number(index)];
  return <form onSubmit={e => { e.preventDefault(); void onSave({ debt, index: Number(index), wallet, date, principal: Number(principal), interest: Number(interest), fee: Number(fee), note }); }}>
    <h3>Thanh toán kỳ nợ · toàn bộ hoặc một phần</h3>
    <fieldset disabled={disabled}><div className="filters">
      <label>Khoản nợ<select required value={debt} onChange={e => { setDebt(e.target.value); setIndex(''); setPrincipal(''); }}><option value="">Chọn khoản nợ</option>{data.debts.filter(d => d.mode === 'custom').map(d => <option key={d.id} value={d.id}>{d.name}</option>)}</select></label>
      <label>Kỳ thanh toán<select required value={index} onChange={e => { setIndex(e.target.value); setPrincipal(''); }}><option value="">Chọn kỳ</option>{selected?.sched?.map((r, i) => remaining(r) > 0 && <option key={i} value={i}>Dòng {i + 1} · {r.k} · còn {money(remaining(r))}</option>)}</select></label>
      <label>Tài khoản chi<select required value={wallet} onChange={e => setWallet(e.target.value)}>{data.wallets.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}</select></label>
      <label>Ngày thanh toán<input required type="date" max={localDate()} value={date} onChange={e => setDate(e.target.value)} /></label>
      <label>Số trả vào kỳ (đ)<input required type="number" min="1" max={row ? remaining(row) : 1e12} step="1" value={principal} onChange={e => setPrincipal(e.target.value)} /></label>
      <label>Lãi ngoài lịch (đ)<input required type="number" min="0" max="1000000000000" step="1" value={interest} onChange={e => setInterest(e.target.value)} /></label>
      <label>Phí ngoài lịch (đ)<input required type="number" min="0" max="1000000000000" step="1" value={fee} onChange={e => setFee(e.target.value)} /></label>
      <label>Ghi chú<input maxLength={200} value={note} onChange={e => setNote(e.target.value)} /></label>
    </div><p className="footnote">Tài khoản giảm tổng ba khoản; kỳ nợ chỉ giảm số trả vào kỳ. Không nhập lại lãi/phí đã nằm trong lịch.</p>
    <Button type="submit">Lưu thanh toán kỳ nợ</Button>
    <h3>Hoàn tác thanh toán đã ghi</h3>
    <label>Giao dịch thanh toán<select value={undoId} onChange={e => setUndoId(e.target.value)}><option value="">Chọn thanh toán cần hoàn tác</option>{Object.values(data.tx).flat().filter(t => t.type === 'repayment').sort((a, b) => b.date.localeCompare(a.date)).map(t => <option key={t.id} value={t.id}>{t.date} · {data.debts.find(d => d.id === t.debt)?.name || 'Liên kết nợ không rõ'} · {money(t.amount)} · {t.note}</option>)}</select></label>
    <p className="footnote">Xoá bản ghi thanh toán và hoàn lại số dư tính toán, không chuyển tiền thực tế. Dấu đã trả cũ của kỳ được giữ nguyên. Hãy tải sao lưu trước khi hoàn tác.</p>
    <Button type="button" variant="outline" disabled={!undoId} onClick={() => void onUndo(undoId)}>Hoàn tác thanh toán đã chọn</Button></fieldset>
  </form>;
}