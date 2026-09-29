/* Sổ thu chi độc lập với kế hoạch và khoản nợ: không tự ghi hai lần một khoản tiền. */
const SPEND_CATS = ['Ăn uống','Đi lại','Nhà ở','Mua sắm','Sức khoẻ','Học tập','Giải trí','Trả nợ','Lương','Khác'];
const TX_TYPES = {expense:'Chi',income:'Thu',transfer:'Chuyển ví',repayment:'Trả nợ liên kết',credit:'Mua bằng tín dụng'};
const WALLET_TYPES = {cash:'Tiền mặt',bank:'Ngân hàng / thẻ ghi nợ',ewallet:'Ví điện tử'};
const spendAmount = v => Math.min(1e12,Math.max(0,Math.round(cn(v))));

function cleanSpend(raw){
  const seenWallets=new Set();
  const wallets=arr(raw.wallets).filter(w=>w && typeof w==='object').map(w=>({id:cid(w.id),name:cs(w.name,80).trim()||'Ví',opening:spendAmount(w.opening),type:Object.hasOwn(WALLET_TYPES,w.type)?w.type:'cash',openingDate:isISO(w.openingDate)?w.openingDate:''}))
    .filter(w=>{ if(seenWallets.has(w.id)) return false; seenWallets.add(w.id); return true; });
  if(!wallets.length) wallets.push({id:'cash',name:'Tiền mặt',opening:0,type:'cash',openingDate:''});
  const walletIds=new Set(wallets.map(w=>w.id)), tx={}, seenTx=new Set();
  const source=raw.tx && typeof raw.tx==='object' ? raw.tx : {};
  Object.keys(source).filter(isMK).sort().forEach(k=>{
    arr(source[k]).forEach(t=>{
      if(!t || !isISO(t.date) || t.date.slice(0,7)!==k || !Object.hasOwn(TX_TYPES,t.type)) return;
      const amount=spendAmount(t.amount); if(!amount) return;
      const id=cid(t.id); if(seenTx.has(id)) return;
      // Không chuyển giao dịch mất tham chiếu sang ví khác: giữ ví phục hồi để tránh sai số dư.
      const wallet=t.type==='credit'?'':okId(t.wallet)?String(t.wallet):wallets[0].id;
      const to=t.type==='transfer' && okId(t.to)?String(t.to):'';
      if(t.type==='transfer' && (!to || to===wallet)) return;
      [wallet,to].filter(Boolean).forEach(w=>{ if(!walletIds.has(w)){ wallets.push({id:w,name:'Ví phục hồi',opening:0,type:'cash',openingDate:''}); walletIds.add(w); } });
      seenTx.add(id);
      (tx[k]||(tx[k]=[])).push({id,date:t.date,type:t.type,amount,wallet,to,
        category:SPEND_CATS.includes(t.category)?t.category:'Khác',note:cs(t.note,200),...(['repayment','credit'].includes(t.type)?{debt:cs(t.debt,40),row:cs(t.row,40),interest:spendAmount(t.interest),fee:spendAmount(t.fee)}:{})});
    });
  });
  const budgets={};
  Object.keys(raw.budgets||{}).filter(isMK).forEach(k=>{
    const b=raw.budgets[k]; if(!b || typeof b!=='object') return;
    const out={}; SPEND_CATS.forEach(cat=>{ const a=spendAmount(b[cat]); if(a) out[cat]=a; });
    if(Object.keys(out).length) budgets[k]=out;
  });
  return {wallets,tx,budgets};
}
function monthTransactions(k, state=S){
  return (state.tx[k]||[]).slice().sort((a,b)=>b.date.localeCompare(a.date)||a.id.localeCompare(b.id));
}
function allTransactions(state=S){ return Object.values(state.tx).flat(); }
function walletBalance(id, state=S, through=todayStr()){
  const w=state.wallets.find(w=>w.id===id); if(!w) return 0;
  return allTransactions(state).filter(t=>t.date<=through).reduce((s,t)=>s+
    (t.wallet===id?(t.type==='income'?t.amount:-t.amount):0)+(t.type==='transfer'&&t.to===id?t.amount:0),w.opening);
}
function spendSummary(k, state=S, through='9999-12-31'){
  const result={income:0,expense:0,net:0,repayment:0,categories:{},count:0};
  monthTransactions(k,state).filter(t=>t.date<=through).forEach(t=>{
    result.count++;
    if(t.type==='transfer') return;
    if(t.type==='repayment'){
      result.repayment+=t.amount;
      const cost=(t.interest||0)+(t.fee||0); result.expense+=cost;
      result.categories['Trả nợ']=(result.categories['Trả nợ']||0)+cost;
      return;
    }
    result[t.type==='credit'?'expense':t.type]+=t.amount;
    if(t.type==='expense'||t.type==='credit') result.categories[t.category]=(result.categories[t.category]||0)+t.amount;
  });
  result.net=result.income-result.expense-result.repayment+monthTransactions(k,state).filter(t=>t.date<=through).reduce((s,t)=>s+(t.type==='credit'?t.amount:t.type==='repayment'?(t.interest||0)+(t.fee||0):0),0); return result;
}
function spendForecast(k, state=S){
  if(k!==monthKey(today())) return null;
  return Math.round(spendSummary(k,state,todayStr()).expense/today().getDate()*daysIn(today().getFullYear(),today().getMonth()));
}
function putTransaction(t, state=S){
  if(['repayment','credit'].includes(t.type) || (t.id && allTransactions(state).some(x=>x.id===t.id&&['repayment','credit'].includes(x.type)))) throw new Error('Giao dịch liên kết: hoàn tác rồi nhập lại nếu cần sửa.');
  if(!isISO(t.date) || t.date>todayStr()) throw new Error('Chọn ngày hợp lệ, không ở tương lai.');
  if(!Object.hasOwn(TX_TYPES,t.type)) throw new Error('Loại giao dịch không hợp lệ.');
  if(!Number.isSafeInteger(t.amount) || t.amount<=0 || t.amount>1e12) throw new Error('Số tiền phải từ 1 đến 1.000.000.000.000 đ.');
  if(!state.wallets.some(w=>w.id===t.wallet)) throw new Error('Chọn ví giao dịch.');
  if(t.type==='transfer' && (t.to===t.wallet || !state.wallets.some(w=>w.id===t.to))) throw new Error('Chọn ví nhận khác ví chuyển.');
  const affected=state.wallets.filter(w=>w.id===t.wallet || (t.type==='transfer' && w.id===t.to));
  if(affected.some(w=>w.openingDate && t.date<w.openingDate)) throw new Error('Ngày giao dịch phải từ ngày số dư đầu kỳ của cả hai tài khoản.');
  const item={id:cid(t.id),date:t.date,type:t.type,amount:t.amount,wallet:t.wallet,to:t.type==='transfer'?t.to:'',
    category:SPEND_CATS.includes(t.category)?t.category:'Khác',note:cs(t.note,200).trim()};
  removeTransaction(item.id,state);
  const k=item.date.slice(0,7); (state.tx[k]||(state.tx[k]=[])).push(item); return item;
}
function removeTransaction(id, state=S){
  const t=allTransactions(state).find(x=>x.id===id);
  if(t && t.type==='credit'){
    const d=state.debts.find(x=>x.id===t.debt), r=d&&(d.sched||[]).find(x=>x.id===t.row);
    if(!r || r.a!==t.amount || r.p || r.settled || allTransactions(state).some(x=>x.type==='repayment'&&x.debt===t.debt&&x.row===t.row)) throw new Error('Hoàn tác thanh toán của khoản mua trước; không xoá liên kết sai hoặc đã trả.');
    d.sched=d.sched.filter(x=>x!==r); recalc(d);
  }
  if(t && t.type==='repayment'){
    const d=state.debts.find(x=>x.id===t.debt), r=d&&(d.sched||[]).find(x=>x.id===t.row);
    if(!r || d.sched.filter(x=>x.id===t.row).length!==1 || t.amount<=(t.interest||0)+(t.fee||0) || (r.settled||0)<t.amount-(t.interest||0)-(t.fee||0)) throw new Error('Liên kết kỳ nợ không hợp lệ. Giữ giao dịch để kiểm tra bản sao lưu.');
    r.settled-=t.amount-(t.interest||0)-(t.fee||0); recalc(d);
  }
  Object.keys(state.tx).forEach(k=>{ state.tx[k]=state.tx[k].filter(t=>t.id!==id); if(!state.tx[k].length) delete state.tx[k]; });
}

