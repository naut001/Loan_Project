/* ---------- render: fund ---------- */
function renderFund(){
  const f = S.fund; const T = totals(); const el = $('#v-fund');
  const prog = f.target? Math.min(100, f.saved/f.target*100) : 0;
  const remain = Math.max(0, f.target - f.saved); const eta = f.monthly>0 && remain>0 ? Math.ceil(remain/f.monthly) : 0;
  const cover = T.typical>0 ? f.saved/T.typical : null;
  const log = (f.log||[]).slice(-8).reverse().map(x=>`<tr><td>${x.d}</td><td style="color:${x.a>0?'var(--good)':'var(--bad)'}">${x.a>0?'+':''}${fmt(x.a)}</td></tr>`).join('');
  el.innerHTML = `<h2 style="margin-top:6px">Quỹ dự phòng</h2>
    <div class="panel"><div class="k small muted">Đã có</div><div class="big">${fmt(f.saved)} đ</div>
      <div class="bar" style="margin:10px 0 6px;height:12px"><span style="width:${prog.toFixed(1)}%;background:var(--accent)"></span></div>
      <p class="small muted">${f.target?`${pct(prog,0)} mục tiêu ${fmt(f.target)} đ`:'Chưa đặt mục tiêu'}${cover!=null?`. Đủ trả ${cover.toLocaleString('vi-VN',{maximumFractionDigits:1})} tháng nợ nếu có chuyện bất ngờ.`:''}</p>
      ${eta?`<p class="small">Gửi ${fmt(f.monthly)} đ/tháng thì khoảng <b>${eta} tháng</b> nữa đạt mục tiêu.</p>`:''}
    </div>
    <div class="panel"><div class="form">
      <label class="f">Số tiền<input class="money" inputmode="numeric" id="fund-amt" placeholder="Ví dụ 1.500.000"></label>
    </div><div class="btns" style="margin-top:10px"><button class="btn primary" data-act="fund-add">Thêm vào quỹ</button><button class="btn" data-act="fund-sub">Rút ra</button></div>
    ${log?`<div class="tbl" style="margin-top:12px"><table><thead><tr><th>Ngày</th><th>Số tiền</th></tr></thead><tbody>${log}</tbody></table></div>`:''}</div>
    <h2>Mục tiêu</h2><div class="panel"><div class="form">
      <label class="f">Mục tiêu quỹ (đ)<input class="money" inputmode="numeric" id="fund-target" value="${f.target?fmt(f.target):''}"></label>
      <label class="f">Dự định gửi mỗi tháng (đ)<input class="money" inputmode="numeric" id="fund-monthly" value="${f.monthly?fmt(f.monthly):''}"></label>
    </div>${T.typical>0?`<div class="btns" style="margin-top:10px"><button class="btn sm" data-act="fund-2m">Đặt bằng 2 tháng trả nợ (${fmtM(T.typical*2)})</button></div>`:''}</div>`;
}

