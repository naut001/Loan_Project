/* Màn hình đăng nhập, tạo tài khoản, quên mật khẩu; hộp thoại tài khoản và đổi mật khẩu. */
let loginTab = 'signin', loginEmail = '';
const MIN_PW = 8;

function setAccountBtn(on){ const b = $('#acct-btn'); if (b) b.hidden = !on; }
function showLogin(o){ $('#app-shell').hidden = true; $('#v-login').hidden = false; renderLogin(o); }
function hideLogin(){ $('#v-login').hidden = true; $('#app-shell').hidden = false; }

function renderLogin(o){
  o = o || {}; if (o.tab) loginTab = o.tab;
  const t = loginTab, err = o.err || '', msg = o.msg || '';
  const tabBtn = (k, label) => `<button type="button" role="tab" class="${t === k ? 'on' : ''}" aria-selected="${t === k}" data-ltab="${k}">${label}</button>`;
  const email = `<label class="f">Email<input id="l-email" name="email" type="email" inputmode="email" autocomplete="username" autocapitalize="none" spellcheck="false" value="${esc(loginEmail)}" required></label>`;
  let body;
  if (t === 'reset') {
    body = `<p class="small muted">Nhập email đã đăng ký. Bạn sẽ nhận một liên kết để đặt mật khẩu mới.</p>${email}
      <button class="btn primary block" type="submit" id="l-submit">Gửi email đặt lại mật khẩu</button>
      <button class="btn ghost block" type="button" data-ltab="signin">Quay lại đăng nhập</button>`;
  } else {
    const pwAuto = t === 'signin' ? 'current-password' : 'new-password';
    body = `${email}
      <label class="f">Mật khẩu<input id="l-pw" name="password" type="password" autocomplete="${pwAuto}" ${t === 'signup' ? `minlength="${MIN_PW}" placeholder="Ít nhất ${MIN_PW} ký tự"` : ''} required></label>
      ${t === 'signup' ? `<label class="f">Nhập lại mật khẩu<input id="l-pw2" type="password" autocomplete="new-password" required></label>` : ''}
      <label class="check inline"><input type="checkbox" id="l-show"><span>Hiện mật khẩu</span></label>
      <button class="btn primary block" type="submit" id="l-submit">${t === 'signin' ? 'Đăng nhập' : 'Tạo tài khoản'}</button>
      ${t === 'signin' ? `<button class="btn ghost block" type="button" data-ltab="reset">Quên mật khẩu?</button>` : ''}`;
  }
  $('#v-login').innerHTML = `<div class="login">
    <div class="login-brand">Sổ trả nợ</div>
    <p class="muted small login-sub">Theo dõi nợ, hạn trả và dòng tiền của riêng bạn, đồng bộ giữa các thiết bị.</p>
    ${t !== 'reset' ? `<div class="seg" role="tablist" aria-label="Đăng nhập hoặc tạo tài khoản">${tabBtn('signin', 'Đăng nhập')}${tabBtn('signup', 'Tạo tài khoản')}</div>` : ''}
    <form id="login-form" class="panel login-form" novalidate>${body}
      <p class="small login-err" id="l-err" role="alert">${esc(err)}</p>${msg ? `<p class="small login-ok" role="status">${esc(msg)}</p>` : ''}
    </form>
    <p class="small muted login-note">Dữ liệu được lưu trên Supabase và chỉ tài khoản này đọc được qua ứng dụng. Hãy dùng mật khẩu riêng, không trùng với nơi khác.</p></div>`;
  const first = $(t === 'signin' && loginEmail ? '#l-pw' : '#l-email'); if (first && !o.noFocus) first.focus();
}

async function handleLoginSubmit(){
  const t = loginTab, v = id => ($(id) || {}).value || '';
  const email = v('#l-email').trim(), pw = v('#l-pw'), pw2 = v('#l-pw2'), btn = $('#l-submit');
  loginEmail = email;
  const fail = m => renderLogin({ err: m, noFocus: true });
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return fail('Nhập một địa chỉ email hợp lệ.');
  if (t !== 'reset') {
    if (!pw) return fail('Nhập mật khẩu.');
    if (t === 'signup') {
      if (pw.length < MIN_PW) return fail('Mật khẩu cần ít nhất ' + MIN_PW + ' ký tự.');
      if (!/[A-Za-z]/.test(pw) || !/\d/.test(pw)) return fail('Mật khẩu nên có cả chữ và số.');
      if (pw !== pw2) return fail('Hai mật khẩu nhập vào không khớp.');
    }
  }
  btn.disabled = true; btn.textContent = 'Đang xử lý…';
  try {
    if (t === 'reset') { await authResetPassword(email); return renderLogin({ msg: 'Nếu email này đã đăng ký, một liên kết đặt lại mật khẩu đã được gửi. Hãy kiểm tra cả thư mục Spam.', noFocus: true }); }
    if (t === 'signup') {
      const d = await authSignUp(email, pw);
      if (!d.access_token) return renderLogin({ tab: 'signin', msg: 'Đã tạo tài khoản. Hãy mở email để xác nhận, rồi quay lại đăng nhập.', noFocus: true });
    } else await authSignIn(email, pw);
    loginEmail = ''; await connect();
  } catch (e) { fail(e.message); }
}

