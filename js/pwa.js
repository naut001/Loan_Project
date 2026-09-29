/* Đăng ký service worker để dùng được khi ngoại tuyến và cài lên màn hình chính (cần https hoặc localhost). */
if ('serviceWorker' in navigator && window.isSecureContext) {
  window.addEventListener('load', () => { navigator.serviceWorker.register('sw.js').catch(() => {}); });
}