function recordDebtPayment(values, state=S){
  const d=state.debts.find(x=>x.id===values.debt);
  if(!d || !isCustom(d)) throw new Error('Chọn khoản nợ có lịch theo tháng.');
  const r=d.sched[values.index];
  if(!r || rowRemaining(r)<=0) throw new Error('Kỳ này không còn số tiền phải trả.');
  const principal=values.principal, interest=values.interest||0, fee=values.fee||0;
  if(![principal,interest,fee].every(x=>Number.isSafeInteger(x)&&x>=0) || principal<=0 || principal>rowRemaining(r)) throw new Error('Số thanh toán kỳ phải lớn hơn 0 và không vượt số còn lại.');
  // Lãi/phí ở đây là khoản ngoài lịch đã nhập; không tính lại phần đã nằm trong kỳ.
  const draft={...state,tx:JSON.parse(JSON.stringify(state.tx))};
  const item=putTransaction({date:values.date,type:'expense',wallet:values.wallet,amount:principal+interest+fee,category:'Trả nợ',note:values.note},draft);
  r.id=r.id||uid();
  Object.assign(item,{type:'repayment',debt:d.id,row:r.id,interest,fee});
  r.settled=(r.settled||0)+principal;
  state.tx=draft.tx; recalc(d); return item;
}
function removeWallet(id, state=S){
  if(state.wallets.length<=1) throw new Error('Cần giữ ít nhất một ví.');
  if(allTransactions(state).some(t=>t.wallet===id || t.to===id)) throw new Error('Ví đã có giao dịch. Hãy chuyển hoặc xoá các giao dịch trước.');
  state.wallets=state.wallets.filter(w=>w.id!==id);
}

