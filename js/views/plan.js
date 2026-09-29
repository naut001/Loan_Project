function renderPlan(){
  const P=ensurePlan(); const el=$('#v-plan'); const nk=monthKey(addMonths(today(),1)), ck=monthKey(today());
  const cashRows = P.cash.map(c=>`<div class="pl-row"><input data-plan="cash" data-id="${c.id}" data-f="name" value="${esc(c.name)}" placeholder="Tên (ví dụ Tài khoản lương)" aria-label="Tên"><input class="money" inputmode="numeric" data-plan="cash" data-id="${c.id}" data-f="a" value="${c.a?fmt(c.a):''}" placeholder="Số tiền" aria-label="Số tiền"><button class="btn sm ghost danger" data-act="plan-del" data-kind="cash" data-id="${c.id}" aria-label="Xoá">✕</button></div>`).join('');
  const buyRows = P.buys.map(b=>`<div class="pl-row buy"><input data-plan="buys" data-id="${b.id}" data-f="name" value="${esc(b.name)}" placeholder="Mua gì" aria-label="Mua gì"><input class="money" inputmode="numeric" data-plan="buys" data-id="${b.id}" data-f="a" value="${b.a?fmt(b.a):''}" placeholder="Số tiền" aria-label="Số tiền"><select data-plan="buys" data-id="${b.id}" data-f="k" aria-label="Tháng mua">${monthOptions(b.k)}</select><button class="btn sm ghost danger" data-act="plan-del" data-kind="buys" data-id="${b.id}" aria-label="Xoá">✕</button></div>`).join('');
  const loanCards = P.loans.map(l=>{
    const checks = active().map(d=>`<label class="check"><input type="checkbox" data-plan="loans" data-id="${l.id}" data-f="payoff" data-did="${d.id}" ${(l.payoff||[]).includes(d.id)?'checked':''}><span style="flex:1">${esc(d.name)}<br><span class="small muted">Dư nợ ${fmt(payoffOf(d))} đ${d.prepay>0?', phí trả trước '+pct(d.prepay,2):''}</span></span></label>`).join('') || '<p class="small muted">Chưa có khoản nợ nào để chọn.</p>';
    return `<div class="debt"><div class="head"><div style="flex:1"><input class="nm-in" data-plan="loans" data-id="${l.id}" data-f="name" value="${esc(l.name)}" placeholder="Tên khoản vay dự định" aria-label="Tên khoản vay"></div><button class="btn sm ghost danger" data-act="plan-del" data-kind="loans" data-id="${l.id}">Xoá</button></div>
      <div class="form" style="margin-top:10px">
        <label class="f">Số tiền vay (đ)<input class="money" inputmode="numeric" data-plan="loans" data-id="${l.id}" data-f="amount" value="${l.amount?fmt(l.amount):''}"></label>
        <label class="f">Lãi suất %/năm<input inputmode="decimal" data-plan="loans" data-id="${l.id}" data-f="rate" value="${String(l.rate||'').replace('.',',')}"></label>
        <label class="f">Kỳ hạn (tháng)<input inputmode="numeric" data-plan="loans" data-id="${l.id}" data-f="months" value="${l.months||''}"></label>
        <label class="f">Tháng giải ngân<select data-plan="loans" data-id="${l.id}" data-f="k">${monthOptions(l.k)}</select></label>
        <label class="f">Phí + bảo hiểm trả một lần (đ)<input class="money" inputmode="numeric" data-plan="loans" data-id="${l.id}" data-f="fee" value="${l.fee?fmt(l.fee):''}" placeholder="0"></label>
      </div>
      <h3 style="margin-top:12px">Dùng tiền vay để tất toán</h3>${checks}
      <p class="small" id="ls-${l.id}" style="margin-top:8px"></p></div>`;
  }).join('');
  el.innerHTML = `<h2 style="margin-top:6px">Kế hoạch tiền</h2>
    <p class="small muted">Nhập tiền đang có, khoản vay và các khoản mua sắm dự định. App tính số dư từng tháng trong 12 tháng tới để bạn biết tháng nào có nguy cơ thiếu tiền.</p>
    <div id="plan-result"></div>
    <h2>Tiền đang có</h2><div class="panel">${cashRows || '<p class="small muted">Chưa có khoản nào. Thêm tài khoản, tiền mặt, ví điện tử.</p>'}
      <div class="btns" style="margin-top:10px"><button class="btn sm" data-act="plan-add" data-kind="cash">Thêm tiền đang có</button></div></div>
    <h2>Chi tiêu và mức an toàn</h2><div class="panel"><div class="form">
      <label class="f">Chi sinh hoạt mỗi tháng (đ)<input class="money" inputmode="numeric" data-plan="global" data-f="living" value="${P.living?fmt(P.living):''}" placeholder="Ăn ở, đi lại, hóa đơn..."></label>
      <label class="f">Tiền tối thiểu muốn giữ (đ)<input class="money" inputmode="numeric" data-plan="global" data-f="buffer" value="${P.buffer?fmt(P.buffer):''}" placeholder="Ví dụ bằng quỹ dự phòng"><span class="hint">Số dư xuống dưới mức này sẽ bị cảnh báo</span></label>
    </div><label class="check" style="margin-top:8px"><input type="checkbox" data-plan="global" data-f="incomePending" ${P.incomePending?'checked':''}><span>Lương tháng này chưa về (tính vào tháng này)</span></label></div>
    <h2>Khoản vay dự định</h2>${loanCards || '<div class="empty-note">Chưa có khoản vay dự định. Thêm ở đây hoặc bấm "Thêm vào kế hoạch" trong tab Tính khoản vay.</div>'}
    <div class="btns" style="margin-top:10px"><button class="btn sm" data-act="plan-add" data-kind="loans">Thêm khoản vay dự định</button></div>
    <h2>Mua sắm dự định</h2><div class="panel">${buyRows || '<p class="small muted">Chưa có khoản nào. Thêm đồ định mua, chi phí lớn sắp tới.</p>'}
      <div class="btns" style="margin-top:10px"><button class="btn sm" data-act="plan-add" data-kind="buys">Thêm khoản mua sắm</button></div></div>`;
  renderPlanResult();
}
function renderPlanResult(){
  const box=$('#plan-result'); if(!box) return; const P=ensurePlan(); const sim=planSim(12);
  const rows=sim.months; const buf=P.buffer||0;
  let minRow=rows[0]; rows.forEach(r=>{ if(r.bal<minRow.bal) minRow=r; });
  const firstNeg=rows.find(r=>r.bal<0), firstLow=rows.find(r=>r.bal<buf);
  const lab=r=>(r.date.getMonth()+1)+'/'+r.date.getFullYear();
  let verdict;
  if(firstNeg) verdict=`<div class="verdict bad">Đến tháng ${lab(firstNeg)} số dư âm (${fmt(firstNeg.bal)} đ), tức là không đủ tiền. Cần giảm chi, dời khoản mua sắm hoặc điều chỉnh khoản vay.</div>`;
  else if(buf>0 && firstLow) verdict=`<div class="verdict warn">Tháng ${lab(firstLow)} số dư còn ${fmt(firstLow.bal)} đ, thấp hơn mức tối thiểu bạn muốn giữ (${fmt(buf)} đ).</div>`;
  else verdict=`<div class="verdict good">Trong 12 tháng tới số dư không xuống dưới ${buf>0?'mức tối thiểu bạn đặt':'0'}. Thấp nhất là ${fmt(minRow.bal)} đ vào tháng ${lab(minRow)}.</div>`;
  const totLoan=P.loans.reduce((s,l)=>s+(l.amount||0),0), totBuy=P.buys.reduce((s,b)=>s+(b.a||0),0);
  const grid=`<div class="grid"><div class="stat"><div class="k">Tiền đang có</div><div class="v">${fmtM(sim.cash0)}</div><div class="s">${P.cash.length} khoản</div></div>
    <div class="stat"><div class="k">Thấp nhất trong 12 tháng</div><div class="v ${minRow.bal<0?'neg':''}">${fmtM(minRow.bal)}</div><div class="s">tháng ${lab(minRow)}</div></div>
    <div class="stat"><div class="k">Dự định vay</div><div class="v">${fmtM(totLoan)}</div><div class="s">${P.loans.length} khoản</div></div>
    <div class="stat"><div class="k">Dự định mua sắm</div><div class="v">${fmtM(totBuy)}</div><div class="s">${P.buys.length} khoản</div></div>
    ${recvs().length?`<div class="stat"><div class="k">Dự kiến thu về</div><div class="v">${fmtM(sim.recvTotal)}</div><div class="s">trong 12 tháng tới</div></div>`:''}</div>`;
  const trs=rows.map(r=>{ const cls=r.bal<0?'bad':(buf>0&&r.bal<buf)?'warn':''; const ratio=S.income&&r.debt? pct(r.debt/S.income*100,0):'—';
    return `<tr class="${cls}"><td>${lab(r)}</td><td>${mm(r.inn)}</td><td>${mm(r.out)}</td><td class="${r.bal<0?'neg':''}"><b>${mm(r.bal)}</b></td><td>${ratio}</td></tr>`; }).join('');
  const det=rows.map(r=>`<p class="small" style="margin:8px 0 2px"><b>Tháng ${lab(r)}</b>, cuối tháng còn ${fmt(r.bal)} đ</p><p class="small muted" style="margin:0">${r.ev.length? r.ev.map(e=>(e.s>0?'+':'-')+' '+esc(e.t)+' '+fmtM(e.a)).join('; ') : 'Không có khoản nào'}</p>`).join('');
  box.innerHTML = `${grid}${verdict}<div class="panel" style="margin-top:10px"><h3>Dòng tiền 12 tháng tới (triệu đồng)</h3><div class="tbl"><table><thead><tr><th>Tháng</th><th>Vào</th><th>Ra</th><th>Cuối tháng</th><th>Nợ/lương</th></tr></thead><tbody>${trs}</tbody></table></div>
    <details><summary>Chi tiết từng tháng</summary>${det}</details>
    <p class="small muted" style="margin-top:8px">Giả định: lương về đủ mỗi tháng${P.incomePending?'':' (tháng này đã nhận, nằm trong tiền đang có)'}; kỳ trả đầu tiên của khoản vay mới cách ngày giải ngân 1 tháng; khoản nợ được tất toán thì hết trả từ tháng giải ngân; chưa tính lãi tiết kiệm; khoản phải thu chỉ tính theo hạn hẹn và các khoản đã đánh dấu.${S.income?'':' Chưa nhập lương ở cuối trang Tổng quan nên chưa có khoản thu.'}</p></div>`;
  P.loans.forEach(l=>{ const el=$('#ls-'+l.id); if(!el) return;
    if(!(l.amount>0)){ el.textContent=''; return; }
    const nm=l.months||1, A=Math.round(pmt(l.amount,(l.rate||0)/1200,nm)), sch=schedule(l.amount,(l.rate||0)/1200,A);
    let t=`Trả ${fmt(A)} đ/tháng${S.income?' ('+pct(A/S.income*100,0)+' lương)':''}, tổng lãi ${fmt(sch.totalInterest)} đ${l.fee>0?', cộng phí '+fmt(l.fee)+' đ':''}. Nhận về ${fmt(l.amount-(l.fee||0))} đ.`;
    const o=Math.max(0,monthIdx(l.k)-nowIdx()); let need=0;
    (l.payoff||[]).forEach(id=>{ const d=S.debts.find(x=>x.id===id); if(d && d.balance>0){ const b=payoffAtOffset(d,o); need+=b+b*(d.prepay||0)/100; } });
    if(need>0){ const gap=(l.amount-(l.fee||0))-need; t+=` Tất toán các khoản đã chọn cần khoảng ${fmt(need)} đ, ${gap>=0?'dư '+fmt(gap)+' đ':'thiếu '+fmt(-gap)+' đ'}.`; }
    el.textContent=t; });
}
function planEdit(t){
  const P=ensurePlan(), kind=t.dataset.plan, id=t.dataset.id, f=t.dataset.f;
  if(kind==='global'){ if(f==='living') P.living=parseMoney(t.value); else if(f==='buffer') P.buffer=parseMoney(t.value); else if(f==='incomePending') P.incomePending=t.checked; }
  else { const list=P[kind]; const it=list && list.find(x=>x.id===id); if(!it) return;
    if(f==='name') it.name=t.value;
    else if(f==='a'||f==='fee'||f==='amount') it[f]=parseMoney(t.value);
    else if(f==='rate') it.rate=parseNum(t.value);
    else if(f==='months') it.months=Math.max(0,Math.min(120,parseInt(t.value)||0));
    else if(f==='k') it.k=t.value;
    else if(f==='payoff'){ const set=new Set(it.payoff||[]); t.checked?set.add(t.dataset.did):set.delete(t.dataset.did); it.payoff=[...set]; } }
  save(); renderPlanResult();
}

