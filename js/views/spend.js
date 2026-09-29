/* Giao diện thu chi và báo cáo dùng các thành phần có sẵn. */
let spendMonth=monthKey(today());
const walletName = id => (S.wallets.find(w=>w.id===id)||{}).name||'Ví không tồn tại';
function spendStats(k){
  const s=spendSummary(k);
  return `<div class="grid">${[['Thu',s.income],['Chi tiêu (gồm lãi/phí ngoài lịch)',s.expense],['Tiền trả nợ',s.repayment],['Dòng tiền ròng',s.net]].map(([label,value])=>`<div class="stat"><div class="k">${label}</div><div class="v ${value<0?'neg':''}">${fmtM(value)}</div></div>`).join('')}</div>`;
}
function renderSpend(){
  const rows=monthTransactions(spendMonth);
  $('#v-spend').innerHTML=`<h2>Chi tiêu hằng ngày</h2><p class="small muted">Lịch nợ theo tháng có thể thanh toán từ tài khoản tại mục Khoản nợ. Xoá giao dịch trả nợ tại đây sẽ hoàn tác cả số dư và kỳ nợ. Khoản vay công thức, Kế hoạch và Phải thu vẫn độc lập. Số dư ví tính đến hôm nay.</p>
    <div class="daily-intro"><h3>Bắt đầu từ số dư đang có</h3><p>Nhập số dư tài khoản trước khoản chi đầu tiên. Nếu số dư đã gồm chi tiêu hôm nay, bắt đầu ghi từ ngày tiếp theo; nhập ngày bắt đầu khi ngày đó tới. Không cần nhập lại lịch sử.</p><p class="small">Thẻ ghi nợ dùng chung tài khoản ngân hàng. Mua tín dụng: chọn khoản nợ trong Ghi chi cuối ngày. Chỉ ghi khoản mua mới chưa nằm trong lịch hiện có.</p></div>
    <div class="btns"><button class="btn primary" data-act="daily-add">Ghi chi cuối ngày</button><button class="btn" data-act="tx-add">Thu / chi / chuyển tiền</button><button class="btn" data-act="wallet-add">Thêm tài khoản</button><button class="btn" data-act="budget-edit">Ngân sách tháng</button><button class="btn" data-act="csv-export">Xuất CSV tháng</button></div>
    <label class="f spend-filter">Tháng xem<input type="month" id="spend-month" value="${spendMonth}"></label>${spendStats(spendMonth)}
    <h2>Ví</h2><div class="grid">${S.wallets.map(w=>`<div class="stat"><div class="k">${esc(w.name)}</div><div class="v ${walletBalance(w.id)<0?'neg':''}">${fmtM(walletBalance(w.id))}</div><div class="btns"><button class="btn sm" data-act="wallet-edit" data-id="${esc(w.id)}">Sửa ví</button><button class="btn sm ghost danger" data-act="wallet-delete" data-id="${esc(w.id)}">Xoá ví</button></div></div>`).join('')}</div>
    <h2>Giao dịch (${rows.length})</h2><div class="panel">${rows.length?`<div class="tbl"><table><thead><tr><th>Ngày / ghi chú</th><th>Loại / ví</th><th>Số tiền</th><th>Thao tác</th></tr></thead><tbody>${rows.map(t=>`<tr><td class="spend-note">${esc(t.date)}<br>${esc(t.note||t.category)}</td><td>${TX_TYPES[t.type]}<br>${esc(t.type==='credit'?(S.debts.find(d=>d.id===t.debt)||{}).name||'Khoản nợ không tồn tại':walletName(t.wallet))}${t.to?' → '+esc(walletName(t.to)):''}</td><td>${fmt(t.amount)} đ</td><td><button class="btn sm" data-act="tx-edit" data-id="${esc(t.id)}">Sửa</button> <button class="btn sm ghost danger" data-act="tx-delete" data-id="${esc(t.id)}">Xoá</button></td></tr>`).join('')}</tbody></table></div>`:'<p class="muted">Chưa có giao dịch trong tháng này.</p>'}</div>`;
}
function renderReports(){
  const s=spendSummary(spendMonth), prevKey=monthKey(addMonths(kToDate(spendMonth),-1)), prev=spendSummary(prevKey);
  const forecast=spendForecast(spendMonth), budgets=S.budgets[spendMonth]||{};
  const cats=SPEND_CATS.filter(c=>s.categories[c]||budgets[c]);
  const trend=Array.from({length:6},(_,i)=>{ const k=monthKey(addMonths(kToDate(spendMonth),i-5)); return {k,...spendSummary(k)}; });
  const max=Math.max(1,...trend.map(x=>x.expense));
  $('#v-reports').innerHTML=`<h2>Báo cáo thu chi</h2><label class="f spend-filter">Tháng báo cáo<input type="month" id="report-month" value="${spendMonth}"></label>${spendStats(spendMonth)}
    <div class="panel"><p>Chi ${s.expense>=prev.expense?'tăng':'giảm'} <b>${fmtM(Math.abs(s.expense-prev.expense))}</b> so với toàn bộ tháng ${kLabel(prevKey)}.</p><p class="small muted">So sánh số đã ghi, không suy ra tháng không có dữ liệu là không chi tiêu.${forecast!==null?' Tháng hiện tại chưa kết thúc. Dự báo chi cuối tháng: '+fmtM(forecast)+' (bình quân theo số ngày đã qua, chỉ tham khảo).':''}</p></div>
    <h2>Danh mục và ngân sách</h2><div class="panel">${cats.length?cats.map(c=>{ const amount=s.categories[c]||0, budget=budgets[c]||0, over=budget>0&&amount>budget; return `<div class="report-category"><div><b>${esc(c)}</b><span class="${over?'neg':''}">${fmtM(amount)}${budget?' / '+fmtM(budget):' · chưa đặt ngân sách'}</span></div><div class="bar"><span style="width:${Math.min(100,amount/Math.max(1,budget||s.expense)*100).toFixed(1)}%;background:var(--${over?'bad':'good'})"></span></div>${over?`<p class="small neg">Vượt ${fmtM(amount-budget)}</p>`:''}</div>`; }).join(''):'<p class="muted">Chưa có chi tiêu hoặc ngân sách.</p>'}</div>
    <h2>Xu hướng chi 6 tháng</h2><div class="panel">${trend.map(x=>`<div class="report-category"><div><b>${kLabel(x.k)}</b><span>${fmtM(x.expense)}</span></div><div class="bar"><span style="width:${(x.expense/max*100).toFixed(1)}%"></span></div></div>`).join('')}</div>
    <p class="small muted">Chuyển giữa các ví không tính là thu nhập hay chi tiêu. Báo cáo chỉ dùng giao dịch đã nhập ở tab Chi tiêu, không tự lấy lương dự kiến hay lịch trả nợ.</p>`;
}
function spendDialog(title,body,onSave){
  $('#dlgForm').innerHTML=`<div class="dh">${title}</div><div class="db">${body}<p id="spend-error" class="small neg" role="alert"></p></div><div class="df"><button class="btn ghost" value="cancel" formnovalidate>Huỷ</button><button type="button" id="spend-save" class="btn primary">Lưu</button></div>`;
  $('#spend-save').onclick=()=>{ try{ onSave(); save(); $('#dlg').close(); renderAll(); toast('Đã lưu thay đổi'); }catch(e){ $('#spend-error').textContent=e.message; } };
  $('#dlg').showModal();
}
function transactionDialog(t){
  const v=t||{date:todayStr(),type:'expense',amount:0,wallet:S.wallets[0].id,to:'',category:'Khác',note:''};
  const opts=selected=>S.wallets.map(w=>`<option value="${esc(w.id)}" ${w.id===selected?'selected':''}>${esc(w.name)}</option>`).join('');
  spendDialog(t?'Sửa giao dịch':'Thêm giao dịch',`<div class="form">
    <label class="f">Ngày<input type="date" id="tx-date" max="${todayStr()}" value="${esc(v.date)}"></label>
    <label class="f">Loại<select id="tx-type">${Object.entries(TX_TYPES).filter(([k])=>!['repayment','credit'].includes(k)).map(([k,n])=>`<option value="${k}" ${v.type===k?'selected':''}>${n}</option>`).join('')}</select></label>
    <label class="f">Số tiền (đ)<input class="money" inputmode="numeric" id="tx-amount" value="${v.amount?fmt(v.amount):''}"></label>
    <label class="f">Ví<select id="tx-wallet">${opts(v.wallet)}</select></label>
    <label class="f" id="tx-to-field">Ví nhận<select id="tx-to"><option value="">Chọn ví nhận</option>${opts(v.to)}</select></label>
    <label class="f" id="tx-cat-field">Danh mục<select id="tx-cat">${SPEND_CATS.map(c=>`<option ${c===v.category?'selected':''}>${esc(c)}</option>`).join('')}</select></label>
    <label class="f">Ghi chú<input id="tx-note" maxlength="200" value="${esc(v.note)}"></label></div>`,()=>{
      const item=putTransaction({id:t&&t.id,date:$('#tx-date').value,type:$('#tx-type').value,amount:parseMoney($('#tx-amount').value),wallet:$('#tx-wallet').value,to:$('#tx-to').value,category:$('#tx-cat').value,note:$('#tx-note').value});
      spendMonth=item.date.slice(0,7);
    });
  const fields=()=>{ const transfer=$('#tx-type').value==='transfer'; $('#tx-to-field').hidden=!transfer; $('#tx-cat-field').hidden=transfer; };
  $('#tx-type').onchange=fields; fields();
}
function walletDialog(w){
  spendDialog(w?'Sửa tài khoản':'Thêm tài khoản',`<div class="form"><label class="f">Tên tài khoản<input id="wallet-name" maxlength="80" value="${esc(w?w.name:'')}"></label><label class="f">Loại<select id="wallet-type">${Object.entries(WALLET_TYPES).map(([key,label])=>`<option value="${key}" ${key===(w&&w.type||'cash')?'selected':''}>${label}</option>`).join('')}</select></label><label class="f">Số dư đầu kỳ (đ)<input class="money" inputmode="numeric" id="wallet-opening" value="${w?fmt(w.opening):''}"></label><label class="f">Ngày bắt đầu ghi<input type="date" id="wallet-date" max="${todayStr()}" value="${w?esc(w.openingDate||''):todayStr()}"><span class="hint">Số dư ngay đầu ngày, trước mọi giao dịch ngày này. Tài khoản cũ có thể để trống để giữ lịch sử.</span></label></div><p class="small muted">Số dư đầu kỳ không tính là thu nhập. Sửa số này sẽ điều chỉnh số dư tài khoản; không tự xoá giao dịch cũ.</p>`,()=>{
    putWallet({name:$('#wallet-name').value,opening:parseMoney($('#wallet-opening').value),type:$('#wallet-type').value,openingDate:$('#wallet-date').value},w&&w.id);
  });
}
function dailyDialog(){
  spendDialog('Ghi chi cuối ngày',`<p class="small muted">Chọn ngày thực chi, sau đó nhập từng khoản. Chỉ lưu khi tất cả các dòng hợp lệ. Không nhập lại khoản đã ghi.</p><label class="f">Ngày chi<input type="date" id="daily-date" max="${todayStr()}" value="${todayStr()}"></label><div id="daily-rows"></div><button type="button" class="btn" id="daily-more">+ Thêm khoản chi</button>`,()=>{
    const rows=[...document.querySelectorAll('.daily-row')].map(el=>{ const source=el.querySelector('[data-field="wallet"]').value; return {amount:parseMoney(el.querySelector('[data-field="amount"]').value),wallet:source.startsWith('debt:')?'':source,debt:source.startsWith('debt:')?source.slice(5):'',period:el.querySelector('[data-field="period"]').value,category:el.querySelector('[data-field="category"]').value,note:el.querySelector('[data-field="note"]').value}; });
    putDailyExpenses($('#daily-date').value,rows); spendMonth=$('#daily-date').value.slice(0,7);
  });
  const add=()=>{
    if(document.querySelectorAll('.daily-row').length>=100) return toast('Tối đa 100 dòng mỗi lần.');
    const row=document.createElement('div'); row.className='daily-row';
    row.innerHTML=`<div class="form"><label class="f">Số tiền (đ)<input class="money" inputmode="numeric" data-field="amount"></label><label class="f">Nguồn thanh toán<select data-field="wallet"><optgroup label="Trừ tài khoản">${S.wallets.map(w=>`<option value="${esc(w.id)}">${esc(w.name)}</option>`).join('')}</optgroup><optgroup label="Ghi thêm nợ, không trừ tiền">${S.debts.filter(isCustom).map(d=>`<option value="debt:${esc(d.id)}">${esc(d.name)}</option>`).join('')}</optgroup></select></label><label class="f" data-credit-period hidden>Kỳ sao kê / tháng trả<input type="month" data-field="period"><span class="hint">Để trống: tự chọn theo ngày mua và ngày chốt; ngày chốt thuộc kỳ hiện tại. Có sao kê: chọn tháng sao kê, không phải tháng đến hạn.</span></label><label class="f">Danh mục<select data-field="category">${SPEND_CATS.filter(c=>c!=='Lương'&&c!=='Trả nợ').map(c=>`<option>${esc(c)}</option>`).join('')}</select></label><label class="f">Ghi chú<input maxlength="200" data-field="note"></label></div><button type="button" class="btn sm ghost danger">Bỏ dòng</button>`;
    row.querySelector('[data-field="wallet"]').onchange=e=>{ row.querySelector('[data-credit-period]').hidden=!e.target.value.startsWith('debt:'); };
    row.querySelector('button').onclick=()=>row.remove(); $('#daily-rows').appendChild(row);
  };
  $('#daily-more').onclick=add; add();
}
function budgetDialog(){
  const b=S.budgets[spendMonth]||{};
  spendDialog('Ngân sách tháng '+kLabel(spendMonth),`<p class="small muted">Để trống hoặc nhập 0 để bỏ giới hạn. Ngân sách không tự chuyển sang tháng sau.</p><div class="form">${SPEND_CATS.filter(c=>c!=='Lương').map(c=>`<label class="f">${esc(c)} (đ)<input class="money" inputmode="numeric" data-budget="${esc(c)}" value="${b[c]?fmt(b[c]):''}"></label>`).join('')}</div>`,()=>{
    const out={}; document.querySelectorAll('[data-budget]').forEach(el=>{ const a=parseMoney(el.value); if(!Number.isSafeInteger(a)||a>1e12) throw new Error('Ngân sách quá lớn.'); if(a) out[el.dataset.budget]=a; }); S.budgets[spendMonth]=out;
  });
}
function spendAction(act,b){
  if(!['daily-add','tx-add','tx-edit','tx-delete','wallet-add','wallet-edit','wallet-delete','budget-edit','csv-export','calendar-export'].includes(act)) return false;
  const t=allTransactions().find(t=>t.id===b.dataset.id), w=S.wallets.find(w=>w.id===b.dataset.id);
  if(act==='daily-add') dailyDialog();
  else if(act==='tx-add') transactionDialog();
  else if(act==='tx-edit' && t){ if(['repayment','credit'].includes(t.type)) toast('Giao dịch liên kết: xoá để hoàn tác rồi nhập lại. Khoản mua đã trả cần hoàn tác thanh toán trước.'); else transactionDialog(t); }
  else if(act==='wallet-add') walletDialog();
  else if(act==='wallet-edit' && w) walletDialog(w);
  else if(act==='tx-delete' && t) spendDialog('Xoá giao dịch?',`<p>Xoá giao dịch ${fmt(t.amount)} đ ngày ${esc(t.date)}? Số dư ví sẽ được tính lại.</p>`,()=>removeTransaction(t.id));
  else if(act==='wallet-delete' && w) spendDialog('Xoá ví?',`<p>Xoá ví ${esc(w.name)}? Chỉ xoá được ví chưa có giao dịch.</p>`,()=>removeWallet(w.id));
  else if(act==='budget-edit') budgetDialog();
  else if(act==='csv-export') saveFile('chi-tieu-'+spendMonth+'.csv',transactionsCSV(spendMonth),'text/csv;charset=utf-8');
  else if(act==='calendar-export') saveFile('lich-tra-no-'+todayStr()+'.ics',debtCalendar(),'text/calendar;charset=utf-8');
  return true;
}

