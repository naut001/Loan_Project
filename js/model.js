/* Mô hình dữ liệu: trạng thái khoản nợ, kỳ trả, phải thu, mô phỏng dòng tiền. Không đụng tới DOM. */
const isCustom = d => d.mode==='custom';
const monthIdx = k => { const [y,m]=k.split('-').map(Number); return y*12+(m-1); };
const nowIdx = () => { const t=today(); return t.getFullYear()*12+t.getMonth(); };
const kToDate = k => { const [y,m]=k.split('-').map(Number); return new Date(y,m-1,1); };
function dueOn(d,y,m){
  if(d.dueMode==='after' && d.stmtDay>0 && d.grace>0){
    const c1=new Date(y, m-1, Math.min(d.stmtDay, daysIn(y,m-1))+d.grace);
    if(c1.getFullYear()===new Date(y,m,1).getFullYear() && c1.getMonth()===new Date(y,m,1).getMonth()) return c1;
    const c2=new Date(y, m, Math.min(d.stmtDay, daysIn(y,m))+d.grace);
    if(c2.getFullYear()===new Date(y,m,1).getFullYear() && c2.getMonth()===new Date(y,m,1).getMonth()) return c2;
  }
  return dueDate(y,m,d.dueDay||d.stmtDay||1);
}
function nextStmt(d){
  if(!(d.stmtDay>0)) return null; const t=today();
  let c=dueDate(t.getFullYear(),t.getMonth(),d.stmtDay); if(c<t) c=dueDate(t.getFullYear(),t.getMonth()+1,d.stmtDay); return c;
}
function stmtLine(d){
  const c=nextStmt(d); if(!c) return ''; const n=Math.round((c-today())/86400000);
  return `<div class="a">Sao kê ${c.getDate()}/${c.getMonth()+1}${n===0?' (hôm nay)':' (còn '+n+' ngày)'}</div>`;
}
function dueFromStmt(d,y,m){ // hạn trả của sao kê tạo ở tháng (y, m: 0-11)
  const st = dueDate(y,m,d.stmtDay);
  if(d.dueMode==='after' && d.grace>0) return new Date(st.getFullYear(), st.getMonth(), st.getDate()+d.grace);
  let c = dueDate(y,m,d.dueDay||d.stmtDay);
  if(c<=st) c = dueDate(y,m+1,d.dueDay||d.stmtDay);
  return c;
}
// Khoản nhập theo tháng: nếu có ngày sao kê thì dòng = tháng tạo sao kê, nếu không thì dòng = tháng đến hạn
function rowDue(d,k){ const [y,m]=k.split('-').map(Number); return d.stmtDay>0 ? dueFromStmt(d,y,m-1) : dueOn(d,y,m-1); }
const dueIdx = x => x.getFullYear()*12+x.getMonth();
const kLabel = k => { const [y,m]=k.split('-'); return Number(m)+'/'+y; };
const rowRemaining = r => r.p ? 0 : Math.max(0,r.a-(r.settled||0));
const unpaidRows = d => (d.sched||[]).filter(r=>rowRemaining(r)>0).map(r=>({...r,a:rowRemaining(r)})).sort((x,y)=>x.k<y.k?-1:x.k>y.k?1:0);
function recalc(d){
  if(!isCustom(d)) return d;
  const u=unpaidRows(d);
  d.balance=u.reduce((s,r)=>s+r.a,0);
  d.payment=u.length? u.filter(r=>r.k===u[0].k).reduce((s,r)=>s+r.a,0) : 0;
  d.months=u.length;
  d.original=(d.sched||[]).reduce((s,r)=>s+r.a,0);
  return d;
}
const active = () => S.debts.filter(d => d.balance > 0);
const mr = d => (d.rate||0)/100/12;
const payoffOf = d => (isCustom(d) && d.principal>0) ? d.principal : d.balance;
function monthlyOf(d, strict){
  if(!isCustom(d)) return d.payment;
  const ci = nowIdx();
  const rows=(d.sched||[]).filter(r=>dueIdx(rowDue(d,r.k))===ci);
  if(rows.length) return rows.reduce((s,r)=>s+(strict?rowRemaining(r):r.a),0);
  return strict ? 0 : d.payment;
}
function remainingOf(d){
  if(isCustom(d)){
    const u=unpaidRows(d); const last=u[u.length-1];
    const months = last ? Math.max(u.length, dueIdx(rowDue(d,last.k))-nowIdx()+1) : 0;
    const cost = d.principal>0 ? Math.max(0, d.balance - d.principal) : 0;
    return {rows:u.map(r=>({k:r.k,pay:r.a})), totalInterest:cost, months:Math.max(0,months), custom:true};
  }
  return schedule(d.balance, mr(d), d.payment);
}
function statusOf(d, ref=today()){
  const key = monthKey(ref);
  if(isCustom(d)){
    const u=unpaidRows(d), first=u[0];
    const hasThis=(d.sched||[]).some(r=>dueIdx(rowDue(d,r.k))===dueIdx(ref));
    if(first){
      const due=rowDue(d,first.k);
      const amt=u.filter(r=>r.k===first.k).reduce((s,r)=>s+r.a,0);
      if(dueIdx(due)<=dueIdx(ref)) return {paid:false, due, days:Math.round((due-ref)/86400000), amt};
      return {paid:true, none:!hasThis, due, days:null, amt};
    }
    return {paid:true, none:true, due:ref, days:null, amt:0};
  }
  const paid = d.paid && d.paid[key];
  if(paid){ const nm = addMonths(ref,1); return {paid:true, due: dueOn(d,nm.getFullYear(), nm.getMonth()), days:null}; }
  const due = dueOn(d,ref.getFullYear(), ref.getMonth());
  const days = Math.round((due - ref)/86400000);
  return {paid:false, due, days};
}
function totals(){
  const a = active();
  const monthly = a.reduce((s,d)=>s+monthlyOf(d,true),0);
  const typical = a.reduce((s,d)=>s+monthlyOf(d),0);
  const balance = a.reduce((s,d)=>s+d.balance,0);
  let interest=0, maxMonths=0, unknownCost=false;
  a.forEach(d=>{ const r=remainingOf(d); interest+=r.totalInterest; maxMonths=Math.max(maxMonths,r.months); if(isCustom(d) && !(d.principal>0)) unknownCost=true; });
  const original = S.debts.reduce((s,d)=>s+(d.original||d.balance),0);
  return {monthly, typical, balance, interest, maxMonths, original, unknownCost, dti: S.income? monthly/S.income : null};
}
function dtiBand(x){
  if(x==null) return {c:'neutral', t:'Chưa nhập lương'};
  if(x<0.3) return {c:'good', t:'An toàn'};
  if(x<0.4) return {c:'warn', t:'Cần chú ý'};
  if(x<0.5) return {c:'warn', t:'Khá căng'};
  return {c:'bad', t:'Rủi ro cao'};
}
function projection(n){
  const now=today(); const base=nowIdx();
  const out=Array.from({length:n},(_,i)=>({date:addMonths(now,i), total:0, items:[]}));
  active().forEach(d=>{
    if(isCustom(d)){
      unpaidRows(d).forEach(r=>{ const off=Math.max(0, dueIdx(rowDue(d,r.k))-base); if(off<n){ out[off].total+=r.a; out[off].items.push({n:d.name,a:r.a}); } });
    } else {
      const rows=remainingOf(d).rows; const start=statusOf(d).paid?1:0;
      rows.forEach((x,i)=>{ const off=start+i; if(off<n){ out[off].total+=x.pay; out[off].items.push({n:d.name,a:x.pay}); } });
    }
  });
  return out;
}

