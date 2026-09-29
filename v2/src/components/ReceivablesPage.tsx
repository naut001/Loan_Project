import type { Snapshot } from '../lib/snapshot';
import { validReceivables } from '../lib/receivable';
import { receivableForecast, receivableInfo } from '../lib/receivable-forecast';
import { money } from '../lib/format';

export function ReceivablesPage({ data, today = new Date() }: { data: Snapshot; today?: Date }) {
  const recv = data.recv ?? [];
  if (!validReceivables(recv)) return <section className="panel"><h2>Phải thu</h2><p role="alert">Dữ liệu phải thu chưa đối chiếu được với bản 1.3. Không hiển thị dự báo có thể sai; bản sao lưu gốc vẫn được giữ nguyên.</p></section>;
  const infos = recv.map(r => receivableInfo(r, today));
  const out = infos.reduce((sum, i) => sum + i.out, 0);
  const got = recv.reduce((sum, r) => sum + r.got, 0);
  const late = infos.reduce((sum, i) => sum + i.late, 0);
  const soon = infos.reduce((sum, i) => sum + (i.out > 0 && !i.late && i.next && Math.round((i.next.getTime() - new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime()) / 86400000) <= 30 ? i.nextAmt : 0), 0);
  const months = Array.from({ length: 12 }, (_, n) => new Date(today.getFullYear(), today.getMonth() + n, 1));
  const forecast = receivableForecast(recv, months.length, today);
  return <section className="receivables-page">
    <h2>Người khác nợ bạn</h2>
    <p className="footnote">Dự báo chỉ gồm khoản bật “Tính vào dự báo”, không phải tiền đã vào ví hoặc thu nhập. Khoản chậm thu được tính vào tháng hiện tại theo bản 1.3.</p>
    <div className="stats">
      <section className="stat panel"><p>Còn phải thu</p><h2>{money(out)}</h2></section>
      <section className="stat panel"><p>Đã thu</p><h2>{money(got)}</h2></section>
      <section className="stat panel"><p>Chậm thu</p><h2>{money(late)}</h2></section>
      <section className="stat panel"><p>Dự kiến thu 30 ngày tới</p><h2>{money(soon)}</h2><small>Chưa gồm khoản chậm thu</small></section>
    </div>
    {recv.length ? recv.map((r, index) => {
      const i = infos[index];
      return <section className="panel" key={r.id}><h3>{r.name}</h3><p>{r.note}</p><p>Tổng nợ: {money(r.amount)} · Đã thu: {money(r.got)} · Còn lại: {money(i.out)}</p>
        <p>{i.late > 0 ? `Chậm thu ${money(i.late)} (${i.lateDays} ngày)` : i.next ? `Hạn tiếp theo: ${i.next.toLocaleDateString('vi-VN')} · ${money(i.nextAmt)}` : i.out === 0 ? 'Đã thu đủ' : 'Chưa có hạn thu'}</p>
        <p>{r.kind === 'plan' ? `Mỗi tháng ${money(r.per)}, ngày ${r.day}, từ ${r.startK}` : r.due ? `Hạn thu ${r.due}` : 'Một lần, chưa có hạn'} · Tính vào dự báo: {r.inc === false ? 'Không' : 'Có'}</p>
        {r.log.length > 0 && <p>Lần thu gần nhất: {money(r.log[r.log.length - 1].a)} ({r.log[r.log.length - 1].d})</p>}
      </section>;
    }) : <p className="panel">Chưa có khoản phải thu.</p>}
    <section className="panel"><h3>Lịch thu dự kiến 12 tháng</h3><p className="footnote">Chỉ là dự kiến, không cộng vào số dư ví. Phần sau 12 tháng không được hiển thị.</p>
      <ul>{months.map((month, index) => <li key={index}>Tháng {month.getMonth() + 1}/{month.getFullYear()}: {money(forecast[index])}</li>)}</ul>
    </section>
  </section>;
}