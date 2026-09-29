/* Tiện ích chung: định dạng số, ngày tháng, chuỗi. Không phụ thuộc trạng thái ứng dụng. */
/* ---------- helpers ---------- */
const $ = s => document.querySelector(s);
const fmt = n => (Math.round(n)||0).toLocaleString('vi-VN');
const fmtM = n => { const v = Math.round(n)||0; return Math.abs(v) >= 1e6 ? (v/1e6).toLocaleString('vi-VN',{maximumFractionDigits:2}) + ' triệu' : fmt(v) + ' đ'; };
const pct = (n,d=1) => (n||0).toLocaleString('vi-VN',{maximumFractionDigits:d}) + '%';
const esc = s => String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const parseMoney = s => { const v = parseInt(String(s??'').replace(/[^\d]/g,''),10); return isNaN(v)?0:v; };
const parseNum = s => { const v = parseFloat(String(s??'').replace(/\s/g,'').replace(',','.')); return isNaN(v)?0:v; };
const uid = () => Math.random().toString(36).slice(2,10);
const monthKey = d => d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0');
const today = () => { const d = globalThis.__TODAY__ ? new Date(globalThis.__TODAY__) : new Date(); d.setHours(0,0,0,0); return d; };
const daysIn = (y,m) => new Date(y,m+1,0).getDate();
const dueDate = (y,m,day) => new Date(y,m,Math.min(day,daysIn(y,m)));
const addMonths = (d,n) => new Date(d.getFullYear(), d.getMonth()+n, 1);
const monthLabel = d => 'tháng ' + (d.getMonth()+1) + '/' + d.getFullYear();
function toast(msg){ const t=$('#toast'); t.textContent=msg; t.classList.add('on'); clearTimeout(toast._t); toast._t=setTimeout(()=>t.classList.remove('on'),2200); }

const dateKey = d => monthKey(d) + '-' + String(d.getDate()).padStart(2,'0');
const todayStr = () => dateKey(today());
function monthOptions(sel){
  const base = addMonths(today(), -3); let h=''; let found=false;
  for(let i=0;i<42;i++){ const m=addMonths(base,i); const k=monthKey(m); if(k===sel) found=true; h+=`<option value="${k}" ${k===sel?'selected':''}>${m.getMonth()+1}/${m.getFullYear()}</option>`; }
  if(sel && !found) h = `<option value="${sel}" selected>${kLabel(sel)}</option>` + h;
  return h;
}
const mm = n => { const v=(n||0)/1e6; const t=Math.abs(v).toLocaleString('vi-VN',{minimumFractionDigits:2,maximumFractionDigits:2}); return (v<0?'-':'')+t; };