const recvs = () => (S.recv = S.recv || []);
const parseISO = s => {
  const m=/^(\d{4})-(\d{2})-(\d{2})$/.exec(s||'');
  if(!m) return null;
  const d=new Date(0); d.setHours(0,0,0,0); d.setFullYear(+m[1],+m[2]-1,+m[3]);
  return dateKey(d)===s ? d : null;
};
const fmtD = d => d.getDate()+'/'+(d.getMonth()+1)+'/'+d.getFullYear();
function recvInfo(r){
  const out=Math.max(0,(r.amount||0)-(r.got||0)); const info={out,next:null,nextAmt:0,late:0,lateSince:null,lateDays:0};
  if(out<=0) return info; const t=today(), got=r.got||0;
  if(r.kind==='plan' && r.per>0 && r.startK){
    const day=r.day||1, k=kToDate(r.startK); let cumDue=0;
    for(let m=0;m<600;m++){
      const dt=dueDate(k.getFullYear(),k.getMonth()+m,day); const cum=Math.min(r.amount,(m+1)*r.per);
      if(dt<t){ cumDue=cum; if(!info.lateSince && cum>got) info.lateSince=dt; }
      else { info.next=dt; break; }
      if(cum>=r.amount) break;
    }
    info.late=Math.max(0,cumDue-got); if(info.late<=0) info.lateSince=null;
    info.nextAmt = info.late>0 ? info.late : Math.min(r.per,out);
  } else {
    const dd=parseISO(r.due);
    if(dd){ if(dd<t){ info.late=out; info.lateSince=dd; } else { info.next=dd; } info.nextAmt=out; }
  }
  if(info.lateSince) info.lateDays=Math.round((t-info.lateSince)/86400000);
  return info;
}
function recvArray(r,n){
  const out=Array(n).fill(0); const i=recvInfo(r); if(i.out<=0) return out; const base=nowIdx(); let rem=i.out;
  if(i.late>0){ const a=Math.min(i.late,rem); out[0]+=a; rem-=a; }
  if(rem<=0) return out;
  if(r.kind==='plan' && r.per>0 && r.startK){
    const day=r.day||1, k=kToDate(r.startK), t=today();
    for(let m=0;m<600 && rem>0;m++){
      const dt=dueDate(k.getFullYear(),k.getMonth()+m,day); if(dt<t) continue;
      const off=dueIdx(dt)-base; if(off>=n) break; const a=Math.min(r.per,rem); out[off]+=a; rem-=a;
    }
  } else if(i.next){ const off=Math.max(0,dueIdx(i.next)-base); if(off<n) out[off]+=rem; }
  return out;
}
function ensurePlan(){
  const P = S.plan = S.plan || {};
  P.cash = P.cash || []; P.loans = P.loans || []; P.buys = P.buys || [];
  P.living = P.living || 0; P.buffer = P.buffer || 0; P.incomePending = !!P.incomePending;
  return P;
}
function payArray(d,n){
  const out=Array(n).fill(0); const base=nowIdx();
  if(isCustom(d)){ unpaidRows(d).forEach(r=>{ const off=Math.max(0, dueIdx(rowDue(d,r.k))-base); if(off<n) out[off]+=r.a; }); }
  else { const rows=remainingOf(d).rows; const start=statusOf(d).paid?1:0; rows.forEach((x,i)=>{ const off=start+i; if(off<n) out[off]+=x.pay; }); }
  return out;
}
function payoffAtOffset(d,o){ // ước tính số cần để tất toán vào tháng thứ o (0 = tháng này)
  if(isCustom(d)){
    const base=nowIdx(); let before=0;
    unpaidRows(d).forEach(r=>{ const off=Math.max(0, dueIdx(rowDue(d,r.k))-base); if(off<o) before+=r.a; });
    const rem=Math.max(0,d.balance-before);
    return d.principal>0 ? Math.round(d.principal*rem/Math.max(1,d.balance)) : rem;
  }
  const rows=remainingOf(d).rows; const start=statusOf(d).paid?1:0; const n=Math.max(0,o-start);
  if(n===0) return d.balance; return rows[n-1] ? rows[n-1].bal : 0;
}
function planSim(n){
  const P=ensurePlan(); const base=nowIdx(); const now=today();
  const cash0=P.cash.reduce((s,c)=>s+(c.a||0),0);
  const months=Array.from({length:n},(_,j)=>({date:addMonths(now,j), inn:0, out:0, ev:[], debt:0, bal:0}));
  const idxOf = k => Math.max(0, monthIdx(k)-base);
  const debts=active(); const po={};
  P.loans.forEach(l=>{ if(!(l.amount>0)) return; const o=idxOf(l.k); (l.payoff||[]).forEach(id=>{ if(!(id in po) || o<po[id].o) po[id]={o,l}; }); });
  months.forEach((m,j)=>{ if(S.income && (j>0 || P.incomePending)){ m.inn+=S.income; m.ev.push({s:1,t:'Lương',a:S.income}); } });
  if(P.living>0){ const dim=daysIn(now.getFullYear(),now.getMonth());
    months.forEach((m,j)=>{ const frac=j===0?(dim-now.getDate()+1)/dim:1; const a=Math.round(P.living*frac); if(a>0){ m.out+=a; m.ev.push({s:-1,t:'Sinh hoạt',a}); } }); }
  debts.forEach(d=>{ const arr=payArray(d,n); arr.forEach((a,j)=>{ if(!a) return; if(po[d.id] && j>=po[d.id].o) return; months[j].out+=a; months[j].debt+=a; months[j].ev.push({s:-1,t:'Trả '+d.name,a}); }); });
  Object.keys(po).forEach(id=>{ const d=S.debts.find(x=>x.id===id); if(!d || !(d.balance>0)) return; const o=po[id].o; if(o>=n) return;
    const bal=payoffAtOffset(d,o), fee=bal*(d.prepay||0)/100;
    months[o].out+=bal+fee; months[o].ev.push({s:-1,t:'Tất toán '+d.name+(fee>0?' (gồm phí '+fmtM(fee)+')':''),a:bal+fee}); });
  P.loans.forEach(l=>{ if(!(l.amount>0)) return; const o=idxOf(l.k); const nm=l.months||1; const A=Math.round(pmt(l.amount,(l.rate||0)/1200,nm));
    if(o<n){ const net=l.amount-(l.fee||0); months[o].inn+=net; months[o].ev.push({s:1,t:'Nhận vay '+(l.name||'')+(l.fee>0?' (đã trừ phí '+fmtM(l.fee)+')':''),a:net}); }
    for(let j=o+1;j<=o+nm && j<n;j++){ months[j].out+=A; months[j].debt+=A; months[j].ev.push({s:-1,t:'Trả '+(l.name||'khoản vay mới'),a:A}); } });
  P.buys.forEach(b=>{ if(!(b.a>0)) return; const o=idxOf(b.k); if(o<n){ months[o].out+=b.a; months[o].ev.push({s:-1,t:'Mua '+(b.name||'…'),a:b.a}); } });
  let recvTotal=0;
  recvs().forEach(r=>{ if(r.inc===false) return; const arr=recvArray(r,n); arr.forEach((a,j)=>{ if(a>0){ months[j].inn+=a; recvTotal+=a; months[j].ev.push({s:1,t:'Thu từ '+(r.name||'…'),a}); } }); });
  let bal=cash0; months.forEach(m=>{ bal+=m.inn-m.out; m.bal=bal; });
  return {cash0, months, po, recvTotal};
}
