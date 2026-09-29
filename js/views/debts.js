/* ---------- render: debts ---------- */
function renderDebts(){
  const el = $('#v-debts');
  const cards = S.debts.map(d=>{
    const done = d.balance<=0; const r = done? {totalInterest:0, months:0} : remainingOf(d);
    const orig = d.original||d.balance; const prog = orig? (orig-d.balance)/orig*100 : 100;
    let facts, warn='';
    if(isCustom(d)){
      const u = unpaidRows(d), nx = u[0];
      facts = `<div>Kỳ tới<b>${nx?fmt(nx.a)+' (hạn '+rowDue(d,nx.k).getDate()+'/'+(rowDue(d,nx.k).getMonth()+1)+')':'—'}</b></div><div>Còn lại<b>${u.length} kỳ</b></div>
        <div>Tổng còn phải trả<b>${fmt(d.balance)}</b></div><div>${d.principal>0?'Phí/lãi còn lại':'Gốc còn lại'}<b>${d.principal>0?fmt(r.totalInterest):'Chưa nhập'}</b></div>`;
      if(nx && rowDue(d,nx.k) < new Date(today().getFullYear(),today().getMonth(),1)) warn='<p class="small" style="color:var(--bad)">Có kỳ của tháng trước chưa đánh dấu đã trả.</p>';
    } else {
      facts = `<div>Dư nợ<b>${fmt(d.balance)}</b></div><div>Trả/tháng<b>${fmt(d.payment)}</b></div>
        <div>Lãi suất/năm<b>${pct(d.rate,2)}</b></div><div>Còn lại<b>${done?0:r.months} kỳ</b></div>
        <div>Lãi còn phải trả<b>${fmt(r.totalInterest)}</b></div><div>Phí trả trước<b>${pct(d.prepay||0,2)}</b></div>`;
      if(!done && d.payment <= d.balance*mr(d)) warn='<p class="small" style="color:var(--bad)">Số tiền trả mỗi tháng không đủ trả lãi, dư nợ sẽ tăng lên.</p>';
    }
    let extra='';
    if(d.limit>0){ const used=payoffOf(d)/d.limit*100; extra += `<div>Hạn mức<b>${fmt(d.limit)}</b></div><div>Khả dụng<b>${fmt(Math.max(0,d.limit-payoffOf(d)))}</b></div><div>Đã dùng<b>${pct(used,0)}</b></div>`; }
    const ns=nextStmt(d); if(ns) extra += `<div>Sao kê kế tiếp<b>${ns.getDate()}/${ns.getMonth()+1}</b></div>`;
    extra += `<div>Cách tính hạn trả<b>${d.dueMode==='after' && d.stmtDay ? d.grace+' ngày sau sao kê' : 'Ngày '+d.dueDay+' hằng tháng'}</b></div>`;
    const stDue = statusOf(d).due;
    const sub = isCustom(d) ? (esc(d.kind||'')+' (mỗi tháng một số tiền)') : (esc(d.kind||'')+(d.rateImplied?' (lãi suất quy đổi từ số tiền trả)':''));
    return `<div class="debt"><div class="head"><div><div class="nm">${esc(d.name)}</div><div class="small muted">${sub}</div></div>
      ${done?'<span class="pill good">Đã tất toán</span>':`<span class="pill neutral">Hạn ${stDue.getDate()}/${stDue.getMonth()+1}</span>`}</div>
      <div class="facts">${facts}${extra}</div>${warn}
      <div class="bar"><span style="width:${Math.max(0,Math.min(100,prog)).toFixed(1)}%"></span></div>
      <div class="btns" style="margin-top:10px"><button class="btn sm" data-act="edit-debt" data-id="${d.id}">Sửa</button>
      <button class="btn sm" data-act="sched-debt" data-id="${d.id}">Lịch trả</button>
      ${isCustom(d)&&!done?`<button class="btn sm primary" data-act="linked-pay" data-id="${d.id}">Thanh toán từ tài khoản</button>`:''}
      ${!isCustom(d)&&!done?`<button class="btn sm" data-act="convert-debt" data-id="${d.id}">Chuyển sang lịch linh hoạt</button>`:''}
      <button class="btn sm ghost danger" data-act="del-debt" data-id="${d.id}">Xoá</button></div></div>`;
  }).join('');
  const lims = S.debts.filter(d=>d.limit>0); let limPanel='';
  if(lims.length){
    const sl = lims.reduce((s,d)=>s+d.limit,0), su = lims.reduce((s,d)=>s+payoffOf(d),0), ur = su/sl*100;
    limPanel = `<div class="grid" style="margin-bottom:6px"><div class="stat"><div class="k">Tổng hạn mức</div><div class="v">${fmtM(sl)}</div><div class="s">${lims.length} khoản có hạn mức</div></div>
      <div class="stat"><div class="k">Đang dùng</div><div class="v">${fmtM(su)}</div><div class="s">${pct(ur,0)} hạn mức <span class="pill ${ur<30?'good':ur<70?'warn':'bad'}">${ur<30?'Thấp':ur<70?'Trung bình':'Cao'}</span></div></div>
      <div class="stat"><div class="k">Còn khả dụng</div><div class="v">${fmtM(Math.max(0,sl-su))}</div><div class="s">Mức dùng thấp thường tốt cho điểm tín dụng</div></div></div>`;
  }
  el.innerHTML = `<div class="btns" style="justify-content:space-between;align-items:center"><h2 style="margin:6px 0">Các khoản nợ</h2><button class="btn primary" data-act="add-debt">Thêm khoản nợ</button></div>
    ${limPanel}${S.debts.length? cards : '<div class="empty-note">Chưa có khoản nợ nào. Thêm thẻ tín dụng, vay tiêu dùng, SPayLater… để theo dõi.</div>'}
    <p class="small muted" style="margin-top:14px">Bấm "Đã trả" ở Tổng quan để ghi nhận kỳ trả. Khoản trả đều tự trừ phần gốc theo dư nợ giảm dần; khoản nhập theo tháng đánh dấu đã trả đúng kỳ đó.</p>`;
}

