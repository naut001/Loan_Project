/* Khởi động ứng dụng. */
function renderAll(){ renderHome(); renderDebts(); renderCalc(); renderRecv(); renderPlan(); renderFund(); renderSpend(); renderReports(); }

/* Xử lý link từ email (xác nhận đăng ký, đặt lại mật khẩu) rồi vào ứng dụng. */
async function start(){
  const from = cloudEnabled() ? await handleAuthHash() : null;
  await connect();
  if (from === 'recovery') changePwDialog(true);
  else if (from === 'expired') showLogin({ tab: 'reset', err: 'Liên kết đã hết hạn hoặc không hợp lệ. Hãy gửi lại email.' });
}

setSync('local', 'Đang tải…');
start();
/* Dán link vào đúng tab đang mở chỉ đổi phần #, không tải lại trang. */
window.addEventListener('hashchange', () => { if (/(^|&)(access_token|error)=/.test(location.hash.slice(1))) start(); });