// Kiểm tra toàn bộ trên bản nháp trước khi thay trạng thái: một dòng lỗi không lưu nửa chừng.
function putDailyExpenses(date, rows, state=S){
  if(!Array.isArray(rows) || !rows.length || rows.length>100) throw new Error('Nhập từ 1 đến 100 khoản chi.');
  const draft={...state,tx:JSON.parse(JSON.stringify(state.tx)),debts:JSON.parse(JSON.stringify(state.debts))};
  const items=rows.map(r=>r.debt?recordCreditPurchase({...r,date},draft):putTransaction({date,type:'expense',amount:r.amount,wallet:r.wallet,category:r.category,note:r.note},draft));
  state.tx=draft.tx; state.debts=draft.debts;
  return items;
}

function creditPeriod(d,date){
  const dt=kToDate(date.slice(0,7));
  if(d.stmtDay>0 && Number(date.slice(8))>dueDate(dt.getFullYear(),dt.getMonth(),d.stmtDay).getDate()) return monthKey(addMonths(dt,1));
  if(!d.stmtDay && Number(date.slice(8))>(d.dueDay||1)) return monthKey(addMonths(dt,1));
  return monthKey(dt);
}
function convertFormulaDebt(id,state=S){
  const d=state.debts.find(x=>x.id===id);
  if(!d || isCustom(d)) throw new Error('Chọn khoản vay công thức chưa chuyển.');
  const plan=remainingOf(d);
  if(plan.stuck || !plan.rows.length || !Number.isFinite(plan.totalInterest)) throw new Error('Cần lịch trả hợp lệ, số trả phải đủ trả lãi.');
  let start=monthKey(statusOf(d).paid?addMonths(today(),1):today());
  if(d.stmtDay){
    const target=dueIdx(kToDate(start));
    for(let offset=0;offset>=-2;offset--){ const candidate=monthKey(addMonths(kToDate(start),offset)); if(dueIdx(rowDue(d,candidate))===target){ start=candidate; break; } }
  }
  const rows=plan.rows.map((r,i)=>({id:uid(),k:monthKey(addMonths(kToDate(start),i)),a:Math.round(r.pay),p:0}));
  Object.assign(d,{mode:'custom',sched:rows,principal:0,rate:0,rateImplied:false});
  // Giữ paid cũ để tra cứu, không phát sinh giao dịch hay trừ tiền hồi tố.
  recalc(d); return d;
}
function recordCreditPurchase(values,state=S){
  const d=state.debts.find(x=>x.id===values.debt);
  if(!d || !isCustom(d)) throw new Error('Chọn khoản nợ có lịch theo tháng.');
  if(!isISO(values.date)||values.date>todayStr()) throw new Error('Chọn ngày mua hợp lệ, không ở tương lai.');
  if(!Number.isSafeInteger(values.amount)||values.amount<=0||values.amount>1e12) throw new Error('Số tiền mua không hợp lệ.');
  const k=values.period||creditPeriod(d,values.date);
  if(!isMK(k)||k<values.date.slice(0,7)) throw new Error('Kỳ trả không được trước tháng mua.');
  const row={id:uid(),k,a:values.amount,p:0};
  const item={id:uid(),date:values.date,type:'credit',amount:values.amount,wallet:'',to:'',debt:d.id,row:row.id,category:SPEND_CATS.includes(values.category)?values.category:'Khác',note:cs(values.note,200).trim()};
  d.sched.push(row); recalc(d);
  const month=values.date.slice(0,7); (state.tx[month]||(state.tx[month]=[])).push(item);
  return item;
}