/* ---------- debt dialog ---------- */
let dlg = null;
const KINDS = ['Vay tiêu dùng','Thẻ tín dụng','Trả sau (SPayLater…)','Vay qua ứng dụng','Vay người quen','Trả góp','Khác'];
function parseAmounts(s){
  const out=[];
  String(s||'').split(/[\s;]+/).forEach(tok=>{
    if(!tok) return;
    if(tok.includes(',') && !/^\d{1,3}(,\d{3})+$/.test(tok)) tok.split(',').forEach(x=>{ const v=parseMoney(x); if(v) out.push(v); });
    else { const v=parseMoney(tok); if(v) out.push(v); }
  });
  return out;
}
function collectVals(){
  if(!dlg) return;
  ['name','kind','day','prepay','bal','rate','pay','months','principal','limit','stmt','grace','duemode'].forEach(id=>{ const el=$('#f-'+id); if(el) dlg.vals[id]=el.value; });
}
function debtDialog(d, mode){
  const isNew = !d;
  const base = d || {name:'', kind:'Vay tiêu dùng', balance:0, rate:0, payment:0, months:0, dueDay:5, prepay:0};
  dlg = {d, isNew, mode: mode || (d && isCustom(d) ? 'custom' : 'formula'), rows: (d && isCustom(d)) ? d.sched.map(r=>Object.assign({},r)) : [], start: monthKey(today())};
  dlg.vals = { name:base.name, kind:base.kind, day:String(base.dueDay), prepay: base.prepay?String(base.prepay).replace('.',','):'',
    bal: base.balance?fmt(base.balance):'', rate: (base.rate && !base.rateImplied)?String(+base.rate.toFixed(4)).replace('.',','):'',
    pay: base.payment?fmt(base.payment):'', months: base.months?String(base.months):'', principal: base.principal?fmt(base.principal):'',
    limit: base.limit?fmt(base.limit):'', stmt: base.stmtDay?String(base.stmtDay):'', grace: base.grace?String(base.grace):'', duemode: base.dueMode==='after'?'after':'day' };
  if(dlg.rows.length){ const last=dlg.rows.map(r=>r.k).sort().pop(); dlg.start = monthKey(addMonths(kToDate(last),1)); }
  renderDebtDialog();
  $('#dlg').showModal();
}
function rowsHtml(){
  if(!dlg.rows.length) return '<p class="small muted" style="margin-top:8px">Chưa có tháng nào. Dùng "Thêm nhanh" hoặc "Dán danh sách" ở trên.</p>';
  return dlg.rows.map((r,i)=>`<div class="rrow"><select data-ri="${i}" data-f="k" aria-label="Tháng">${monthOptions(r.k)}</select>
    <input class="money" inputmode="numeric" data-ri="${i}" data-f="a" value="${r.a?fmt(r.a):''}" placeholder="Số tiền" aria-label="Số tiền">
    <label class="ck"><input type="checkbox" data-ri="${i}" data-f="p" ${r.p?'checked':''}>Đã trả</label>
    <button type="button" class="btn sm ghost danger" data-dact="rm" data-ri="${i}" aria-label="Xoá dòng">✕</button></div>`).join('');
}
function sumText(){
  const rows = dlg.rows.filter(r=>r.a>0); const un = rows.filter(r=>!r.p);
  return rows.length ? `${rows.length} tháng, tổng ${fmt(rows.reduce((s,r)=>s+r.a,0))} đ. Còn phải trả ${fmt(un.reduce((s,r)=>s+r.a,0))} đ (${un.length} kỳ).` : '';
}
function refreshRows(){ $('#rows').innerHTML = rowsHtml(); $('#rows-sum').textContent = sumText(); const st=$('#f-start'); if(st) st.innerHTML = monthOptions(dlg.start); }
function renderDebtDialog(){
  const v = dlg.vals, custom = dlg.mode==='custom';
  const seg = `<div class="seg" role="group" aria-label="Cách nhập"><button type="button" class="${!custom?'on':''}" data-dact="mode-formula">Trả đều hằng tháng</button><button type="button" class="${custom?'on':''}" data-dact="mode-custom">Mỗi tháng một số tiền</button></div>`;
  const kindSel = `<label class="f">Loại<select id="f-kind">${KINDS.map(k=>`<option ${k===v.kind?'selected':''}>${esc(k)}</option>`).join('')}${KINDS.includes(v.kind)?'':`<option selected>${esc(v.kind)}</option>`}</select></label>`;
  let body;
  if(!custom){
    body = `<div class="form">
      <label class="f">Tên khoản nợ<input id="f-name" value="${esc(v.name)}" placeholder="Ví dụ: Thẻ tín dụng VIB" required></label>${kindSel}
      <label class="f">Dư nợ hiện tại (đ)<input class="money" inputmode="numeric" id="f-bal" value="${esc(v.bal)}" required></label>
      ${dueFields()}
      <label class="f">Lãi suất %/năm<input inputmode="decimal" id="f-rate" value="${esc(v.rate)}" placeholder="Bỏ trống nếu không biết"></label>
      <label class="f">Số tiền trả mỗi tháng (đ)<input class="money" inputmode="numeric" id="f-pay" value="${esc(v.pay)}"></label>
      <label class="f">Số kỳ còn lại (tháng)<input inputmode="numeric" id="f-months" value="${esc(v.months)}"></label>
      <label class="f">Phí trả trước hạn (% dư nợ)<input inputmode="decimal" id="f-prepay" value="${esc(v.prepay)}" placeholder="Ví dụ 4"></label>
    </div><p class="small muted" style="margin-top:10px">Chỉ cần nhập 2 trong 3 ô: lãi suất, số tiền trả, số kỳ còn lại. Ô còn lại sẽ được tự tính. Nếu số tiền mỗi tháng khác nhau (như SPayLater), chuyển sang "Mỗi tháng một số tiền".</p>`;
  } else {
    body = `<p class="small muted">Dùng cho SPayLater, thẻ trả góp hoặc khoản có số tiền mỗi tháng khác nhau. Nhập từng tháng theo lịch trong ứng dụng của bên cho vay.</p>
    <div class="form" style="margin-top:10px">
      <label class="f">Tên khoản nợ<input id="f-name" value="${esc(v.name)}" placeholder="Ví dụ: SPayLater" required></label>${kindSel}
      ${dueFields()}
      <label class="f">Gốc còn lại (đ, không bắt buộc)<input class="money" inputmode="numeric" id="f-principal" value="${esc(v.principal)}" placeholder="Để biết phí/lãi ẩn"><span class="hint">Là số gốc thật còn nợ, không phải số dư khả dụng. Để trống nếu chưa biết. Cũng dùng làm số tiền tất toán ngay nếu biết</span></label>
      <label class="f">Phí trả trước hạn (%)<input inputmode="decimal" id="f-prepay" value="${esc(v.prepay)}" placeholder="Không bắt buộc"></label>
    </div>
    <div class="mini"><h3>Thêm nhanh</h3><div class="form">
      <label class="f">Từ tháng<select id="f-start">${monthOptions(dlg.start)}</select></label>
      <label class="f">Số tháng<input inputmode="numeric" id="f-cnt" value="1"></label>
      <label class="f">Mỗi tháng (đ)<input class="money" inputmode="numeric" id="f-amt" placeholder="Số tiền"></label>
    </div><div class="btns" style="margin-top:8px"><button type="button" class="btn sm" data-dact="quick-add">Thêm vào lịch</button></div>
    <h3 style="margin-top:14px">Dán danh sách số tiền</h3>
    <textarea id="f-paste" rows="3" placeholder="Gõ hoặc dán các số tiền theo thứ tự từng tháng, cách nhau bằng dấu cách hoặc xuống dòng. Ví dụ: 1.250.000 1.180.000 950.000"></textarea>
    <div class="btns" style="margin-top:8px"><button type="button" class="btn sm" data-dact="paste-add">Điền vào lịch từ tháng đã chọn</button></div></div>
    <h3>Lịch trả</h3><p class="small muted">Nếu bạn nhập ngày sao kê: mỗi dòng là <b>tháng tạo sao kê</b>, hạn trả tính theo sao kê đó (ví dụ sao kê 24/10, hạn ngày 10 thì hạn trả là 10/11, thuộc dòng 10/2026). Nếu không nhập ngày sao kê: mỗi dòng là tháng đến hạn.</p><div id="rows">${rowsHtml()}</div>
    <div class="btns" style="margin-top:8px"><button type="button" class="btn sm" data-dact="row-add">Thêm dòng</button><button type="button" class="btn sm ghost danger" data-dact="rows-clear">Xoá hết</button></div>
    <p class="small" id="rows-sum" style="margin-top:8px">${sumText()}</p>`;
  }
  $('#dlgForm').innerHTML = `<div class="dh">${dlg.isNew?'Thêm khoản nợ':'Sửa khoản nợ'}</div><div class="db">${seg}${body}<p class="small" id="f-err" style="color:var(--bad)"></p></div>
    <div class="df"><button class="btn ghost" value="cancel" formnovalidate>Huỷ</button><button class="btn primary" id="f-save" value="ok">Lưu</button></div>`;
  $('#f-save').onclick = saveDebt;
}
function dueFields(){
  const v=dlg.vals, after=v.duemode==='after';
  return `<label class="f">Hạn mức (đ, không bắt buộc)<input class="money" inputmode="numeric" id="f-limit" value="${esc(v.limit)}" placeholder="Ví dụ 50.000.000"></label>
  <label class="f">Ngày tạo sao kê (hóa đơn)<input inputmode="numeric" id="f-stmt" value="${esc(v.stmt)}" placeholder="1 đến 31, nếu có"></label>
  <label class="f">Cách tính hạn trả<select id="f-duemode"><option value="day" ${!after?'selected':''}>Ngày cố định hằng tháng</option><option value="after" ${after?'selected':''}>Số ngày sau ngày sao kê</option></select></label>
  ${after?`<label class="f">Hạn trả sau sao kê (ngày)<input inputmode="numeric" id="f-grace" value="${esc(v.grace)}" placeholder="Ví dụ 25"><span class="hint">Cần nhập ngày sao kê</span></label>`:`<label class="f">Ngày đến hạn hằng tháng<input inputmode="numeric" id="f-day" value="${esc(v.day)}" placeholder="1 đến 31"></label>`}`;
}
function sortRows(){ dlg.rows.sort((x,y)=>x.k<y.k?-1:x.k>y.k?1:0); }
function pushAmounts(amts){
  let k = $('#f-start').value || dlg.start; let dt = kToDate(k);
  amts.forEach((a,i)=>{ dlg.rows.push({k:monthKey(addMonths(dt,i)), a, p:0}); });
  dt = addMonths(dt, amts.length); dlg.start = monthKey(dt); sortRows(); refreshRows();
}
function dialogAction(b){
  const a = b.dataset.dact;
  if(a==='mode-formula' || a==='mode-custom'){ collectVals(); dlg.mode = a==='mode-custom'?'custom':'formula'; if(dlg.mode==='custom' && dlg.vals.kind==='Vay tiêu dùng') dlg.vals.kind='Trả sau (SPayLater…)'; renderDebtDialog(); }
  else if(a==='rm'){ dlg.rows.splice(+b.dataset.ri,1); refreshRows(); }
  else if(a==='row-add'){ const last = dlg.rows.length? dlg.rows[dlg.rows.length-1].k : monthKey(today()); dlg.rows.push({k: dlg.rows.length? monthKey(addMonths(kToDate(last),1)) : last, a:0, p:0}); refreshRows(); }
  else if(a==='rows-clear'){ dlg.rows=[]; refreshRows(); }
  else if(a==='quick-add'){ const cnt=Math.max(1,Math.min(60,parseInt($('#f-cnt').value)||1)); const amt=parseMoney($('#f-amt').value); if(!amt) return toast('Nhập số tiền mỗi tháng'); pushAmounts(Array(cnt).fill(amt)); }
  else if(a==='paste-add'){ const arr=parseAmounts($('#f-paste').value).slice(0,60); if(!arr.length) return toast('Chưa thấy số tiền nào'); pushAmounts(arr); $('#f-paste').value=''; }
}
function saveDebt(e){
  e.preventDefault(); collectVals(); const v = dlg.vals, err = $('#f-err');
  const name = (v.name||'').trim(), day = Math.max(1,Math.min(31,parseInt(v.day)||0)), prepay = parseNum(v.prepay);
  const after = v.duemode==='after', stmt = parseInt(v.stmt)||0, grace = parseInt(v.grace)||0;
  if(!name) return err.textContent='Nhập tên khoản nợ.';
  if(v.stmt && !(stmt>=1 && stmt<=31)) return err.textContent='Ngày sao kê phải từ 1 đến 31.';
  if(after){
    if(!(stmt>=1 && stmt<=31)) return err.textContent='Nhập ngày sao kê (1 đến 31).';
    if(!(grace>=1 && grace<=45)) return err.textContent='Nhập số ngày hạn trả sau sao kê (1 đến 45).';
  } else if(!parseInt(v.day)) return err.textContent='Nhập ngày đến hạn.';
  const dueDayVal = after ? stmt : day, limitVal = parseMoney(v.limit);
  const d = dlg.d, isNew = dlg.isNew; let obj;
  if(dlg.mode==='custom'){
    const sched = dlg.rows.filter(r=>r.a>0).map(r=>({...r,p:r.p||0})).sort((x,y)=>x.k<y.k?-1:x.k>y.k?1:0);
    try{ if(d) validateDebtEdit(d,dlg.mode,sched); }catch(e){ return err.textContent=e.message; }
    if(!sched.length) return err.textContent='Nhập ít nhất một tháng có số tiền.';
    obj = Object.assign(d || {id:uid(), paid:{}}, {name, kind:v.kind, mode:'custom', sched, dueDay:dueDayVal, limit:limitVal, stmtDay:stmt, dueMode:after?'after':'day', grace:after?grace:0, prepay, principal:parseMoney(v.principal), rate:0, rateImplied:false});
    recalc(obj);
  } else {
    try{ if(d) validateDebtEdit(d,dlg.mode,[]); }catch(e){ return err.textContent=e.message; }
    const bal = parseMoney(v.bal); let rate = parseNum(v.rate), pay = parseMoney(v.pay), months = parseInt(v.months)||0;
    if(!bal) return err.textContent='Nhập dư nợ hiện tại.';
    const have = (rate>0)+(pay>0)+(months>0);
    if(have<2) return err.textContent='Cần nhập ít nhất 2 trong 3 ô: lãi suất, số tiền trả, số kỳ còn lại.';
    let implied=false;
    if(rate>0 && pay>0){ months = nper(bal, rate/1200, pay); if(months===Infinity) return err.textContent='Số tiền trả mỗi tháng không đủ trả lãi. Kiểm tra lại.'; }
    else if(rate>0 && months>0){ pay = Math.round(pmt(bal, rate/1200, months)); }
    else { rate = rateFor(bal, pay, months)*1200; implied=true; }
    obj = Object.assign(d || {id:uid(), paid:{}, original:bal}, {name, kind:v.kind, mode:'formula', balance:bal, rate, payment:pay, months, dueDay:dueDayVal, limit:limitVal, stmtDay:stmt, dueMode:after?'after':'day', grace:after?grace:0, prepay, rateImplied:implied});
    delete obj.sched; delete obj.principal; delete obj.lastPaidK;
    if(d && (!obj.original || obj.original<bal || d.mode==='custom')) obj.original = bal;
  }
  if(isNew) S.debts.push(obj);
  save(); $('#dlg').close(); renderAll(); toast(isNew?'Đã thêm khoản nợ':'Đã lưu thay đổi');
}

