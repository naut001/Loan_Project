#!/usr/bin/env node
/* Thay placeholder trong js/supabase-sync.js bằng URL và khoá công khai của Supabase.
   Dùng: SUPABASE_URL=... SUPABASE_KEY=... node scripts/inject-config.js <thư-mục-của-trang>
   Từ chối khoá bí mật (service_role, sb_secret_...) để không lỡ đưa lên trang công khai. */
const fs = require('fs'), path = require('path');

function jwtRole(k){
  const p = k.split('.'); if (p.length !== 3) return null;
  try { return JSON.parse(Buffer.from(p[1].replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8')).role || null; }
  catch (e) { return null; }
}
function validate(url, key){
  if (!/^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/.test(url)) return 'SUPABASE_URL phải có dạng https://<mã-dự-án>.supabase.co';
  if (/^sb_secret_/.test(key)) return 'Đây là khoá BÍ MẬT (sb_secret_...). Chỉ dùng khoá publishable hoặc anon trên trang web.';
  if (/^sb_publishable_[A-Za-z0-9_-]+$/.test(key)) return null;
  const role = jwtRole(key);
  if (role === 'anon') return null;
  if (role === 'service_role') return 'Đây là khoá service_role, bỏ qua được mọi bảo mật. Tuyệt đối không đưa lên trang web.';
  return 'SUPABASE_KEY không giống khoá publishable (sb_publishable_...) hay khoá anon (eyJ...).';
}
function inject(text, url, key){
  return text.split('__SUPABASE_URL__').join(url.replace(/\/$/, '')).split('__SUPABASE_KEY__').join(key);
}
module.exports = { validate, inject, jwtRole };

if (require.main === module) {
  const dir = process.argv[2] || '.';
  const file = path.join(dir, 'js', 'supabase-sync.js');
  const url = (process.env.SUPABASE_URL || '').trim(), key = (process.env.SUPABASE_KEY || '').trim();
  if (!url || !key) {
    console.log('::warning::Chưa có SUPABASE_URL hoặc SUPABASE_KEY trong Secrets. Trang vẫn chạy nhưng chỉ lưu trên thiết bị, không có đăng nhập.');
    process.exit(0);
  }
  const bad = validate(url, key);
  if (bad) { console.log('::error::' + bad); process.exit(1); }
  fs.writeFileSync(file, inject(fs.readFileSync(file, 'utf8'), url, key));
  console.log('Đã cấu hình Supabase cho', file);
}
