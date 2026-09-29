#!/usr/bin/env node
/* Kiểm tra không cần thư viện ngoài: node tests/run.js
   1) Phần tính toán (loan.js, model.js) chạy trong vm với ngày giả lập.
   2) Cấu trúc dự án: file được nạp có tồn tại, service worker cache đủ file, manifest hợp lệ. */
const fs = require('fs'), path = require('path'), vm = require('vm'), assert = require('assert');
const root = path.join(__dirname, '..');
let passed = 0, failed = 0;
function test(name, fn){ try{ fn(); passed++; console.log('  ok   ' + name); } catch(e){ failed++; console.log('  FAIL ' + name + '\n       ' + (e && e.message)); } }

/* ---------- môi trường giả lập cho phần tính toán ---------- */
function makeCtx(todayISO, withState){
  const ctx = vm.createContext({ console, __TODAY__: todayISO + 'T00:00:00', document: {}, localStorage: { getItem: () => null, setItem: () => {} } });
  ['js/util.js', 'js/loan.js', 'js/model.js'].forEach(f => vm.runInContext(fs.readFileSync(path.join(root, f), 'utf8'), ctx, { filename: f }));
  if (withState) vm.runInContext(fs.readFileSync(path.join(root, 'js/state.js'), 'utf8'), ctx, { filename: 'js/state.js' });
  else vm.runInContext('var S = {income:0, debts:[], recv:[], plan:{cash:[],living:0,buffer:0,incomePending:false,loans:[],buys:[]}, fund:{}, calc:{}};', ctx);
  return ctx;
}
const run = (ctx, code) => vm.runInContext(code, ctx);
const iso = d => d.toISOString ? d.toISOString().slice(0,10) : d;
const ymd = d => d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');

console.log('Tính toán khoản vay');
const c = makeCtx('2026-09-28');
test('UOB 100tr, 17,99%, 12 tháng: 9.167.523/tháng, lãi 10.010.280', () => {
  const r = 17.99/1200, A = Math.round(run(c,'pmt')(1e8, r, 12)); assert.strictEqual(A, 9167523);
  assert.strictEqual(run(c,'schedule')(1e8, r, A).totalInterest, 10010280);
});
test('UOB 100tr, 17,99%, 24 tháng: 4.991.927/tháng, lãi 19.806.251, dư nợ kỳ 12 = 54.452.297', () => {
  const r = 17.99/1200, A = Math.round(run(c,'pmt')(1e8, r, 24)); assert.strictEqual(A, 4991927);
  const s = run(c,'schedule')(1e8, r, A); assert.strictEqual(s.totalInterest, 19806251); assert.strictEqual(s.rows[11].bal, 54452297); assert.strictEqual(s.months, 24);
});
test('UOB 50tr, 20,99%, 12 tháng: 4.655.449/tháng', () => { assert.strictEqual(Math.round(run(c,'pmt')(5e7, 20.99/1200, 12)), 4655449); });
test('nper và rateFor là phép ngược của pmt', () => {
  const r = 17.99/1200, A = Math.round(run(c,'pmt')(1e8, r, 24));
  assert.strictEqual(run(c,'nper')(1e8, r, A), 24);
  assert.ok(Math.abs(run(c,'rateFor')(1e8, A, 24)*1200 - 17.99) < 0.001);
});
test('lãi 0% chia đều; số trả không đủ lãi thì vô hạn', () => {
  assert.strictEqual(run(c,'pmt')(1200, 0, 12), 100);
  assert.strictEqual(run(c,'nper')(1e8, 0.02, 1e6), Infinity);
});

