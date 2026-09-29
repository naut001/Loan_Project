import { useState } from 'react';
import type { WalletEntry } from '../lib/cloud';
import type { Wallet } from '../lib/snapshot';
import { localDate } from '../lib/format';
import { Button } from './ui/button';

export function WalletForm({ wallets, disabled, onSave, onRemove }: { wallets: Wallet[]; disabled: boolean; onSave: (values: WalletEntry, id?: string) => Promise<void>; onRemove: (id: string) => Promise<void> }) {
  const [id, setId] = useState('');
  const [name, setName] = useState('');
  const [type, setType] = useState('cash');
  const [opening, setOpening] = useState('0');
  const [date, setDate] = useState('');
  const select = (value: string) => {
    const wallet = wallets.find(w => w.id === value);
    setId(value); setName(wallet?.name || ''); setType(wallet?.type || 'cash');
    setOpening(String(wallet?.opening || 0)); setDate(wallet?.openingDate || '');
  };
  return <form onSubmit={e => { e.preventDefault(); void onSave({ name, type, opening: Number(opening), openingDate: date }, id || undefined); }}>
    <h3>Quản lý ví / tài khoản tiền</h3>
    <fieldset disabled={disabled}>
      <div className="filters">
        <label>Thao tác<select value={id} onChange={e => select(e.target.value)}><option value="">Thêm tài khoản mới</option>{wallets.map(w => <option key={w.id} value={w.id}>Sửa: {w.name}</option>)}</select></label>
        <label>Tên tài khoản<input required maxLength={80} value={name} onChange={e => setName(e.target.value)} /></label>
        <label>Loại tài khoản<select value={type} onChange={e => setType(e.target.value)}><option value="cash">Tiền mặt</option><option value="bank">Ngân hàng / thẻ ghi nợ</option><option value="ewallet">Ví điện tử</option></select></label>
        <label>Số dư đầu kỳ (đ)<input required type="number" min="0" max="1000000000000" step="1" value={opening} onChange={e => setOpening(e.target.value)} /></label>
        <label>Ngày bắt đầu<input type="date" max={localDate()} value={date} onChange={e => setDate(e.target.value)} /></label>
      </div>
      <p className="footnote">Số dư đầu kỳ không phải thu nhập. Sửa số dư sẽ thay đổi số tiền hiện có; không dời ngày bắt đầu qua giao dịch đã ghi.</p>
      <Button type="submit">{id ? 'Lưu thay đổi tài khoản' : 'Thêm tài khoản'}</Button>
      {id && <Button type="button" variant="outline" disabled={wallets.length <= 1} onClick={() => void onRemove(id)}>Xoá tài khoản đã chọn</Button>}
      <p className="footnote">Chỉ xoá được tài khoản chưa có giao dịch và phải giữ ít nhất một tài khoản. Xoá sẽ loại số dư đầu kỳ của tài khoản khỏi tổng tiền.</p>
    </fieldset>
  </form>;
}