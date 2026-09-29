/* Trạng thái ứng dụng, làm sạch dữ liệu và lưu trữ cục bộ (localStorage). */
const APP_VERSION = '1.3.0';
const LS_KEY = 'so-tra-no:v1';

const blank = () => ({v:1, updatedAt:0, income:0, debts:[], recv:[],
  wallets:[{id:'cash',name:'Tiền mặt',opening:0,type:'cash',openingDate:''}], tx:{}, budgets:{},
  plan:{cash:[],living:0,buffer:0,incomePending:false,loans:[],buys:[]},
  fund:{target:0,saved:0,monthly:0,log:[]},
  calc:{amount:100000000, rate:17.99, months:24, prepay:4, upfront:0, payoffAt:12, consolidate:[]}});

/* ---- Làm sạch dữ liệu đọc từ localStorage hoặc file nhập: ép kiểu, giới hạn độ dài, bỏ trường lạ ---- */
const isMK  = k => /^\d{4}-(0[1-9]|1[0-2])$/.test(String(k));
const isISO = s => typeof s==='string' && !!parseISO(s);
const okId  = v => v!=null && /^[A-Za-z0-9_-]{1,40}$/.test(String(v));
const cn = (v,d=0) => { const n=Number(v); return Number.isFinite(n) ? n : d; };
const cs = (v,max=200) => String(v==null?'':v).slice(0,max);
const cid = v => okId(v) ? String(v) : uid();
const clamp = (n,a,b) => Math.min(b,Math.max(a,n));
const arr = v => Array.isArray(v) ? v : [];
const ids = v => arr(v).map(x=>String(x)).filter(okId);

function cleanDebt(d){
  d = d || {}; const custom = d.mode==='custom';
  const o = {id:cid(d.id), name:cs(d.name,80), kind:cs(d.kind,60), mode:custom?'custom':'formula',
    balance:Math.max(0,cn(d.balance)), original:Math.max(0,cn(d.original)), rate:Math.max(0,cn(d.rate)), payment:Math.max(0,cn(d.payment)),
    months:Math.max(0,Math.round(cn(d.months))), dueDay:clamp(Math.round(cn(d.dueDay,1)),1,31), prepay:Math.max(0,cn(d.prepay)),
    principal:Math.max(0,cn(d.principal)), limit:Math.max(0,cn(d.limit)), stmtDay:clamp(Math.round(cn(d.stmtDay)),0,31),
    dueMode:d.dueMode==='after'?'after':'day', grace:clamp(Math.round(cn(d.grace)),0,60), rateImplied:!!d.rateImplied, paid:{}};
  if(d.paid && typeof d.paid==='object') Object.keys(d.paid).forEach(k=>{ if(isMK(k)){ const p=d.paid[k]||{}; o.paid[k]={prevBalance:cn(p.prevBalance),prevMonths:Math.round(cn(p.prevMonths)),at:cs(p.at,10)}; } });
  if(custom){
    o.sched = arr(d.sched).filter(r=>r && isMK(r.k)).map(r=>({k:String(r.k), a:Math.max(0,cn(r.a)), p:r.p?cs(r.p,10):0,...(okId(r.id)?{id:String(r.id)}:{}),...(r.settled>0?{settled:Math.min(Math.max(0,cn(r.a)),Math.max(0,cn(r.settled)))}:{})}));
    if(isMK(d.lastPaidK)) o.lastPaidK = String(d.lastPaidK);
    recalc(o);
  }
  return o;
}
function cleanRecv(r){
  r = r || {};
  return {id:cid(r.id), name:cs(r.name,80), amount:Math.max(0,cn(r.amount)), got:Math.max(0,cn(r.got)), kind:r.kind==='plan'?'plan':'once',
    due:isISO(r.due)?String(r.due):'', startK:isMK(r.startK)?String(r.startK):'', day:clamp(Math.round(cn(r.day,1)),1,31),
    per:Math.max(0,cn(r.per)), inc:r.inc!==false, note:cs(r.note,200),
    log:arr(r.log).slice(-40).map(l=>({d:cs(l&&l.d,10), a:Math.max(0,cn(l&&l.a))}))};
}
function cleanPlan(p){
  p = p || {};
  return {
    cash:arr(p.cash).map(c=>({id:cid(c&&c.id), name:cs(c&&c.name,80), a:Math.max(0,cn(c&&c.a))})),
    living:Math.max(0,cn(p.living)), buffer:Math.max(0,cn(p.buffer)), incomePending:!!p.incomePending,
    loans:arr(p.loans).map(l=>{ l=l||{}; return {id:cid(l.id), name:cs(l.name,80), amount:Math.max(0,cn(l.amount)), rate:Math.max(0,cn(l.rate)),
      months:clamp(Math.round(cn(l.months)),0,120), k:isMK(l.k)?String(l.k):monthKey(addMonths(today(),1)), fee:Math.max(0,cn(l.fee)), payoff:ids(l.payoff)}; }),
    buys:arr(p.buys).map(b=>{ b=b||{}; return {id:cid(b.id), name:cs(b.name,80), a:Math.max(0,cn(b.a)), k:isMK(b.k)?String(b.k):monthKey(today())}; })
  };
}
function sanitizeState(raw){
  raw = (raw && typeof raw==='object') ? raw : {};
  const f = raw.fund || {}, c = raw.calc || {}, base = blank().calc;
  return {v:1, updatedAt:Math.max(0,cn(raw.updatedAt)), income:Math.max(0,cn(raw.income)),
    debts:arr(raw.debts).map(cleanDebt), recv:arr(raw.recv).map(cleanRecv), plan:cleanPlan(raw.plan),
    ...cleanSpend(raw),
    fund:{target:Math.max(0,cn(f.target)), saved:Math.max(0,cn(f.saved)), monthly:Math.max(0,cn(f.monthly)),
      log:arr(f.log).slice(-60).map(x=>({d:cs(x&&x.d,20), a:cn(x&&x.a)}))},
    calc:{amount:Math.max(0,cn(c.amount,base.amount)), rate:Math.max(0,cn(c.rate,base.rate)), months:clamp(Math.round(cn(c.months,base.months)),1,360),
      prepay:Math.max(0,cn(c.prepay,base.prepay)), upfront:Math.max(0,cn(c.upfront)), payoffAt:Math.max(1,Math.round(cn(c.payoffAt,base.payoffAt))), consolidate:ids(c.consolidate)}};
}

let S = blank();
let stateLoadError = false, unreadState = null;
try{ unreadState = localStorage.getItem(LS_KEY); if(unreadState) S = sanitizeState(JSON.parse(unreadState)); }
catch(e){ stateLoadError = true; }

function setSync(kind, text){ const el=$('#sync'); if(!el) return; el.className='sync '+kind; const sp=el.querySelector('span'); if(sp) sp.textContent=text; }
function save(){
  if(stateLoadError){ toast('Dữ liệu cũ chưa đọc được. Đã chặn lưu để tránh ghi đè.'); return; }
  S.updatedAt = Date.now();
  try{ localStorage.setItem(LS_KEY, JSON.stringify(S)); }catch(e){ toast('Không lưu được vào trình duyệt (bộ nhớ đầy hoặc bị chặn).'); }
  if(typeof cloudSave==='function') cloudSave();
}
function exportPayload(){ return {app:'so-tra-no', version:APP_VERSION, exportedAt:new Date().toISOString(), data:S}; }