console.log('Hạn trả và sao kê');
test('thẻ sao kê ngày 27, hạn 25 ngày sau: 21/9, 22/10, 21/11', () => {
  const d = { dueMode:'after', stmtDay:27, grace:25, dueDay:27 };
  const f = run(c,'dueOn'); assert.strictEqual(ymd(f(d,2026,8)), '2026-09-21'); assert.strictEqual(ymd(f(d,2026,9)), '2026-10-22'); assert.strictEqual(ymd(f(d,2026,10)), '2026-11-21');
});
test('sao kê 24/10, hạn ngày 10 -> hạn trả 10/11', () => {
  const d = { stmtDay:24, dueDay:10, dueMode:'day' };
  assert.strictEqual(ymd(run(c,'dueFromStmt')(d, 2026, 9)), '2026-11-10');
  assert.strictEqual(ymd(run(c,'rowDue')(d, '2026-10')), '2026-11-10');
});
test('khoản nhập theo tháng không có sao kê: dòng là tháng đến hạn', () => {
  const d = { dueDay:20, stmtDay:0, dueMode:'day' }; assert.strictEqual(ymd(run(c,'rowDue')(d, '2026-11')), '2026-11-20');
});
test('ngày 31 rơi vào tháng ngắn thì lùi về ngày cuối tháng', () => { assert.strictEqual(ymd(run(c,'dueDate')(2026, 1, 31)), '2026-02-28'); });
test('kỳ Shopee tháng 10 (hạn 10/11) chưa đến kỳ vào 28/9 và không tính vào tháng này', () => {
  run(c, `S.debts=[{id:'a',name:'Shopee',mode:'custom',dueDay:10,stmtDay:24,dueMode:'day',sched:[{k:'2026-10',a:6255572,p:0},{k:'2026-11',a:5522001,p:0}]}]; S.debts.forEach(recalc);`);
  const st = run(c, 'statusOf(S.debts[0])'); assert.strictEqual(st.paid, true); assert.strictEqual(st.none, true); assert.strictEqual(ymd(st.due), '2026-11-10');
  const t = run(c, 'totals()'); assert.strictEqual(t.monthly, 0); assert.strictEqual(t.typical, 6255572);
});
test('kỳ tháng 8 chưa trả (hạn 10/9) báo quá hạn 18 ngày', () => {
  run(c, `S.debts=[{id:'a',name:'X',mode:'custom',dueDay:10,stmtDay:24,dueMode:'day',sched:[{k:'2026-08',a:100,p:0},{k:'2026-10',a:300,p:0}]}]; S.debts.forEach(recalc);`);
  const st = run(c, 'statusOf(S.debts[0])'); assert.strictEqual(st.paid, false); assert.strictEqual(st.days, -18);
});

console.log('Phải thu và dòng tiền');
test('phải thu một lần quá hạn và trả dần chậm được nhận diện', () => {
  run(c, `S.recv=[{id:'r1',name:'Lan',amount:3000000,got:0,kind:'once',due:'2026-09-20'},{id:'r2',name:'A',amount:12000000,got:0,kind:'plan',startK:'2026-09',day:15,per:2000000}];`);
  const a = run(c, 'recvInfo(S.recv[0])'), b = run(c, 'recvInfo(S.recv[1])');
  assert.strictEqual(a.late, 3000000); assert.strictEqual(a.lateDays, 8);
  assert.strictEqual(b.late, 2000000); assert.strictEqual(ymd(b.next), '2026-10-15');
});
test('ghi nhận đã thu làm giảm số chậm', () => {
  run(c, 'S.recv[1].got = 2000000;'); const b = run(c, 'recvInfo(S.recv[1])'); assert.strictEqual(b.late, 0); assert.strictEqual(b.out, 10000000);
});
test('mô phỏng dòng tiền: vay, tất toán nợ và mua sắm cộng trừ đúng tháng', () => {
  run(c, `S.income=18000000; S.debts=[{id:'h',name:'HSBC',mode:'formula',balance:22000000,rate:30,payment:2500000,months:12,dueDay:12,prepay:0,paid:{}}];
    S.recv=[]; S.plan={cash:[{id:'c',name:'TK',a:12000000}],living:8000000,buffer:0,incomePending:false,
    loans:[{id:'l',name:'Vay',amount:100000000,rate:17.99,months:24,k:'2026-10',fee:0,payoff:['h']}], buys:[{id:'b',name:'Laptop',a:15000000,k:'2026-11'}]};`);
  const sim = run(c, 'planSim(6)'); const m = sim.months;
  assert.strictEqual(m[0].bal, 12000000 - Math.round(8000000*3/30) - 2500000);   // tháng 9: còn 3/30 ngày sinh hoạt + kỳ thẻ
  assert.strictEqual(m[1].inn, 18000000 + 100000000);                            // tháng 10: lương + nhận vay
  assert.ok(m[1].ev.some(e => e.t.indexOf('Tất toán HSBC') === 0));               // tất toán thẻ tháng giải ngân
  assert.strictEqual(m[2].out, 8000000 + 4991927 + 15000000);                     // tháng 11: sinh hoạt + trả vay + laptop
});

