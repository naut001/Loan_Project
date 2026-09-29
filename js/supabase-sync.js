/* Đồng bộ dữ liệu lên Supabase theo tài khoản đăng nhập.
   Hai placeholder bên dưới được thay lúc triển khai bằng scripts/inject-config.js (lấy từ GitHub Secrets).
   Khi chưa cấu hình, ứng dụng chạy ở chế độ chỉ lưu trên thiết bị, không có đăng nhập. */
const SUPABASE_URL = '__SUPABASE_URL__';
const SUPABASE_KEY = '__SUPABASE_KEY__';
const TABLE = 'user_data';
const cloudEnabled = () => !!SUPABASE_URL && !!SUPABASE_KEY && !/^__/.test(SUPABASE_URL) && !/^__/.test(SUPABASE_KEY);

const cloud = { timer: null, saving: false, pending: false };
const rest = (q) => SUPABASE_URL + '/rest/v1/' + TABLE + (q || '');
const restHeaders = prefer => ({ apikey: SUPABASE_KEY, Authorization: 'Bearer ' + getAccessToken(), 'Content-Type': 'application/json', Prefer: prefer || 'return=minimal' });

/* Hết phiên: nhớ email để điền sẵn, giữ nguyên dữ liệu chưa lưu trên máy, quay về màn hình đăng nhập. */
function expireSession(msg){
  loginEmail = getUserEmail() || loginEmail; setSession(null); setAccountBtn(false);
  showLogin({ tab: 'signin', err: msg || 'Phiên đăng nhập đã hết hạn. Hãy đăng nhập lại.' });
}

function cloudSave(){
  if (!cloudEnabled() || !isLoggedIn()) return;
  clearTimeout(cloud.timer); cloud.timer = setTimeout(cloudFlush, 800);
}

async function cloudFlush(){
  if (!cloudEnabled() || !isLoggedIn()) return;
  if (cloud.saving) { cloud.pending = true; return; }
  cloud.saving = true;
  try {
    await maybeRefresh();
    const uid = getUserId(); if (!uid) throw Object.assign(new Error('no session'), { status: 401 });
    const res = await fetch(rest('?on_conflict=user_id'), { method: 'POST', headers: restHeaders('return=minimal,resolution=merge-duplicates'), body: JSON.stringify({ user_id: uid, payload: S }) });
    if (res.status === 401 || res.status === 403) throw Object.assign(new Error('unauth'), { status: res.status });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    setSync('ok', 'Đã lưu lên tài khoản');
  } catch (e) {
    if (e.status === 401 || e.status === 403) expireSession('Phiên đăng nhập đã hết hạn. Hãy đăng nhập lại, thay đổi chưa lưu vẫn còn trên máy.');
    else setSync('warn', 'Chưa lưu được lên tài khoản, dữ liệu vẫn còn trên máy');
  }
  cloud.saving = false;
  if (cloud.pending) { cloud.pending = false; cloudFlush(); }
}

/* Kết quả: 'ok' | 'offline' (mất mạng hoặc lỗi máy chủ, giữ dữ liệu trên máy) | 'unauth' (cần đăng nhập lại). */
async function cloudLoad(){
  try {
    await maybeRefresh();
    const uid = getUserId(); if (!uid) return 'unauth';
    const res = await fetch(rest('?user_id=eq.' + encodeURIComponent(uid) + '&select=payload'), { headers: restHeaders() });
    if (res.status === 401 || res.status === 403) return 'unauth';
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const rows = await res.json();
    if (!rows.length) { await cloudFlush(); return 'ok'; }
    const remote = rows[0].payload || {};
    if ((remote.updatedAt || 0) > (S.updatedAt || 0)) {
      S = sanitizeState(remote);
      try { localStorage.setItem(LS_KEY, JSON.stringify(S)); } catch (e) {}
      renderAll(); setSync('ok', 'Đã tải dữ liệu mới nhất');
    } else if ((remote.updatedAt || 0) < (S.updatedAt || 0)) { await cloudFlush(); }
    else setSync('ok', 'Đã đồng bộ');
    return 'ok';
  } catch (e) { setSync('warn', 'Không kết nối được, đang dùng dữ liệu trên máy'); return 'offline'; }
}

/* Khi quay lại tab hoặc có mạng trở lại, lấy bản mới nhất nếu thiết bị khác đã sửa. */
async function cloudPull(){
  if (!cloudEnabled() || !isLoggedIn() || cloud.saving || document.querySelector('dialog[open]')) return;
  if (await cloudLoad() === 'unauth') expireSession();
}
document.addEventListener('visibilitychange', () => { if (!document.hidden) cloudPull(); });
window.addEventListener('online', cloudPull);

async function connect(){
  if (!cloudEnabled()) { hideLogin(); setAccountBtn(false); renderAll(); setSync('local', 'Chỉ lưu trên thiết bị này'); return; }
  if (!isLoggedIn()) { setAccountBtn(false); setSync('local', 'Chưa đăng nhập'); showLogin(); return; }
  hideLogin(); setAccountBtn(true); renderAll(); setSync('local', 'Đang đồng bộ…');
  if (await cloudLoad() === 'unauth') expireSession();
}