document.addEventListener('submit', e => { if (e.target.id === 'login-form') { e.preventDefault(); handleLoginSubmit(); } });
document.addEventListener('click', e => {
  const lt = e.target.closest('[data-ltab]'); if (lt) { loginEmail = ($('#l-email') || {}).value || loginEmail; renderLogin({ tab: lt.dataset.ltab, noFocus: true }); return; }
  const b = e.target.closest('[data-act]'); if (!b) return;
  if (b.dataset.act === 'account') accountDialog();
  else if (b.dataset.act === 'change-pw') changePwDialog();
  else if (b.dataset.act === 'signout') signoutDialog();
  else if (b.dataset.act === 'signout-yes') doSignout();
});
document.addEventListener('change', e => {
  if (e.target.id === 'l-show') { ['#l-pw', '#l-pw2'].forEach(s => { const i = $(s); if (i) i.type = e.target.checked ? 'text' : 'password'; }); }
});

function accountDialog(){
  $('#dlgForm').innerHTML = `<div class="dh">Tài khoản</div><div class="db">
    <p class="small muted">Đang đăng nhập với</p><p><b>${esc(getUserEmail())}</b></p>
    <p class="small muted" style="margin-top:8px">Đăng nhập cùng email trên thiết bị khác để thấy cùng dữ liệu. Nếu hai thiết bị cùng sửa, bản lưu sau cùng sẽ được giữ.</p>
    <div class="btns" style="margin-top:14px"><button type="button" class="btn" data-act="change-pw">Đổi mật khẩu</button><button type="button" class="btn ghost danger" data-act="signout">Đăng xuất</button></div></div>
    <div class="df"><button class="btn" value="close">Đóng</button></div>`;
  $('#dlg').showModal();
}
function signoutDialog(){
  $('#dlgForm').innerHTML = `<div class="dh">Đăng xuất?</div><div class="db"><p>Dữ liệu đã lưu trên tài khoản, đăng nhập lại là thấy. Bản lưu trên máy này sẽ bị xoá để người khác dùng chung máy không xem được.</p></div>
    <div class="df"><button class="btn ghost" value="cancel" formnovalidate>Huỷ</button><button type="button" class="btn danger" data-act="signout-yes">Đăng xuất</button></div>`;
}
async function doSignout(){
  if (S.updatedAt && cloud.timer) { clearTimeout(cloud.timer); try { await cloudFlush(); } catch (e) {} }
  await authSignOut(); try { localStorage.removeItem(LS_KEY); } catch (e) {}
  S = blank(); $('#dlg').close(); setAccountBtn(false); setSync('local', 'Chưa đăng nhập'); loginEmail = ''; showLogin({ tab: 'signin' });
}
function changePwDialog(recovery){
  $('#dlgForm').innerHTML = `<div class="dh">${recovery === true ? 'Đặt mật khẩu mới' : 'Đổi mật khẩu'}</div><div class="db">
    <label class="f">Mật khẩu mới<input type="password" id="cpw-1" autocomplete="new-password" placeholder="Ít nhất ${MIN_PW} ký tự, có chữ và số"></label>
    <label class="f" style="margin-top:10px">Nhập lại<input type="password" id="cpw-2" autocomplete="new-password"></label>
    <p class="small login-err" id="cpw-err" role="alert"></p></div>
    <div class="df"><button class="btn ghost" value="cancel" formnovalidate>Huỷ</button><button type="button" class="btn primary" id="cpw-ok">Lưu</button></div>`;
  $('#dlg').showModal();
  $('#cpw-ok').onclick = async () => {
    const a = $('#cpw-1').value, b = $('#cpw-2').value, err = $('#cpw-err');
    if (a.length < MIN_PW || !/[A-Za-z]/.test(a) || !/\d/.test(a)) { err.textContent = 'Mật khẩu cần ít nhất ' + MIN_PW + ' ký tự, gồm cả chữ và số.'; return; }
    if (a !== b) { err.textContent = 'Hai mật khẩu nhập vào không khớp.'; return; }
    try { await authChangePassword(a); $('#dlg').close(); toast('Đã đổi mật khẩu'); } catch (e) { err.textContent = e.message; }
  };
}