console.log('Làm sạch dữ liệu nhập');
test('sanitizeState chặn dữ liệu bẩn và giữ số liệu hợp lệ', () => {
  const ctx = makeCtx('2026-09-28', true);
  const out = run(ctx, `sanitizeState({income:'18000000', debts:[{id:'<img src=x onerror=alert(1)>', name:'<b>x</b>', dueDay:'99', balance:'abc', mode:'custom', sched:[{k:'2026-10',a:'100'},{k:'bad',a:5}]}], plan:{loans:[{k:'zzz',payoff:['ok_1','<x>']}]}})`);
  assert.strictEqual(out.income, 18000000);
  assert.ok(/^[A-Za-z0-9_-]+$/.test(out.debts[0].id)); assert.strictEqual(out.debts[0].dueDay, 31);
  assert.strictEqual(out.debts[0].sched.length, 1); assert.strictEqual(out.debts[0].balance, 100);
  assert.deepStrictEqual(Array.from(out.plan.loans[0].payoff), ['ok_1']); assert.ok(/^\d{4}-\d{2}$/.test(out.plan.loans[0].k));
});

console.log('Cấu trúc dự án');
const read = f => fs.readFileSync(path.join(root, f), 'utf8');
const index = read('index.html');
const refs = [...index.matchAll(/(?:src|href)="((?:js|css|icons)\/[^"]+|manifest\.webmanifest)"/g)].map(m => m[1]);
test('mọi file index.html tham chiếu đều tồn tại', () => { refs.forEach(f => assert.ok(fs.existsSync(path.join(root, f)), 'thiếu ' + f)); });
test('index.html có khung đăng nhập và vỏ ứng dụng', () => {
  ['v-login', 'app-shell', 'acct-btn'].forEach(id => assert.ok(index.includes('id="' + id + '"'), 'thiếu #' + id));
  ['js/auth.js', 'js/views/login.js', 'js/supabase-sync.js'].forEach(f => assert.ok(index.includes(f), 'thiếu ' + f));
});
test('không còn file mồ côi trong js/ (mỗi file đều được index.html nạp)', () => {
  const all = []; (function walk(d){ fs.readdirSync(path.join(root, d), { withFileTypes: true }).forEach(e => e.isDirectory() ? walk(d + '/' + e.name) : all.push(d + '/' + e.name)); })('js');
  all.forEach(f => assert.ok(index.includes(f), f + ' không được nạp'));
});
test('service worker cache đủ các file index.html nạp', () => {
  const sw = read('sw.js'); refs.forEach(f => assert.ok(sw.includes("'" + f + "'"), 'sw.js thiếu ' + f));
});
test('manifest hợp lệ và icon tồn tại', () => {
  const m = JSON.parse(read('manifest.webmanifest')); assert.ok(m.name && m.start_url === './' && m.icons.length >= 2);
  m.icons.forEach(i => assert.ok(fs.existsSync(path.join(root, i.src)), 'thiếu ' + i.src));
});
test('không có đường dẫn tuyệt đối (chạy được ở /tên-repo/)', () => {
  [index, read('manifest.webmanifest'), read('sw.js')].forEach(t => assert.ok(!/(?:src|href|start_url|scope)":?\s*=?\s*"?\/[^\/]/.test(t.replace(/https?:\/\/[^"']+/g, '')), 'có đường dẫn bắt đầu bằng /'));
});
test('mỗi script js đều qua được kiểm tra cú pháp', () => {
  refs.filter(f => f.endsWith('.js')).forEach(f => { new vm.Script(read(f), { filename: f }); });
});

console.log('Đăng nhập và cấu hình');
const inject = require(path.join(root, 'scripts/inject-config.js'));
const fakeJwt = role => 'eyJhbGciOiJIUzI1NiJ9.' + Buffer.from(JSON.stringify({ role })).toString('base64url') + '.sig';
test('inject-config nhận khoá anon và publishable, từ chối service_role và sb_secret_', () => {
  const url = 'https://abcdefgh.supabase.co';
  assert.strictEqual(inject.validate(url, fakeJwt('anon')), null);
  assert.strictEqual(inject.validate(url, 'sb_publishable_abc123_XYZ'), null);
  assert.ok(inject.validate(url, fakeJwt('service_role')));
  assert.ok(inject.validate(url, 'sb_secret_abc123'));
  assert.ok(inject.validate(url, 'khong-phai-khoa'));
  assert.ok(inject.validate('http://evil.example.com', fakeJwt('anon')));
});
test('inject-config thay placeholder và bỏ dấu / cuối URL', () => {
  const out = inject.inject("a='__SUPABASE_URL__';b='__SUPABASE_KEY__';", 'https://x.supabase.co/', 'K');
  assert.strictEqual(out, "a='https://x.supabase.co';b='K';");
});
function loadSync(url, key){
  const ctx = vm.createContext({ console, location: { origin: 'https://x', pathname: '/' }, document: { addEventListener(){}, querySelector(){ return null; } }, window: { addEventListener(){} }, localStorage: { getItem: () => null, setItem(){}, removeItem(){} }, history: {}, URLSearchParams, Date });
  let code = fs.readFileSync(path.join(root, 'js/supabase-sync.js'), 'utf8'); if (url) code = inject.inject(code, url, key);
  vm.runInContext(code, ctx, { filename: 'supabase-sync.js' }); vm.runInContext(fs.readFileSync(path.join(root, 'js/auth.js'), 'utf8'), ctx, { filename: 'auth.js' });
  return ctx;
}
test('chưa cấu hình Supabase thì cloudEnabled() = false; có cấu hình thì true', () => {
  assert.strictEqual(run(loadSync(), 'cloudEnabled()'), false);
  assert.strictEqual(run(loadSync('https://x.supabase.co', 'sb_publishable_abc'), 'cloudEnabled()'), true);
});
test('lỗi đăng nhập được dịch sang tiếng Việt có dấu', () => {
  const c = loadSync();
  assert.strictEqual(run(c, "viAuthError({error_code:'invalid_credentials'},400)"), 'Sai email hoặc mật khẩu.');
  assert.ok(/đã có tài khoản/.test(run(c, "viAuthError({msg:'User already registered'},422)")));
  assert.ok(/quá nhiều lần/.test(run(c, 'viAuthError({},429)')));
  assert.ok(/Có lỗi xảy ra/.test(run(c, 'viAuthError(null,500)')));
});
test('phiên đăng nhập: expires_at được tính từ expires_in', () => {
  const c = loadSync(); run(c, "setSession({access_token:'t', expires_in:3600, user:{id:'u1', email:'a@b.c'}})");
  assert.ok(run(c, 'getSession().expires_at') > Date.now() / 1000); assert.strictEqual(run(c, 'getUserId()'), 'u1'); assert.strictEqual(run(c, 'isLoggedIn()'), true);
});
test('mọi chữ hiển thị đều là tiếng Việt CÓ DẤU (không còn chuỗi không dấu)', () => {
  const banned = /(Dang nhap|Dang ky|Dang xuat|Mat khau|Da luu|Da tai|Da dong|Vui long|Tai khoan|Doi mat|Quen mat|dam may|Chua dang|Chua cai|ket noi|That bai|Nhap lai|Tao tai khoan|Theo doi no|ke hoach|dong tien|Khong the|Khong co)/;
  const files = ['index.html', 'README.md', 'sql/schema.sql', '.github/workflows/pages.yml'];
  (function walk(d){ fs.readdirSync(path.join(root, d), { withFileTypes: true }).forEach(e => e.isDirectory() ? walk(d + '/' + e.name) : files.push(d + '/' + e.name)); })('js');
  files.forEach(f => read(f).split('\n').forEach((l, i) => assert.ok(!banned.test(l), f + ':' + (i + 1) + ' còn chuỗi không dấu: ' + l.trim().slice(0, 80))));
});
test('không có khoá thật nào nằm trong mã nguồn', () => {
  const files = ['index.html', 'sw.js', 'README.md', 'sql/schema.sql']; (function walk(d){ fs.readdirSync(path.join(root, d), { withFileTypes: true }).forEach(e => e.isDirectory() ? walk(d + '/' + e.name) : files.push(d + '/' + e.name)); })('js');
  files.forEach(f => { const t = read(f); assert.ok(!/eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\./.test(t), f + ' chứa chuỗi giống JWT'); assert.ok(!/sb_(publishable|secret)_[A-Za-z0-9_-]{10,}/.test(t), f + ' chứa khoá Supabase'); assert.ok(!/[a-z0-9]{20}\.supabase\.co/.test(t), f + ' chứa URL dự án thật'); });
});

console.log('\n' + passed + ' đạt, ' + failed + ' lỗi');
process.exit(failed ? 1 : 0);
