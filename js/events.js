/* ---------- events ---------- */
function fmtMoneyInput(t, e){
  const raw = t.value; const caret = t.selectionStart==null ? raw.length : t.selectionStart;
  let before = raw.slice(0,caret).replace(/\D/g,'').length;
  let digits = raw.replace(/\D/g,'');
  const prev = (t._prev||'').replace(/\D/g,'');
  const it = e && e.inputType ? e.inputType : '';
  if(it.indexOf('delete')===0 && prev.length && digits===prev){
    // người dùng vừa xoá dấu chấm ngăn cách: xoá luôn chữ số bên cạnh
    if(it==='deleteContentForward') digits = digits.slice(0,before)+digits.slice(before+1);
    else { digits = digits.slice(0,Math.max(0,before-1))+digits.slice(before); before = Math.max(0,before-1); }
  }
  const v = parseInt(digits,10);
  t.value = v ? v.toLocaleString('vi-VN') : '';
  let pos=0, cnt=0; while(pos<t.value.length && cnt<before){ if(/\d/.test(t.value[pos])) cnt++; pos++; }
  try{ t.setSelectionRange(pos,pos); }catch(_){}
  t._prev = t.value;
}
document.addEventListener('focusin', e=>{ const t=e.target; if(t && t.classList && t.classList.contains('money')) t._prev=t.value; });
document.addEventListener('click', e=>{
  const tab = e.target.closest('[data-tab]');
  if(tab){ document.querySelectorAll('[data-tab]').forEach(b=>b.setAttribute('aria-selected', b===tab?'true':'false'));
    document.querySelectorAll('section.view').forEach(v=>v.classList.toggle('on', v.id==='v-'+tab.dataset.tab)); window.scrollTo({top:0}); return; }
  const p = e.target.closest('[data-preset]');
  if(p){ if(p.dataset.preset==='a') Object.assign(S.calc,{rate:17.99, prepay:4, upfront:0}); else Object.assign(S.calc,{rate:16}); save(); renderCalc(); return; }
  const da = e.target.closest('[data-dact]'); if(da && dlg){ dialogAction(da); return; }
  const b = e.target.closest('[data-act]'); if(!b) return;
  const act = b.dataset.act, d = S.debts.find(x=>x.id===b.dataset.id);
  if(d && ['del-debt','del-yes','unpay'].includes(act) && allTransactions().some(t=>['repayment','credit'].includes(t.type)&&t.debt===d.id)) return toast('Khoản nợ có giao dịch liên kết. Hoàn tác giao dịch trong Chi tiêu trước khi xoá hoặc hoàn tác lịch cũ.');
  if(act==='linked-pay' && d){ debtPaymentDialog(d); return; }
  if(act==='convert-debt' && d){
    spendDialog('Chuyển sang lịch linh hoạt',`<p>Chỉ chuyển các kỳ còn lại của ${esc(d.name)}. Tổng lịch gồm cả lãi dự kiến, nên khác dư nợ gốc. Không trừ tài khoản hoặc tạo lịch sử trả nợ cũ.</p><p>Đối chiếu lịch ngân hàng sau khi chuyển. Hãy xuất sao lưu trước nếu muốn trở lại công thức cũ.</p>`,()=>convertFormulaDebt(d.id)); return;
  }
  if(spendAction(act,b)) return;
  if(backupAction(act, b)) return;
  if(act==='add-debt') debtDialog();
  else if(act==='edit-debt' && d) debtDialog(d);
  else if(act==='sched-debt' && d) schedDialog(d);
  else if(act==='del-debt' && d){
    $('#dlgForm').innerHTML = `<div class="dh">Xoá khoản nợ?</div><div class="db"><p>Xoá "${esc(d.name)}" khỏi sổ? Toàn bộ lịch trả và các kỳ đã đánh dấu của khoản này sẽ mất.</p></div>
      <div class="df"><button class="btn ghost" value="cancel" formnovalidate>Huỷ</button><button class="btn danger" data-act="del-yes" data-id="${d.id}" value="del">Xoá</button></div>`;
    $('#dlg').showModal();
  }
  else if(act==='del-yes' && d){ S.debts=S.debts.filter(x=>x!==d); save(); renderAll(); toast('Đã xoá khoản nợ'); }
  else if(act==='pay' && d){
    if(isCustom(d)){
      debtPaymentDialog(d); return;
    }
    const key = monthKey(today());
    if(d.balance<=0 || (d.paid && d.paid[key])) return;
    if(!(d.payment>0)) return toast('Nhập số tiền trả trước khi ghi nhận.');
    const i = Math.round(d.balance*mr(d)); let prin = d.payment - i; if(prin>d.balance) prin=d.balance;
    d.paid = d.paid||{}; d.paid[key] = {prevBalance:d.balance, prevMonths:d.months, at:todayStr()};
    d.balance = Math.max(0, Math.round(d.balance - prin)); d.months = Math.max(0,(d.months||0)-1);
    save(); renderAll(); toast(d.balance===0?'Đã tất toán "'+d.name+'"!':'Đã ghi nhận kỳ trả');
  }
  else if(act==='unpay' && d){
    if(isCustom(d)){
      const k=d.lastPaidK||monthKey(today()); const rows=(d.sched||[]).filter(r=>r.k===k && r.p);
      if(rows.length){ rows.forEach(r=>{ r.p=0; }); recalc(d); save(); renderAll(); toast('Đã hoàn tác'); } return;
    }
    const key=monthKey(today()); const pv=d.paid&&d.paid[key]; if(pv){ d.balance=pv.prevBalance; d.months=pv.prevMonths; delete d.paid[key]; save(); renderAll(); toast('Đã hoàn tác'); }
  }
  else if(act==='calc-to-debt'){
    const c=S.calc; const A=Math.round(pmt(c.amount,c.rate/1200,c.months));
    debtDialog(); $('#f-name').value='Vay tín chấp'; $('#f-bal').value=fmt(c.amount); $('#f-rate').value=String(c.rate).replace('.',','); $('#f-pay').value=fmt(A); $('#f-prepay').value=String(c.prepay).replace('.',',');
  }
  else if(act==='fund-add' || act==='fund-sub'){
    const amt = parseMoney($('#fund-amt').value); if(!amt) return toast('Nhập số tiền');
    const s = act==='fund-add'?1:-1; S.fund.saved = Math.max(0, S.fund.saved + s*amt);
    S.fund.log = (S.fund.log||[]).concat({d:new Date().toLocaleDateString('vi-VN'), a:s*amt}).slice(-60);
    save(); renderFund(); toast(s>0?'Đã thêm vào quỹ':'Đã rút khỏi quỹ');
  }
  else if(act==='plan-add'){
    const P=ensurePlan(), kind=b.dataset.kind, nk=monthKey(addMonths(today(),1)), ck=monthKey(today());
    if(kind==='cash') P.cash.push({id:uid(),name:'',a:0});
    else if(kind==='buys') P.buys.push({id:uid(),name:'',a:0,k:ck});
    else if(kind==='loans') P.loans.push({id:uid(),name:'Khoản vay dự định',amount:0,rate:17.99,months:12,k:nk,fee:0,payoff:[]});
    save(); renderPlan();
  }
  else if(act==='plan-del'){ const P=ensurePlan(), kind=b.dataset.kind; P[kind]=P[kind].filter(x=>x.id!==b.dataset.id); save(); renderPlan(); }
  else if(act==='calc-to-plan'){
    const P=ensurePlan(), c=S.calc;
    P.loans.push({id:uid(),name:'Khoản vay dự định',amount:c.amount,rate:c.rate,months:c.months,k:monthKey(addMonths(today(),1)),fee:c.upfront||0,payoff:(c.consolidate||[]).slice()});
    save(); renderPlan(); toast('Đã thêm vào Kế hoạch'); const tb=document.querySelector('[data-tab=plan]'); if(tb) tb.click();
  }
  else if(act==='recv-add') recvDialog();
  else if(act==='recv-edit'){ const r=recvs().find(x=>x.id===b.dataset.id); if(r) recvDialog(r); }
  else if(act==='recv-got'){ const r=recvs().find(x=>x.id===b.dataset.id); if(r) receiptDialog(r); }
  else if(act==='recv-got-ok'){
    const r=recvs().find(x=>x.id===b.dataset.id); if(!r) return; const a=parseMoney(($('#rc-amt')||{}).value); const i=recvInfo(r);
    if(!(a>0)) return; const use=Math.min(a,i.out); r.got=(r.got||0)+use; r.log=(r.log||[]).concat({d:todayStr(),a:use}).slice(-40);
    save(); renderAll(); toast('Đã ghi nhận khoản thu');
  }
  else if(act==='recv-undo'){ const r=recvs().find(x=>x.id===b.dataset.id); if(!r||!(r.log||[]).length) return; const l=r.log.pop(); r.got=Math.max(0,(r.got||0)-l.a); save(); renderAll(); toast('Đã hoàn tác lần thu gần nhất'); }
  else if(act==='recv-del'){
    const r=recvs().find(x=>x.id===b.dataset.id); if(!r) return;
    $('#dlgForm').innerHTML = `<div class="dh">Xoá khoản phải thu?</div><div class="db"><p>Xoá khoản của "${esc(r.name)}" khỏi sổ? Các lần đã thu của khoản này cũng mất.</p></div>
      <div class="df"><button class="btn ghost" value="cancel" formnovalidate>Huỷ</button><button class="btn danger" data-act="recv-del-yes" data-id="${r.id}" value="del">Xoá</button></div>`;
    $('#dlg').showModal();
  }
  else if(act==='recv-del-yes'){ S.recv=recvs().filter(x=>x.id!==b.dataset.id); save(); renderAll(); toast('Đã xoá khoản phải thu'); }
  else if(act==='set-need'){ S.calc.amount = +b.dataset.need; save(); renderCalc(); }
  else if(act==='fund-2m'){ S.fund.target = Math.round(totals().typical*2); save(); renderFund(); }
});
document.addEventListener('input', e=>{
  const t = e.target;
  if(t.classList.contains('money')) fmtMoneyInput(t, e);
  if(t.id==='payoff'){ S.calc.payoffAt = +t.value; save(); renderCalc(); const s=$('#payoff'); s && s.focus(); }
  if(t.dataset && t.dataset.plan) planEdit(t);
  if(dlg && t.dataset && t.dataset.ri!==undefined && t.dataset.f==='a'){ const r=dlg.rows[+t.dataset.ri]; if(r){ r.a=parseMoney(t.value); const sm=$('#rows-sum'); if(sm) sm.textContent=sumText(); } }
});
document.addEventListener('change', e=>{
  const t = e.target;
  if(t.id==='spend-month' || t.id==='report-month'){ if(isMK(t.value)){ spendMonth=t.value; renderSpend(); renderReports(); } return; }
  if(t.id==='bk-file'){ const f=t.files && t.files[0]; if(f) f.text().then(tx=>{ const ta=$('#bk-text'); if(ta) ta.value=tx; }); return; }
  if(t.dataset && t.dataset.plan){ planEdit(t); return; }
  if(dlg && t.id==='f-duemode'){ collectVals(); renderDebtDialog(); return; }
  if(rdlg && t.id==='r-kind'){ collectR(); renderRecvDialog(); return; }
  if(dlg && t.dataset && t.dataset.ri!==undefined){ const r=dlg.rows[+t.dataset.ri]; if(r){ const f=t.dataset.f; if(f==='k') r.k=t.value; else if(f==='a') r.a=parseMoney(t.value); else if(f==='p') r.p=t.checked?todayStr():0; const sm=$('#rows-sum'); if(sm) sm.textContent=sumText(); } return; }
  if(t.id==='income'){ S.income = parseMoney(t.value); save(); renderAll(); }
  else if(t.classList.contains('c-in')){
    const k=t.dataset.k; let v = (k==='amount'||k==='upfront')? parseMoney(t.value) : k==='months'? Math.max(1,Math.min(360,parseInt(t.value)||1)) : parseNum(t.value);
    S.calc[k]=v; if(S.calc.payoffAt>=S.calc.months) S.calc.payoffAt=Math.max(1,Math.floor(S.calc.months/2)); save(); renderCalc();
  }
  else if(t.dataset.cons){ const id=t.dataset.cons; const set=new Set(S.calc.consolidate||[]); t.checked?set.add(id):set.delete(id); S.calc.consolidate=[...set]; save(); renderCalc(); }
  else if(t.id==='fund-target'){ S.fund.target=parseMoney(t.value); save(); renderFund(); }
  else if(t.id==='fund-monthly'){ S.fund.monthly=parseMoney(t.value); save(); renderFund(); }
});

$('#dlg').addEventListener('close',()=>{ dlg=null; rdlg=null; });