function schedDialog(d){
  if(isCustom(d)){
    const hasSt = d.stmtDay>0;
    const rows = (d.sched||[]).slice().sort((x,y)=>x.k<y.k?-1:x.k>y.k?1:0).map(r=>{ const [yy,mm]=r.k.split('-').map(Number); const du=rowDue(d,r.k); const st=hasSt?dueDate(yy,mm-1,d.stmtDay):null;
      return `<tr><td>${hasSt?st.getDate()+'/'+(st.getMonth()+1):kLabel(r.k)}</td>${hasSt?`<td>${du.getDate()}/${du.getMonth()+1}</td>`:''}<td>${fmt(r.a)}</td><td>${r.p?'Đã trả '+esc(r.p):r.settled?'Đã thanh toán '+fmt(r.settled)+' đ · còn '+fmt(rowRemaining(r))+' đ':'Chưa trả'}</td></tr>`; }).join('');
    const cost = d.principal>0 ? `Phí/lãi còn lại so với gốc: ${fmt(Math.max(0,d.balance-d.principal))} đ.` : 'Nhập "gốc còn lại" khi sửa để biết phí/lãi ẩn trong các kỳ.';
    $('#dlgForm').innerHTML = `<div class="dh">${esc(d.name)}: lịch trả</div><div class="db"><div class="tbl" style="max-height:60vh;overflow:auto"><table><thead><tr><th>${hasSt?'Sao kê':'Tháng'}</th>${hasSt?'<th>Hạn trả</th>':''}<th>Số tiền</th><th>Trạng thái</th></tr></thead><tbody>${rows}</tbody></table></div>
    <p class="small muted" style="margin-top:8px">Tổng còn phải trả: ${fmt(d.balance)} đ. ${cost}</p></div><div class="df"><button class="btn" value="close">Đóng</button></div>`;
    $('#dlg').showModal(); return;
  }
  const r = remainingOf(d); const start = statusOf(d).paid? addMonths(today(),1) : today();
  const rows = r.rows.map((x,i)=>{ const m=addMonths(start,i); return `<tr><td>${m.getMonth()+1}/${m.getFullYear()}</td><td>${fmt(x.pay)}</td><td>${fmt(x.prin)}</td><td>${fmt(x.i)}</td><td>${fmt(x.bal)}</td></tr>`; }).join('');
  $('#dlgForm').innerHTML = `<div class="dh">${esc(d.name)}: lịch trả còn lại</div><div class="db"><div class="tbl" style="max-height:60vh;overflow:auto"><table><thead><tr><th>Kỳ</th><th>Trả</th><th>Gốc</th><th>Lãi</th><th>Dư nợ</th></tr></thead><tbody>${rows}</tbody></table></div>
  <p class="small muted" style="margin-top:8px">Tổng lãi còn lại: ${fmt(r.totalInterest)} đ. Có thể lệch vài đồng so với bảng của ngân hàng do làm tròn.</p></div><div class="df"><button class="btn" value="close">Đóng</button></div>`;
  $('#dlg').showModal();
}