function debtPaymentDialog(d){
  const rows=d.sched.map((r,index)=>({r,index})).filter(({r})=>rowRemaining(r)>0);
  if(!rows.length) return toast('Không còn kỳ cần thanh toán.');
  spendDialog('Thanh toán '+esc(d.name),`<p class="small muted">Trừ tài khoản chi và giảm nghĩa vụ kỳ nợ trong cùng một lần lưu. Không ghi lại khoản mua thành chi tiêu. Lãi/phí bên dưới chỉ nhập nếu phát sinh ngoài số tiền trong lịch.</p><div class="form">
    <label class="f">Kỳ trả<select id="dp-row">${rows.map(({r,index})=>`<option value="${index}">${kLabel(r.k)} · còn ${fmt(rowRemaining(r))} đ</option>`).join('')}</select></label>
    <label class="f">Ngày thanh toán<input type="date" id="dp-date" value="${todayStr()}" max="${todayStr()}"></label>
    <label class="f">Tài khoản chi<select id="dp-wallet">${S.wallets.map(w=>`<option value="${esc(w.id)}">${esc(w.name)}</option>`).join('')}</select></label>
    <label class="f">Số thanh toán kỳ (đ)<input class="money" inputmode="numeric" id="dp-principal" value="${fmt(rowRemaining(rows[0].r))}"></label>
    <label class="f">Lãi ngoài lịch (đ)<input class="money" inputmode="numeric" id="dp-interest"></label>
    <label class="f">Phí ngoài lịch (đ)<input class="money" inputmode="numeric" id="dp-fee"></label></div>`,()=>{
      const t=recordDebtPayment({debt:d.id,index:Number($('#dp-row').value),date:$('#dp-date').value,wallet:$('#dp-wallet').value,principal:parseMoney($('#dp-principal').value),interest:parseMoney($('#dp-interest').value),fee:parseMoney($('#dp-fee').value),note:'Thanh toán '+d.name});
      spendMonth=t.date.slice(0,7);
    });
  $('#dp-row').onchange=()=>{ $('#dp-principal').value=fmt(rowRemaining(d.sched[Number($('#dp-row').value)])); };
}