function recvPill(i){
  if(i.out<=0) return '<span class="pill good">Đã thu đủ</span>';
  if(i.late>0) return `<span class="pill bad">Chậm thu ${i.lateDays>0?i.lateDays+' ngày':'hôm nay'}</span>`;
  if(i.next){ const n=Math.round((i.next-today())/86400000); return `<span class="pill ${n<=3?'warn':'neutral'}">${n===0?'Hôm nay':'Còn '+n+' ngày'} (${i.next.getDate()}/${i.next.getMonth()+1})</span>`; }
  return '<span class="pill neutral">Chưa có hạn</span>';
}
function recvStat(){
  const L=recvs(); if(!L.length) return '';
  let out=0, late=0, nl=0; L.forEach(r=>{ const i=recvInfo(r); out+=i.out; if(i.late>0){ late+=i.late; nl++; } });
  return `<div class="stat"><div class="k">Người khác nợ bạn</div><div class="v">${fmtM(out)}</div><div class="s">${L.length} khoản${nl?`, chậm thu ${fmtM(late)}`:''}</div></div>`;
}
function recvSoon(){
  const L=recvs().map(r=>({r,i:recvInfo(r)})).filter(x=>x.i.out>0 && (x.i.late>0 || (x.i.next && Math.round((x.i.next-today())/86400000)<=30)));
  if(!L.length) return '';
  L.sort((a,b)=>(a.i.late>0?a.i.lateSince:a.i.next)-(b.i.late>0?b.i.lateSince:b.i.next));
  const rows=L.map(({r,i})=>{ const dt=i.late>0?i.lateSince:i.next;
    return `<div class="row"><div class="day"><b>${dt.getDate()}</b><small>th ${dt.getMonth()+1}</small></div><div class="mid"><div class="n">${esc(r.name)}</div><div class="a">${fmt(i.nextAmt)} đ ${recvPill(i)}</div></div><button class="btn sm dark" data-act="recv-got" data-id="${r.id}">Đã thu</button></div>`; }).join('');
  return `<h2>Sắp thu và chậm thu</h2><div class="panel">${rows}</div>`;
}
function renderRecv(){
  const el=$('#v-recv'); const L=recvs();
  let out=0, got=0, late=0, soon=0;
  const infos=L.map(r=>{ const i=recvInfo(r); out+=i.out; got+=(r.got||0); late+=i.late; if(i.out>0 && i.late<=0 && i.next && Math.round((i.next-today())/86400000)<=30) soon+=i.nextAmt; return i; });
  const grid = L.length? `<div class="grid"><div class="stat"><div class="k">Còn phải thu</div><div class="v">${fmtM(out)}</div><div class="s">${L.filter((r,x)=>infos[x].out>0).length} khoản chưa thu đủ</div></div>
    <div class="stat"><div class="k">Đã thu</div><div class="v">${fmtM(got)}</div><div class="s">tổng các lần thu</div></div>
    <div class="stat"><div class="k">Chậm thu</div><div class="v ${late>0?'neg':''}">${fmtM(late)}</div><div class="s">đã quá hạn hẹn trả</div></div>
    <div class="stat"><div class="k">Dự kiến thu 30 ngày tới</div><div class="v">${fmtM(soon)}</div><div class="s">chưa gồm khoản chậm</div></div></div>` : '';
  const cards=L.map((r,x)=>{ const i=infos[x]; const prog=r.amount?Math.min(100,(r.got||0)/r.amount*100):0;
    const how = r.kind==='plan' ? `Mỗi tháng ${fmt(r.per||0)} đ, ngày ${r.day||1}, từ ${r.startK?kLabel(r.startK):'—'}` : (r.due? 'Một lần, hẹn '+fmtD(parseISO(r.due)) : 'Một lần, chưa có hạn');
    const last=(r.log||[]).slice(-1)[0];
    return `<div class="debt"><div class="head"><div><div class="nm">${esc(r.name)}</div><div class="small muted">${esc(r.note||'')}</div></div>${recvPill(i)}</div>
      <div class="facts"><div>Tổng nợ<b>${fmt(r.amount)}</b></div><div>Đã thu<b>${fmt(r.got||0)}</b></div><div>Còn lại<b>${fmt(i.out)}</b></div><div>Cách thu<b>${esc(how)}</b></div><div>Tính vào dự báo<b>${r.inc===false?'Không':'Có'}</b></div>${last?`<div>Lần thu gần nhất<b>${fmt(last.a)} (${esc(last.d.slice(8,10)+'/'+last.d.slice(5,7))})</b></div>`:''}</div>
      <div class="bar"><span style="width:${prog.toFixed(1)}%"></span></div>
      <div class="btns" style="margin-top:10px">${i.out>0?`<button class="btn sm dark" data-act="recv-got" data-id="${r.id}">Ghi nhận đã thu</button>`:''}<button class="btn sm" data-act="recv-edit" data-id="${r.id}">Sửa</button>${last?`<button class="btn sm ghost" data-act="recv-undo" data-id="${r.id}">Hoàn tác lần thu gần nhất</button>`:''}<button class="btn sm ghost danger" data-act="recv-del" data-id="${r.id}">Xoá</button></div></div>`; }).join('');
  el.innerHTML=`<div class="btns" style="justify-content:space-between;align-items:center"><h2 style="margin:6px 0">Người khác nợ bạn</h2><button class="btn primary" data-act="recv-add">Thêm khoản phải thu</button></div>
    ${grid}${L.length? cards : '<div class="empty-note">Chưa có khoản nào. Thêm tiền bạn bè, người thân hoặc đơn vị đang nợ bạn để theo dõi và tính vào kế hoạch tiền.</div>'}
    <p class="small muted" style="margin-top:14px">Khoản đánh dấu "Tính vào dự báo" sẽ được cộng vào dòng tiền ở tab Kế hoạch theo hạn hẹn trả. Nếu chưa chắc người ta trả, bỏ đánh dấu để dự báo an toàn hơn.</p>`;
}
let rdlg=null;
function collectR(){ if(!rdlg) return; ['name','amount','got','kind','due','startK','day','per','note'].forEach(id=>{ const e=$('#r-'+id); if(e) rdlg.vals[id]=e.value; }); const inc=$('#r-inc'); if(inc) rdlg.vals.inc=inc.checked; }
function recvDialog(r){
  const base=r||{name:'',amount:0,got:0,kind:'once',due:'',startK:monthKey(addMonths(today(),1)),day:5,per:0,inc:true,note:''};
  rdlg={r,isNew:!r,vals:{name:base.name,amount:base.amount?fmt(base.amount):'',got:base.got?fmt(base.got):'',kind:base.kind||'once',due:base.due||'',startK:base.startK||monthKey(addMonths(today(),1)),day:String(base.day||5),per:base.per?fmt(base.per):'',note:base.note||'',inc:base.inc!==false}};
  renderRecvDialog(); $('#dlg').showModal();
}
function renderRecvDialog(){
  const v=rdlg.vals, plan=v.kind==='plan';
  $('#dlgForm').innerHTML=`<div class="dh">${rdlg.isNew?'Thêm khoản phải thu':'Sửa khoản phải thu'}</div><div class="db"><div class="form">
    <label class="f">Ai hoặc bên nào nợ bạn<input id="r-name" value="${esc(v.name)}" placeholder="Ví dụ: Anh Nam, Công ty A"></label>
    <label class="f">Tổng số tiền nợ (đ)<input class="money" inputmode="numeric" id="r-amount" value="${esc(v.amount)}"></label>
    <label class="f">Đã thu được (đ)<input class="money" inputmode="numeric" id="r-got" value="${esc(v.got)}" placeholder="0"></label>
    <label class="f">Cách thu<select id="r-kind"><option value="once" ${!plan?'selected':''}>Trả một lần</option><option value="plan" ${plan?'selected':''}>Trả dần theo tháng</option></select></label>
    ${plan?`<label class="f">Tháng bắt đầu thu<select id="r-startK">${monthOptions(v.startK)}</select></label>
      <label class="f">Ngày thu hằng tháng<input inputmode="numeric" id="r-day" value="${esc(v.day)}" placeholder="1 đến 31"></label>
      <label class="f">Mỗi tháng thu (đ)<input class="money" inputmode="numeric" id="r-per" value="${esc(v.per)}"></label>`
     :`<label class="f">Hạn hẹn trả (không bắt buộc)<input type="date" id="r-due" value="${esc(v.due)}"></label>`}
    <label class="f">Ghi chú (không bắt buộc)<input id="r-note" value="${esc(v.note)}" placeholder="Lý do nợ, cách liên hệ..."></label>
  </div><label class="check" style="margin-top:10px"><input type="checkbox" id="r-inc" ${v.inc?'checked':''}><span>Tính vào dự báo dòng tiền ở tab Kế hoạch</span></label>
  <p class="small" id="r-err" style="color:var(--bad)"></p></div>
  <div class="df"><button class="btn ghost" value="cancel" formnovalidate>Huỷ</button><button class="btn primary" id="r-save" value="ok">Lưu</button></div>`;
  $('#r-save').onclick=saveRecv;
}
function saveRecv(e){
  e.preventDefault(); collectR(); const v=rdlg.vals, err=$('#r-err');
  const name=(v.name||'').trim(), amount=parseMoney(v.amount); let got=parseMoney(v.got);
  if(!name) return err.textContent='Nhập tên người hoặc bên đang nợ bạn.';
  if(!(amount>0)) return err.textContent='Nhập tổng số tiền nợ.';
  if(got>amount) got=amount;
  const kind=v.kind==='plan'?'plan':'once'; const o={name,amount,got,kind,note:(v.note||'').trim(),inc:!!v.inc};
  if(kind==='plan'){
    const per=parseMoney(v.per), day=parseInt(v.day)||0;
    if(!(per>0)) return err.textContent='Nhập số tiền thu mỗi tháng.';
    if(!(day>=1&&day<=31)) return err.textContent='Ngày thu hằng tháng phải từ 1 đến 31.';
    Object.assign(o,{per,day,startK:v.startK||monthKey(today()),due:''});
  } else { if(v.due && !parseISO(v.due)) return err.textContent='Hạn hẹn trả không hợp lệ.'; Object.assign(o,{due:v.due||'',per:0}); }
  const wasNew=rdlg.isNew;
  if(wasNew) recvs().push(Object.assign({id:uid(),log:[]},o)); else Object.assign(rdlg.r,o);
  save(); $('#dlg').close(); renderAll(); toast(wasNew?'Đã thêm khoản phải thu':'Đã lưu thay đổi');
}
function receiptDialog(r){
  const i=recvInfo(r); const def=i.nextAmt>0?i.nextAmt:i.out;
  $('#dlgForm').innerHTML=`<div class="dh">Ghi nhận đã thu từ ${esc(r.name)}</div><div class="db"><p class="small muted">Còn phải thu ${fmt(i.out)} đ.</p>
    <label class="f">Số tiền vừa thu (đ)<input class="money" inputmode="numeric" id="rc-amt" value="${fmt(def)}"></label><p class="small" id="rc-err" style="color:var(--bad)"></p></div>
    <div class="df"><button class="btn ghost" value="cancel" formnovalidate>Huỷ</button><button class="btn primary" data-act="recv-got-ok" data-id="${r.id}" value="ok">Ghi nhận</button></div>`;
  $('#dlg').showModal();
}

