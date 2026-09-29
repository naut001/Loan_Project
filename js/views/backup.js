/* Sao lưu, khôi phục và xoá dữ liệu. */
function backupPanel(){
  const inCloud = typeof cloud!=='undefined' && cloud.ref;
  return `<h2>Dữ liệu và sao lưu</h2><div class="panel">
    <p class="small muted">${inCloud?'Dữ liệu được lưu trong tài khoản của bạn và bộ nhớ trình duyệt.':'Dữ liệu chỉ lưu trong trình duyệt này và không gửi đi đâu.'} Nên xuất file sao lưu thỉnh thoảng, và trước khi xoá dữ liệu trình duyệt hoặc đổi máy.</p>
    <div class="btns"><button class="btn" data-act="backup-export">Xuất sao lưu</button><button class="btn" data-act="backup-import">Nhập từ sao lưu</button><button class="btn ghost danger" data-act="backup-reset">Xoá toàn bộ dữ liệu</button></div></div>
    <p class="small muted" style="margin-top:16px">Sổ trả nợ v${APP_VERSION}. Công cụ tính toán tham khảo, không phải tư vấn tài chính.</p>`;
}
async function saveFile(name, text, mime){
  try{
    if(window.claude && window.claude.use){ const dl = await window.claude.use('downloads'); if(dl){ await dl.save({filename:name, data:text}); return true; } }
  }catch(e){ if(e && e.code==='declined') return false; }
  const blob = new Blob([text], {type: mime||'application/json'});
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(()=>URL.revokeObjectURL(a.href), 1500); return true;
}
function exportText(){ return JSON.stringify(exportPayload(), null, 2); }
function exportDialog(){
  const n = S.debts.length, r = S.recv.length;
  $('#dlgForm').innerHTML = `<div class="dh">Xuất sao lưu</div><div class="db">
    <p class="small muted">File gồm ${n} khoản nợ, ${r} khoản phải thu, kế hoạch tiền và quỹ dự phòng. Giữ file ở nơi an toàn vì nó chứa số liệu tài chính của bạn.</p>
    <div class="btns"><button type="button" class="btn primary" data-act="backup-download">Tải file .json</button><button type="button" class="btn" data-act="backup-copy">Sao chép nội dung</button></div>
    <label class="f" style="margin-top:12px">Nội dung sao lưu<textarea id="bk-text" rows="6" readonly>${esc(exportText())}</textarea></label></div>
    <div class="df"><button class="btn" value="close">Đóng</button></div>`;
  $('#dlg').showModal();
}
function importDialog(){
  $('#dlgForm').innerHTML = `<div class="dh">Nhập từ sao lưu</div><div class="db">
    <p class="small muted">Chọn file .json đã xuất trước đó, hoặc dán nội dung vào ô bên dưới. <b>Dữ liệu hiện tại sẽ bị thay thế.</b></p>
    <label class="f">File sao lưu<input type="file" id="bk-file" accept=".json,application/json"></label>
    <label class="f" style="margin-top:10px">Hoặc dán nội dung<textarea id="bk-text" rows="6" placeholder="{ &quot;app&quot;: &quot;so-tra-no&quot;, ... }"></textarea></label>
    <p class="small" id="bk-err" style="color:var(--bad)"></p></div>
    <div class="df"><button class="btn ghost" value="cancel" formnovalidate>Huỷ</button><button type="button" class="btn primary" data-act="backup-import-ok">Nhập dữ liệu</button></div>`;
  $('#dlg').showModal();
}
function resetDialog(){
  $('#dlgForm').innerHTML = `<div class="dh">Xoá toàn bộ dữ liệu?</div><div class="db"><p>Toàn bộ khoản nợ, phải thu, kế hoạch và quỹ dự phòng trong trình duyệt này sẽ bị xoá và không khôi phục được. Hãy xuất sao lưu trước nếu cần.</p></div>
    <div class="df"><button class="btn ghost" value="cancel" formnovalidate>Huỷ</button><button class="btn danger" data-act="backup-reset-ok" value="del">Xoá tất cả</button></div>`;
  $('#dlg').showModal();
}
function parseBackup(text){
  let j; try{ j = JSON.parse(text); }catch(e){ throw new Error('Nội dung không phải JSON hợp lệ.'); }
  const raw = (j && j.data && typeof j.data==='object') ? j.data : j;
  if(!raw || typeof raw!=='object' || !(Array.isArray(raw.debts) || Array.isArray(raw.recv) || raw.plan || raw.fund)) throw new Error('File không đúng định dạng của Sổ trả nợ.');
  return sanitizeState(raw);
}
function backupAction(act, b){
  if(act==='backup-export'){ exportDialog(); return true; }
  if(act==='backup-import'){ importDialog(); return true; }
  if(act==='backup-reset'){ resetDialog(); return true; }
  if(act==='backup-download'){ const d=new Date().toISOString().slice(0,10); saveFile('so-tra-no-'+d+'.json', exportText()).then(ok=>{ if(ok) toast('Đã tạo file sao lưu'); }); return true; }
  if(act==='backup-copy'){
    const ta=$('#bk-text'); if(ta){ ta.focus(); ta.select(); }
    (navigator.clipboard && navigator.clipboard.writeText ? navigator.clipboard.writeText(exportText()) : Promise.reject()).then(()=>toast('Đã sao chép'), ()=>toast('Hãy bấm Ctrl+C (hoặc giữ và chọn Sao chép)'));
    return true;
  }
  if(act==='backup-import-ok'){
    const ta=$('#bk-text'), err=$('#bk-err');
    try{ S = parseBackup(ta ? ta.value : ''); S.updatedAt = Date.now(); save(); renderAll(); $('#dlg').close(); toast('Đã nhập dữ liệu'); }
    catch(e){ if(err) err.textContent = e.message; }
    return true;
  }
  if(act==='backup-reset-ok'){ S = blank(); save(); renderAll(); toast('Đã xoá dữ liệu'); return true; }
  return false;
}
