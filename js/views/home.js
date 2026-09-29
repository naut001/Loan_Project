/* ---------- render: home ---------- */
function renderHome(){
  const el = $('#v-home'); const a = active(); const T = totals();
  const amtOf = (d,s) => (s.amt!=null ? s.amt : d.payment);
  let hero;
  if(!a.length){
    hero = `<div class="hero empty"><div class="lead">Chưa có khoản nợ nào</div><div class="count"><span class="num">Bắt đầu từ đây</span></div>
      <div class="what">Thêm các khoản nợ hiện tại để ứng dụng nhắc kỳ trả và tính ngày hết nợ.</div>
      <div class="btns" style="margin-top:14px"><button class="btn primary" data-act="add-debt">Thêm khoản nợ</button></div></div>`;
  } else {
    const st = a.map(d=>({d, s:statusOf(d)})).sort((x,y)=>{
      const ox = x.s.paid?1:0, oy = y.s.paid?1:0; if(ox!==oy) return ox-oy; return x.s.due - y.s.due; });
    const n = st[0]; const allPaid = st.every(x=>x.s.paid);
    let num, unit, lead, cls='';
    if(allPaid){ const days = Math.max(0,Math.round((n.s.due - today())/86400000)); num=days; unit='ngày'; lead='Chưa có kỳ nào cần trả ngay. Kỳ tiếp theo sau'; }
    else if(n.s.days<0){ num=-n.s.days; unit='ngày quá hạn'; lead='Cần trả ngay'; cls='overdue'; }
    else if(n.s.days===0){ num='Hôm nay'; unit=''; lead='Đến hạn trả'; }
    else { num=n.s.days; unit='ngày'; lead='Kỳ trả tiếp theo còn'; }
    const paidPrincipal = Math.max(0, T.original - T.balance);
    const prog = T.original ? paidPrincipal/T.original*100 : 0;
    const freeDate = addMonths(today(), Math.max(0, T.maxMonths - (allPaid?0:1)));
    hero = `<div class="hero ${cls}"><div class="lead">${lead}</div>
      <div class="count"><span class="num">${num}</span><span class="unit">${unit}</span></div>
      <div class="what">${esc(n.d.name)}: <b>${fmt(amtOf(n.d,n.s))} đ</b>, hạn ngày ${n.s.due.getDate()}/${n.s.due.getMonth()+1}</div>
      <div class="runway"><div class="bar"><span style="width:${prog.toFixed(1)}%"></span></div>
      <div class="lab"><span>Đã trả ${pct(prog,0)} tổng nợ</span><span>Dự kiến hết nợ ${monthLabel(freeDate)}</span></div></div></div>`;
  }
  const band = dtiBand(T.dti);
  const left = S.income ? S.income - T.monthly : null;
  const stats = `<div class="grid">
    <div class="stat"><div class="k">Tổng dư nợ</div><div class="v">${fmtM(T.balance)}</div><div class="s">${a.length} khoản đang trả</div></div>
    <div class="stat"><div class="k">Trả trong tháng này</div><div class="v">${fmtM(T.monthly)}</div><div class="s">${T.monthly===0?'Không có kỳ nào đến hạn trong tháng này':(T.dti==null?'Nhập lương ở cuối trang để so sánh':pct(T.dti*100,0)+' lương')} ${T.monthly>0?`<span class="pill ${band.c}">${band.t}</span>`:''}</div></div>
    <div class="stat"><div class="k">Còn lại sau trả nợ</div><div class="v">${left==null?'—':fmtM(left)}</div><div class="s">trong tháng này</div></div>
    <div class="stat"><div class="k">Lãi/phí còn phải trả</div><div class="v">${fmtM(T.interest)}</div><div class="s">${T.unknownCost?'chưa gồm phí khoản nhập theo tháng':'nếu trả đúng lịch'}</div></div>${recvStat()}
  </div>`;
  const now = today();
  const list = a.length ? a.map(d=>({d,s:statusOf(d)})).sort((x,y)=>x.s.due-y.s.due).map(({d,s})=>{
    let pill, btn, amt = (s.paid && !s.none) ? monthlyOf(d) : amtOf(d,s);
    if(s.paid && s.none){ pill=`<span class="pill neutral">Chưa đến kỳ, tiếp theo ${s.due.getDate()}/${s.due.getMonth()+1}</span>`; btn=''; }
    else if(s.paid){ pill='<span class="pill good">Đã trả</span>'; btn=`<button class="btn sm ghost" data-act="unpay" data-id="${d.id}">Hoàn tác</button>`; }
    else {
      if(s.days<0) pill=`<span class="pill bad">Quá hạn ${-s.days} ngày</span>`;
      else if(s.days===0) pill='<span class="pill warn">Hôm nay</span>';
      else if(s.days<=5) pill=`<span class="pill warn">Còn ${s.days} ngày</span>`;
      else pill=`<span class="pill neutral">Còn ${s.days} ngày</span>`;
      btn=`<button class="btn sm dark" data-act="pay" data-id="${d.id}">Đã trả</button>`;
    }
    return `<div class="row ${s.paid&&!s.none?'done':''}"><div class="day"><b>${s.due.getDate()}</b><small>th ${s.due.getMonth()+1}</small></div>
      <div class="mid"><div class="n">${esc(d.name)}</div><div class="a">${fmt(amt)} đ ${pill}</div>${stmtLine(d)}</div>${btn}</div>`;
  }).join('') : '<p class="muted small">Chưa có kỳ trả nào.</p>';
  // cash-flow projection
  let proj='';
  if(a.length){
    const pj = projection(6); const mx = Math.max(1,...pj.map(x=>x.total));
    proj = `<h2>Dự báo 6 tháng tới</h2><div class="panel"><p class="small muted">Tổng tiền phải trả mỗi tháng, gồm khoản trả đều và khoản nhập theo từng tháng.</p><div class="pjw">` +
      pj.map(x=>{
        const r = S.income ? x.total/S.income : null; const bc = r==null?'neutral':dtiBand(r).c;
        const color = bc==='good'?'var(--good)':bc==='bad'?'var(--bad)':bc==='warn'?'var(--warn)':'var(--muted)';
        const items = x.items.map(i=>esc(i.n)+' '+fmt(i.a)).join(', ');
        return `<div class="pj"><div><b>${x.date.getMonth()+1}/${x.date.getFullYear()}</b></div>
          <div class="pb"><span style="width:${(x.total/mx*100).toFixed(1)}%;background:${color}"></span></div>
          <div class="pa"><b>${fmt(x.total)}</b><small>${r==null?'':pct(r*100,0)+' lương'}</small></div>
          ${items?`<div class="it">${items}</div>`:''}</div>`;
      }).join('') + `</div></div>`;
  }
  // priority
  let prio='';
  if(a.length){
    const rows = a.slice().sort((x,y)=>(isCustom(y)?-1:y.rate)-(isCustom(x)?-1:x.rate)).map(d=>{
      const r = remainingOf(d); const fee = payoffOf(d)*(d.prepay||0)/100; const gain = r.totalInterest - fee;
      const unk = isCustom(d) && !(d.principal>0);
      return `<tr><td>${esc(d.name)}</td><td>${isCustom(d)?'—':pct(d.rate,2)}</td><td>${unk?'?':fmt(r.totalInterest)}</td><td>${fmt(fee)}</td><td style="color:${unk?'var(--muted)':gain>0?'var(--good)':'var(--bad)'}">${unk?'?':(gain>0?'+':'')+fmt(gain)}</td></tr>`;
    }).join('');
    prio = `<h2>Nếu có tiền dư, trả khoản nào trước?</h2><div class="panel"><p class="small muted">Xếp theo lãi suất từ cao xuống thấp. Cột cuối là số tiền lời (hoặc lỗ) nếu tất toán toàn bộ khoản đó ngay bây giờ, sau khi trừ phí trả trước hạn. Khoản nhập theo tháng cần nhập thêm "gốc còn lại" mới tính được.</p>
      <div class="tbl"><table><thead><tr><th>Khoản</th><th>Lãi/năm</th><th>Lãi còn lại</th><th>Phí trả trước</th><th>Tất toán ngay</th></tr></thead><tbody>${rows}</tbody></table></div></div>`;
  }
  el.innerHTML = hero + stats +
    `<h2>Kỳ trả ${monthLabel(now)}</h2><div class="panel">${list}</div>` + recvSoon() + proj + prio +
    `<h2>Thu nhập</h2><div class="panel"><div class="form"><label class="f">Lương thực nhận mỗi tháng (đ)<input class="money" inputmode="numeric" id="income" value="${S.income?fmt(S.income):''}" placeholder="Ví dụ 18.000.000"></label></div>
     <p class="small muted" style="margin-top:8px">Mức tham khảo: tổng tiền trả nợ nên dưới 30 đến 40% thu nhập.</p></div>` + backupPanel();
}

