import type { Snapshot } from '../lib/snapshot';
import { simulatePlan } from '../lib/plan';
import { money } from '../lib/format';

export function PlanPage({ data, today = new Date() }: { data: Snapshot; today?: Date }) {
  let sim: ReturnType<typeof simulatePlan>;
  try { sim = simulatePlan(data, today); }
  catch (e) { return <section className="panel"><h2>Kế hoạch tiền</h2><p role="alert">{e instanceof Error ? e.message : 'Không thể dự phóng kế hoạch.'} Không hiển thị số liệu có thể sai; bản sao lưu gốc không thay đổi.</p></section>; }
  const lowest = sim.months.reduce((a, b) => b.bal < a.bal ? b : a);
  return <div className="reports-page"><section className="panel"><h2>Kế hoạch tiền · 12 tháng</h2><p className="footnote">Chỉ đọc từ kế hoạch v1.3, không trừ hoặc cộng lại giao dịch ví. Tiền đang có trong kế hoạch độc lập với số dư tài khoản.</p>
    <div className="report-line"><strong>Tiền đầu kế hoạch</strong><span>{money(sim.cash0)}</span></div><div className="report-line"><strong>Số dư thấp nhất ({lowest.key})</strong><span>{money(lowest.bal)}</span></div><div className="report-line"><strong>Mức an toàn</strong><span>{money(sim.buffer)}</span></div><p>{sim.months.some(m => m.bal < 0) ? 'Có tháng dự kiến thiếu tiền.' : sim.months.some(m => m.bal < sim.buffer) ? 'Có tháng xuống dưới mức an toàn.' : 'Chưa có tháng nào xuống dưới mức an toàn theo giả định hiện tại.'}</p></section>
    <section className="panel"><h2>Dòng tiền 12 tháng tới</h2>{sim.months.map(m => <details key={m.key}><summary className="report-line"><strong>{m.key}</strong><span>Vào {money(m.inn)} · Ra {money(m.out)} · Còn {money(m.bal)}</span></summary><p>Nợ/lương theo kế hoạch: {data.income && m.debt ? `${(m.debt / (data.income as number) * 100).toFixed(0)}%` : '—'}</p>{m.ev.length ? m.ev.map((event, i) => <div className="report-line" key={i}><strong>{event.s > 0 ? '+' : '−'} {event.t}</strong><span>{money(event.a)}</span></div>) : <p>Không có khoản nào.</p>}</details>)}</section>
    <p className="footnote">Giả định: lương về mỗi tháng; nếu chưa đánh dấu lương tháng này đang chờ, tháng này đã nằm trong tiền đầu kế hoạch. Sinh hoạt tháng hiện tại tính theo số ngày còn lại. Khoản vay mới trả kỳ đầu từ tháng sau giải ngân; nợ tất toán dừng kỳ trả từ tháng giải ngân. Khoản phải thu theo hạn hẹn không phải tiền đã nhận. Dự phóng cần đối chiếu hợp đồng thực tế.</p>
  </div>;
}