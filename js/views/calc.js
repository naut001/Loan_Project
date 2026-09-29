/* ---------- render: calculator ---------- */
function renderCalc(){
  const c = S.calc; const el = $('#v-calc');
  const r = c.rate/1200, A = Math.round(pmt(c.amount, r, c.months));
  const sch = schedule(c.amount, r, A); const fullCost = sch.totalInterest + c.upfront;
  const eff = (Math.pow(1+r,12)-1)*100;
  const aprUp = c.upfront>0 && c.amount>c.upfront ? rateFor(c.amount-c.upfront, A, c.months)*1200 : null;
  const T = totals(); const consIds = new Set(c.consolidate||[]);
  const otherMonthly = active().filter(d=>!consIds.has(d.id)).reduce((s,d)=>s+monthlyOf(d),0);
  const newDti = S.income ? (otherMonthly + A)/S.income : null;
  // prepay sim
  const k = Math.max(1, Math.min(c.months-1, c.payoffAt||1));
  const iK = sch.rows.slice(0,k).reduce((s,x)=>s+x.i,0); const balK = sch.rows[k-1]? sch.rows[k-1].bal : 0;
  const feeK = balK*c.prepay/100; const costK = iK + feeK + c.upfront; const gainK = fullCost - costK;
  let lastGood = 0; for(let j=1;j<c.months;j++){ const ij=sch.rows.slice(0,j).reduce((s,x)=>s+x.i,0); const bj=sch.rows[j-1].bal; if(sch.totalInterest-ij > bj*c.prepay/100) lastGood=j; }
  // consolidation
  const a = active(); const sel = a.filter(d=>(c.consolidate||[]).includes(d.id));
  let cons='';
  if(a.length){
    const checks = a.map(d=>`<label class="check"><input type="checkbox" data-cons="${d.id}" ${(c.consolidate||[]).includes(d.id)?'checked':''}><span style="flex:1">${esc(d.name)}<br><span class="small muted">${isCustom(d)?'Còn '+d.months+' kỳ, tổng '+fmt(d.balance)+' đ'+(d.principal>0?', gốc '+fmt(d.principal)+' đ':''):'Dư nợ '+fmt(d.balance)+' đ, lãi '+pct(d.rate,2)+'/năm'}</span></span></label>`).join('');
    let res='';
    if(sel.length){
      const sBal = sel.reduce((s,d)=>s+payoffOf(d),0), sPay = sel.reduce((s,d)=>s+monthlyOf(d),0);
      const sInt = sel.reduce((s,d)=>s+remainingOf(d).totalInterest,0), sFee = sel.reduce((s,d)=>s+payoffOf(d)*(d.prepay||0)/100,0);
      const need = sBal + sFee; const short = need - (c.amount - c.upfront);
      const newCost = sch.totalInterest + c.upfront + sFee; const diff = sInt - newCost;
      res = `<div class="cmp" style="margin-top:12px"><div class="side"><h3>Giữ nguyên</h3><p class="small">Trả/tháng: <b>${fmt(sPay)} đ</b></p><p class="small">Lãi còn phải trả: <b>${fmt(sInt)} đ</b></p></div>
        <div class="side"><h3>Gộp vào khoản vay mới</h3><p class="small">Trả/tháng: <b>${fmt(A)} đ</b></p><p class="small">Lãi + phí: <b>${fmt(newCost)} đ</b></p><p class="small muted">Gồm phí tất toán các khoản cũ ${fmt(sFee)} đ</p></div></div>
        ${Math.abs(short)>100000?`<div class="btns" style="margin-top:10px"><button class="btn sm" data-act="set-need" data-need="${Math.ceil((need + c.upfront)/1e6)*1e6}">Đặt số tiền vay bằng số cần (${fmtM(Math.ceil((need + c.upfront)/1e6)*1e6)})</button></div>`:''}
        ${short>0?`<div class="verdict warn">Số tiền vay chưa đủ để trả hết các khoản đã chọn, còn thiếu ${fmt(short)} đ.</div>`:''}
        ${short<0 && -short > 1000000?`<div class="verdict warn">Vay dư khoảng ${fmtM(-short)} so với số cần để trả nợ cũ. Phần dư vẫn chịu lãi, nên cân nhắc giảm số tiền vay.</div>`:''}
        <div class="verdict ${diff>0?'good':'bad'}">${diff>0?`Gộp nợ giúp tiết kiệm khoảng ${fmtM(diff)} tiền lãi.`:`Gộp nợ tốn thêm khoảng ${fmtM(-diff)} so với giữ nguyên.`} Trả mỗi tháng ${A<sPay?'giảm':'tăng'} ${fmt(Math.abs(sPay-A))} đ.</div>`;
    }
    cons = `<h2>Gộp nợ cũ vào khoản vay này</h2><div class="panel"><p class="small muted">Chọn các khoản muốn trả dứt điểm bằng khoản vay mới.</p>${checks}${res}</div>`;
  }
  const rowsHtml = sch.rows.map(x=>`<tr class="${x.k===k?'hl':''}"><td>${x.k}</td><td>${fmt(x.pay)}</td><td>${fmt(x.prin)}</td><td>${fmt(x.i)}</td><td>${fmt(x.bal)}</td></tr>`).join('');
  el.innerHTML = `<h2 style="margin-top:6px">Tính khoản vay</h2><div class="panel">
    <div class="presets"><button class="btn sm" data-preset="a">Lãi 17,99%, phí trả trước 4%</button><button class="btn sm" data-preset="b">Lãi 16%</button></div>
    <div class="form">
      <label class="f">Số tiền vay (đ)<input class="money c-in" inputmode="numeric" data-k="amount" value="${fmt(c.amount)}"></label>
      <label class="f">Lãi suất %/năm<input class="c-in" inputmode="decimal" data-k="rate" value="${String(c.rate).replace('.',',')}"></label>
      <label class="f">Kỳ hạn (tháng)<input class="c-in" inputmode="numeric" data-k="months" value="${c.months}"></label>
      <label class="f">Phí trả trước hạn (%)<input class="c-in" inputmode="decimal" data-k="prepay" value="${String(c.prepay).replace('.',',')}"></label>
      <label class="f">Phí hồ sơ + bảo hiểm (đ)<input class="money c-in" inputmode="numeric" data-k="upfront" value="${c.upfront?fmt(c.upfront):''}" placeholder="0"><span class="hint">Nhập 0 nếu ngân hàng không thu</span></label>
    </div></div>
    <div class="grid">
      <div class="stat"><div class="k">Trả mỗi tháng</div><div class="v">${fmt(A)} đ</div><div class="s">${S.income?pct(A/S.income*100,0)+' lương':''}</div></div>
      <div class="stat"><div class="k">Tổng lãi</div><div class="v">${fmtM(sch.totalInterest)}</div><div class="s">${pct(sch.totalInterest/c.amount*100)} so với gốc</div></div>
      <div class="stat"><div class="k">Tổng chi phí</div><div class="v">${fmtM(fullCost)}</div><div class="s">lãi + phí ban đầu</div></div>
      <div class="stat"><div class="k">Lãi hiệu dụng/năm</div><div class="v">${pct(eff)}</div><div class="s">${aprUp?'Tính cả phí: '+pct(aprUp)+' danh nghĩa':'lãi nhập gộp theo tháng'}</div></div>
    </div>
    ${newDti!=null && T.typical>0?`<div class="verdict ${dtiBand(newDti).c==='good'?'good':dtiBand(newDti).c==='bad'?'bad':'warn'}">${consIds.size?'Sau khi gộp các khoản đã chọn':'Nếu cộng thêm vào các khoản đang trả'}, tổng trả nợ là ${fmt(otherMonthly+A)} đ/tháng, bằng ${pct(newDti*100,0)} lương (${dtiBand(newDti).t.toLowerCase()}).</div>`:''}
    <h2>Thử tất toán sớm</h2><div class="panel">
      <label class="f">Tất toán sau kỳ thứ <b style="color:var(--ink);font-size:16px">${k}</b><input type="range" min="1" max="${Math.max(1,c.months-1)}" value="${k}" id="payoff"></label>
      <div class="cmp" style="margin-top:10px">
        <div class="side"><h3>Tất toán sau kỳ ${k}</h3><p class="small">Dư nợ còn lại: <b>${fmt(balK)} đ</b></p><p class="small">Phí ${pct(c.prepay,2)}: <b>${fmt(feeK)} đ</b></p><p class="small">Cần chuẩn bị: <b>${fmt(balK+feeK)} đ</b></p><p class="small">Tổng chi phí: <b>${fmt(costK)} đ</b></p></div>
        <div class="side"><h3>Trả đủ ${c.months} kỳ</h3><p class="small">Tổng chi phí: <b>${fmt(fullCost)} đ</b></p></div>
      </div>
      <div class="verdict ${gainK>0?'good':'bad'}">${gainK>0?`Tất toán sau kỳ ${k} tiết kiệm ${fmt(gainK)} đ.`:`Tất toán sau kỳ ${k} lỗ ${fmt(-gainK)} đ vì phí cao hơn phần lãi tránh được.`} ${lastGood?`Trả sớm chỉ còn có lợi nếu tất toán muộn nhất sau kỳ ${lastGood}.`:'Với mức phí này, trả sớm không có lợi ở kỳ nào.'}</div>
    </div>
    ${cons}
    <h2>Lịch trả chi tiết</h2><div class="panel"><details><summary>Xem ${sch.months} kỳ</summary><div class="tbl"><table><thead><tr><th>Kỳ</th><th>Số tiền trả</th><th>Gốc</th><th>Lãi</th><th>Số dư</th></tr></thead><tbody>${rowsHtml}</tbody></table></div></details></div>
    <div class="btns" style="margin-top:14px"><button class="btn dark" data-act="calc-to-debt">Đã giải ngân: thêm vào danh sách nợ</button><button class="btn" data-act="calc-to-plan">Thêm vào kế hoạch</button></div>`;
}

