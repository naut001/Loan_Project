import { useState } from 'react';
import type { ReceivableDetails } from '../lib/receivable';
import { validReceivables } from '../lib/receivable';
import { localDate } from '../lib/format';
import { Button } from './ui/button';

export type ReceivableAction = { type: 'save'; values: ReceivableDetails; id?: string } | { type: 'delete' | 'undo'; id: string } | { type: 'collect'; id: string; amount: number };
export function ReceivableForm({ recv, disabled, onSave }: { recv: unknown[]; disabled: boolean; onSave: (action: ReceivableAction) => Promise<void> }) {
  const blank: ReceivableDetails = { name: '', amount: 0, got: 0, kind: 'once', due: '', startK: localDate().slice(0, 7), day: 5, per: 0, inc: true, note: '' };
  const [id, setId] = useState('');
  const [values, setValues] = useState<ReceivableDetails>(blank);
  const [collect, setCollect] = useState('');
  // Invalid legacy records remain in the full backup, but must not be silently repaired.
  if (!validReceivables(recv)) return <p className="footnote">Dữ liệu phải thu cần đối chiếu ở bản 1.3. Sao lưu đầy đủ vẫn giữ dữ liệu gốc.</p>;
  const selected = recv.find(r => r.id === id);
  const collectionAmount = Number(collect);
  const canCollect = !!selected && collect.trim() !== '' && Number.isSafeInteger(collectionAmount) && collectionAmount > 0 && collectionAmount <= selected.amount - selected.got;
  const update = (change: Partial<ReceivableDetails>) => setValues(v => ({ ...v, ...change }));
  return <form onSubmit={e => { e.preventDefault(); void onSave({ type: 'save', id: id || undefined, values }); }}>
    <h3>Phải thu và lịch sử thu hồi</h3>
    <p className="footnote">Giống bản 1.3: ghi nhận thu chỉ giảm khoản phải thu, không tăng ví hoặc ghi thu nhập. Không tự ghi hai lần một khoản tiền. Lưu tối đa 40 lần thu gần nhất.</p>
    <fieldset disabled={disabled}>
      <label>Khoản phải thu<select value={id} onChange={e => { const r = recv.find(r => r.id === e.target.value); setId(e.target.value); setValues(r ? { name: r.name, amount: r.amount, got: r.got, kind: r.kind, due: r.due, startK: r.startK, day: r.day, per: r.per, inc: r.inc, note: r.note } : blank); setCollect(''); }}><option value="">Thêm mới</option>{recv.map(r => <option key={r.id} value={r.id}>{r.name} · còn {Math.max(0, r.amount - r.got).toLocaleString('vi-VN')} đ</option>)}</select></label>
      <div className="filters">
        <label>Người/bên nợ<input required maxLength={80} value={values.name} onChange={e => update({ name: e.target.value })} /></label>
        <label>Tổng tiền nợ (đ)<input required type="number" min={1} max={1e12} step={1} value={values.amount} onChange={e => update({ amount: Number(e.target.value) })} /></label>
        <label>Đã thu ban đầu (đ)<input required disabled={!!id} type="number" min={0} max={values.amount} step={1} value={values.got} onChange={e => update({ got: Number(e.target.value) })} /></label>
        <label>Cách thu<select value={values.kind} onChange={e => update({ kind: e.target.value as 'once' | 'plan' })}><option value="once">Một lần</option><option value="plan">Theo tháng</option></select></label>
        {values.kind === 'once' ? <label>Hạn thu<input type="date" value={values.due} onChange={e => update({ due: e.target.value })} /></label> : <>
          <label>Tháng bắt đầu<input required type="month" value={values.startK} onChange={e => update({ startK: e.target.value })} /></label>
          <label>Ngày thu<input required type="number" min={1} max={31} step={1} value={values.day} onChange={e => update({ day: Number(e.target.value) })} /></label>
          <label>Thu mỗi tháng (đ)<input required type="number" min={1} max={1e12} step={1} value={values.per} onChange={e => update({ per: Number(e.target.value) })} /></label>
        </>}
        <label>Ghi chú<input maxLength={200} value={values.note} onChange={e => update({ note: e.target.value })} /></label>
      </div>
      <label><input type="checkbox" checked={values.inc} onChange={e => update({ inc: e.target.checked })} /> Tính vào dự báo (giữ cờ cho kế hoạch v1.3)</label>
      <Button type="submit">Lưu khoản phải thu</Button>
      {selected && <>
        <Button type="button" variant="outline" disabled={selected.got > 0 || selected.log.length > 0} onClick={() => void onSave({ type: 'delete', id })}>Xoá khoản chưa thu</Button>
        <label>Số tiền vừa thu (đ)<input type="number" min={1} max={selected.amount - selected.got} step={1} value={collect} onChange={e => setCollect(e.target.value)} /></label>
        <Button type="button" disabled={!canCollect} onClick={() => void onSave({ type: 'collect', id, amount: collectionAmount })}>Ghi nhận thu hôm nay</Button>
        <Button type="button" variant="outline" disabled={!selected.log.length} onClick={() => void onSave({ type: 'undo', id })}>Hoàn tác lần thu gần nhất</Button>
        <ol>{selected.log.map((l, i) => <li key={i}>{l.d} · {l.a.toLocaleString('vi-VN')} đ</li>)}</ol>
      </>}
    </fieldset>
  </form>;
}