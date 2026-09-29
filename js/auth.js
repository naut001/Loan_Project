/* Đăng nhập bằng email và mật khẩu qua Supabase Auth (gọi REST trực tiếp, không cần SDK).
   Phiên đăng nhập lưu trong localStorage; token tự làm mới khi sắp hết hạn. */
const SESSION_KEY = 'so-tra-no:session';
const authUrl = p => SUPABASE_URL + '/auth/v1' + p;
const authHeaders = tok => ({ apikey: SUPABASE_KEY, 'Content-Type': 'application/json', Authorization: 'Bearer ' + (tok || SUPABASE_KEY) });

let _session = null;
function getSession(){
  if (_session) return _session;
  try { _session = JSON.parse(localStorage.getItem(SESSION_KEY)); } catch (e) { _session = null; }
  return _session;
}
function setSession(s){
  if (s && !s.expires_at && s.expires_in) s.expires_at = Math.floor(Date.now() / 1000) + Number(s.expires_in);
  _session = s || null;
  try { s ? localStorage.setItem(SESSION_KEY, JSON.stringify(s)) : localStorage.removeItem(SESSION_KEY); } catch (e) {}
}
const getAccessToken = () => (getSession() || {}).access_token || null;
const getUserId = () => ((getSession() || {}).user || {}).id || null;
const getUserEmail = () => ((getSession() || {}).user || {}).email || '';
const isLoggedIn = () => !!getAccessToken();

/* Dịch lỗi của Supabase sang tiếng Việt dễ hiểu. */
function viAuthError(data, status){
  const code = (data && (data.error_code || data.code)) || '';
  const msg = String((data && (data.msg || data.message || data.error_description)) || '');
  const M = {
    invalid_credentials: 'Sai email hoặc mật khẩu.',
    user_already_exists: 'Email này đã có tài khoản. Hãy chuyển sang tab Đăng nhập.',
    email_exists: 'Email này đã có tài khoản. Hãy chuyển sang tab Đăng nhập.',
    email_not_confirmed: 'Email chưa được xác nhận. Hãy mở thư xác nhận rồi đăng nhập lại.',
    weak_password: 'Mật khẩu quá yếu. Hãy dùng ít nhất 8 ký tự, gồm cả chữ và số.',
    signup_disabled: 'Dự án đang tắt việc tạo tài khoản mới.',
    over_request_rate_limit: 'Thử quá nhiều lần. Hãy đợi vài phút rồi thử lại.',
    over_email_send_rate_limit: 'Đã gửi quá nhiều email. Hãy đợi một lúc rồi thử lại.',
    validation_failed: 'Email hoặc mật khẩu không hợp lệ.',
    same_password: 'Mật khẩu mới phải khác mật khẩu cũ.',
    email_address_invalid: 'Địa chỉ email không hợp lệ.'
  };
  if (M[code]) return M[code];
  if (/invalid login/i.test(msg)) return M.invalid_credentials;
  if (/already (registered|been registered)/i.test(msg)) return M.user_already_exists;
  if (/rate limit/i.test(msg) || status === 429) return M.over_request_rate_limit;
  if (/signups? (not allowed|disabled)/i.test(msg)) return M.signup_disabled;
  return 'Có lỗi xảy ra' + (status ? ' (mã ' + status + ')' : '') + '. Hãy thử lại sau.';
}

async function authFetch(path, opts){
  let res;
  try { res = await fetch(authUrl(path), opts); }
  catch (e) { const err = new Error('Không kết nối được mạng. Hãy kiểm tra mạng rồi thử lại.'); err.network = true; throw err; }
  let data = null; try { data = await res.json(); } catch (e) {}
  if (!res.ok) { const err = new Error(viAuthError(data, res.status)); err.status = res.status; throw err; }
  return data;
}

/* Làm mới token khi còn dưới 60 giây. Mất mạng thì giữ nguyên phiên; token bị từ chối mới xoá phiên. */
async function maybeRefresh(){
  const s = getSession();
  if (!s || !s.refresh_token || !s.expires_at || Date.now() / 1000 < s.expires_at - 60) return;
  try {
    const d = await authFetch('/token?grant_type=refresh_token', { method: 'POST', headers: authHeaders(), body: JSON.stringify({ refresh_token: s.refresh_token }) });
    setSession(d);
  } catch (e) { if (!e.network && (e.status === 400 || e.status === 401)) setSession(null); }
}

async function authSignUp(email, password){
  const d = await authFetch('/signup', { method: 'POST', headers: authHeaders(), body: JSON.stringify({ email, password }) });
  if (d && d.access_token) setSession(d);
  return d;
}
async function authSignIn(email, password){
  const d = await authFetch('/token?grant_type=password', { method: 'POST', headers: authHeaders(), body: JSON.stringify({ email, password }) });
  setSession(d); return d;
}
async function authSignOut(){
  const tok = getAccessToken();
  if (tok) { try { await fetch(authUrl('/logout'), { method: 'POST', headers: authHeaders(tok) }); } catch (e) {} }
  setSession(null);
}
async function authChangePassword(password){
  await maybeRefresh();
  const tok = getAccessToken(); if (!tok) throw new Error('Bạn chưa đăng nhập.');
  const d = await authFetch('/user', { method: 'PUT', headers: authHeaders(tok), body: JSON.stringify({ password }) });
  if (d && d.id) { const s = getSession(); if (s) { s.user = d; setSession(s); } }
}
async function authResetPassword(email){
  const back = encodeURIComponent(location.origin + location.pathname);
  await authFetch('/recover?redirect_to=' + back, { method: 'POST', headers: authHeaders(), body: JSON.stringify({ email }) });
}

/* Đọc kết quả khi người dùng bấm link trong email (xác nhận đăng ký, đặt lại mật khẩu). */
async function handleAuthHash(){
  const h = location.hash.replace(/^#/, '');
  if (!/(^|&)(access_token|error)=/.test(h)) return null;
  const p = new URLSearchParams(h);
  history.replaceState(null, '', location.pathname + location.search);
  if (p.get('error')) return 'expired';
  const at = p.get('access_token'); if (!at || !cloudEnabled()) return null;
  try {
    const res = await fetch(authUrl('/user'), { headers: authHeaders(at) });
    if (!res.ok) return 'expired';
    setSession({ access_token: at, refresh_token: p.get('refresh_token') || '', expires_at: Math.floor(Date.now() / 1000) + (parseInt(p.get('expires_in'), 10) || 3600), user: await res.json() });
    return p.get('type') || 'signin';
  } catch (e) { return 'expired'; }
}
