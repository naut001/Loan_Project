/* Xuất dữ liệu thuần văn bản; không gửi dữ liệu ra máy chủ. */
function csvCell(value){
  let s=String(value??'');
  if(/^[\s]*[=+@-]/.test(s) || /^[\t\r\n]/.test(s)) s="'"+s;
  return '"'+s.replace(/"/g,'""')+'"';
}
function transactionsCSV(k, state=S){
  const name=id=>(state.wallets.find(w=>w.id===id)||{}).name||id;
  const rows=[['Ngày','Loại','Số tiền (đ)','Ví','Ví nhận','Danh mục','Ghi chú','Khoản nợ','Mã kỳ','Lãi ngoài lịch','Phí ngoài lịch']];
  monthTransactions(k,state).forEach(t=>rows.push([t.date,TX_TYPES[t.type],t.amount,t.wallet?name(t.wallet):'',t.to?name(t.to):'',t.type==='transfer'?'':t.category,t.note,t.debt||'',t.row||'',t.interest||0,t.fee||0]));
  return '\uFEFF'+rows.map(r=>r.map(csvCell).join(',')).join('\r\n')+'\r\n';
}
const icsText = s => String(s).replace(/\\/g,'\\\\').replace(/\r\n|\r|\n/g,'\\n').replace(/;/g,'\\;').replace(/,/g,'\\,');
function foldICS(line){
  let out='', part='', bytes=0;
  for(const ch of line){
    const n=unescape(encodeURIComponent(ch)).length;
    if(bytes+n>75){ out+=part+'\r\n'; part=' '; bytes=1; }
    part+=ch; bytes+=n;
  }
  return out+part;
}
function debtCalendar(state=S){
  const lines=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//SoTraNo//Debt reminders//VI','CALSCALE:GREGORIAN'];
  const stamp=new Date().toISOString().replace(/[-:]/g,'').replace(/\.\d{3}Z$/,'Z');
  const first=monthIdx(monthKey(today())), last=first+12;
  state.debts.filter(d=>d.balance>0).forEach(d=>{
    let rows=[];
    if(isCustom(d)){
      const groups=new Map(); unpaidRows(d).forEach(r=>groups.set(r.k,(groups.get(r.k)||0)+r.a));
      rows=[...groups].map(([k,amount])=>({date:rowDue(d,k),amount,key:k}));
    } else {
      const start=statusOf(d).paid?1:0;
      rows=remainingOf(d).rows.slice(0,12-start).map((r,i)=>{ const m=addMonths(today(),start+i); return {date:dueOn(d,m.getFullYear(),m.getMonth()),amount:r.pay,key:monthKey(m)}; });
    }
    rows.filter(r=>dueIdx(r.date)<last).forEach(r=>{
      const next=new Date(r.date); next.setDate(next.getDate()+1);
      lines.push('BEGIN:VEVENT','UID:'+d.id+'-'+r.key+'@so-tra-no','DTSTAMP:'+stamp,
        'DTSTART;VALUE=DATE:'+dateKey(r.date).replace(/-/g,''),'DTEND;VALUE=DATE:'+dateKey(next).replace(/-/g,''),
        'SUMMARY:'+icsText('Trả '+d.name), 'DESCRIPTION:'+icsText('Dự kiến '+fmt(r.amount)+' đ. Kiểm tra số tiền và hạn chính thức trên sao kê. Lịch xuất không tự cập nhật.'),
        'BEGIN:VALARM','TRIGGER:-P1D','ACTION:DISPLAY','DESCRIPTION:'+icsText('Nhắc trả '+d.name),'END:VALARM','END:VEVENT');
    });
  });
  lines.push('END:VCALENDAR'); return lines.map(foldICS).join('\r\n')+'\r\n';
}