// Không cho biểu mẫu làm mất các tham chiếu giao dịch đã lưu.
function validateDebtEdit(d,mode,rows,state=S){
  const links=allTransactions(state).filter(t=>t.debt===d.id);
  if(!links.length) return;
  if(mode!=='custom') throw new Error('Giữ lịch theo tháng khi có giao dịch liên kết.');
  for(const t of links){
    const before=d.sched.find(r=>r.id===t.row), after=rows.find(r=>r.id===t.row);
    if(!before||!after||['k','a','p','settled'].some(key=>(before[key]||0)!==(after[key]||0))) throw new Error('Không sửa hoặc xoá kỳ đã liên kết. Hoàn tác giao dịch của kỳ đó trước; các kỳ khác vẫn sửa được.');
  }
}
function putWallet(values, id, state=S){
  const name=String(values.name||'').trim();
  if(!name || name.length>80) throw new Error('Nhập tên tài khoản, tối đa 80 ký tự.');
  if(!Object.hasOwn(WALLET_TYPES,values.type)) throw new Error('Chọn loại tài khoản.');
  if(!Number.isSafeInteger(values.opening) || values.opening<0 || values.opening>1e12) throw new Error('Số dư đầu kỳ không hợp lệ.');
  const openingDate=values.openingDate||'';
  if(openingDate && (!isISO(openingDate) || openingDate>todayStr())) throw new Error('Chọn ngày bắt đầu hợp lệ, không ở tương lai.');
  if(openingDate && allTransactions(state).some(t=>(t.wallet===id || t.to===id) && t.date<openingDate)) throw new Error('Đã có giao dịch trước ngày này. Không thể dời mốc qua giao dịch cũ.');
  const existing=id && state.wallets.find(w=>w.id===id);
  if(id && !existing) throw new Error('Tài khoản không còn tồn tại.');
  const w={id:existing?id:uid(),name,opening:values.opening,type:values.type,openingDate};
  if(existing) Object.assign(existing,w); else state.wallets.push(w);
  return w;
}