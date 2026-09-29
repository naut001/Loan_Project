import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, mkdtemp, rm, access } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

// No real Supabase requests or personal browser profile. Uses native Chrome CDP.
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const fixture = { v: 1, updatedAt: 1, wallets: [{ id: 'cash', name: 'Ví giả', opening: 10000000 }], tx: {}, debts: [{ id: 'f', name: 'Nợ giả', mode: 'formula', balance: 3000000, rate: 12, payment: 300000, dueDay: 10, stmtDay: 0, dueMode: 'day', grace: 0 }], income: 2000000, plan: { cash: [], buys: [], loans: [], living: 0, buffer: 0, incomePending: false } };
const mock = `<script>
window.testCloud = { payload: ${JSON.stringify(fixture)}, writes: 0, history: [], confirm: false };
window.confirm = () => window.testCloud.confirm;
window.fetch = async (path, options = {}) => {
  const s = window.testCloud;
  if (String(path).includes('/auth/v1/token')) return new Response(JSON.stringify({access_token:'synthetic',user:{id:'test',email:'synthetic@example.test'}}));
  if (!String(path).includes('/rest/v1/user_data?')) throw new Error('External request blocked by smoke test');
  if (options.method === 'PATCH') {
    if (new URL(path).searchParams.get('updated_at') !== 'eq.' + new Date((s.writes + 1) * 1000).toISOString()) return new Response('[]');
    s.history.push(structuredClone(s.payload)); s.payload = JSON.parse(options.body).payload; s.writes++;
  }
  return new Response(JSON.stringify([{payload:s.payload,updated_at:new Date((s.writes+1)*1000).toISOString()}]));
};
</script>`;
const server = createServer(async (req, res) => {
  try {
    const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    const path = resolve(root, 'dist', '.' + (pathname === '/' ? '/index.html' : pathname));
    if (!path.startsWith(join(root, 'dist') + sep)) { res.writeHead(403); res.end(); return; }
    let body = await readFile(path);
    if (extname(path) === '.html') body = Buffer.from(body.toString().replace('<head>', '<head>' + mock));
    res.setHeader('Content-Type', { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css' }[extname(path)] || 'application/octet-stream');
    res.end(body);
  } catch { res.writeHead(404); res.end(); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const url = `http://127.0.0.1:${server.address().port}/`;
const profile = await mkdtemp(join(tmpdir(), 'so-tra-no-smoke-'));
const chrome = process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
await access(chrome);
const browser = spawn(chrome, ['--headless=new', '--no-first-run', '--no-default-browser-check', '--remote-debugging-port=0', `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore' });
let socket;
const results = [];
try {
  const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
  let port;
  for (let i = 0; i < 100; i++) {
    try { port = (await readFile(join(profile, 'DevToolsActivePort'), 'utf8')).split('\n')[0]; break; } catch { await wait(100); }
  }
  assert.ok(port, 'Chrome CDP startup');
  const pages = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
  socket = new WebSocket(pages.find(p => p.type === 'page').webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject; });
  let id = 0;
  const pending = new Map(), errors = [];
  socket.onmessage = event => {
    const data = JSON.parse(event.data);
    if (data.method === 'Runtime.exceptionThrown') errors.push(data.params.exceptionDetails.text);
    const item = pending.get(data.id);
    if (item) { pending.delete(data.id); data.error ? item.reject(new Error(data.error.message)) : item.resolve(data.result); }
  };
  const cdp = (method, params = {}) => new Promise((resolve, reject) => { const next = ++id; pending.set(next, { resolve, reject }); socket.send(JSON.stringify({ id: next, method, params })); });
  const evaluate = async expression => {
    const result = await cdp('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
    return result.result.value;
  };
  const until = async expression => {
    for (let i = 0; i < 80; i++) { if (await evaluate(expression)) return; await wait(50); }
    throw new Error('Timed out: ' + expression);
  };
  const click = async text => {
    await evaluate(`(() => { const el = [...document.querySelectorAll('button')].find(b => b.textContent.trim() === ${JSON.stringify(text)} && b.getClientRects().length); if(!el) throw new Error('Button missing: ' + ${JSON.stringify(text)}); el.click(); })()`);
    await wait(100);
  };
  const input = async (selector, value) => {
    await evaluate(`(() => { const el=document.querySelector(${JSON.stringify(selector)}); if(!el) throw new Error('Input missing'); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(el,${JSON.stringify(value)}); el.dispatchEvent(new Event('input',{bubbles:true})); })()`);
    await wait(50);
  };
  await cdp('Runtime.enable');
  await cdp('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });
  await cdp('Page.navigate', { url });
  await until("document.querySelector('input[type=email]') !== null");
  await input('input[type=email]', 'synthetic@example.test');
  await input('input[type=password]', 'synthetic-only');
  await click('Đăng nhập và tải dữ liệu');
  await until("document.body.textContent.includes('Đã tải dữ liệu.')");
  results.push('PASS: browser login and fixture load (mock Supabase)');
  for (const mobile of [false, true]) {
    await cdp('Emulation.setDeviceMetricsOverride', { width: mobile ? 390 : 1440, height: mobile ? 844 : 1000, deviceScaleFactor: 1, mobile });
    for (const name of ['Tổng quan', 'Khoản nợ', mobile ? 'Tính vay' : 'Tính khoản vay', 'Kế hoạch', 'Phải thu', 'Chi tiêu', 'Báo cáo']) {
      await click(name);
      assert.equal(await evaluate('document.documentElement.scrollWidth <= window.innerWidth'), true, `${name}: horizontal overflow`);
    }
    results.push(`PASS: seven views without horizontal overflow at ${mobile ? '390x844' : '1440x1000'}`);
  }
  await click('Tính vay');
  await evaluate("document.querySelector('.check input').click()"); await wait(100);
  assert.equal(await evaluate("document.body.textContent.includes('Giữ nguyên · trả/tháng')"), true);
  await click('Tải lại dữ liệu');
  await until("document.querySelector('.check input') && !document.querySelector('.check input').checked");
  assert.equal(await evaluate("document.body.textContent.includes('Giữ nguyên · trả/tháng')"), false);
  results.push('PASS: replacing snapshot with same debt ID clears selection and comparison');
  await click('Đề xuất vào kế hoạch');
  assert.equal(await evaluate('testCloud.writes'), 0);
  await click('Nhập đề xuất vào bản nháp');
  assert.equal(await evaluate('testCloud.writes'), 0);
  assert.equal(await evaluate("[...[...document.querySelectorAll('form')].find(f=>f.textContent.includes('Sửa kế hoạch dự kiến')).querySelectorAll('input[type=checkbox]')].every(el => !el.checked)"), true);
  await click('Lưu kế hoạch lên Supabase');
  assert.equal(await evaluate('testCloud.writes'), 0);
  await evaluate('testCloud.confirm = true');
  await click('Lưu kế hoạch lên Supabase');
  await until('testCloud.writes === 1');
  assert.equal(await evaluate('testCloud.payload.plan.loans.length'), 1);
  assert.deepEqual(await evaluate('testCloud.payload.plan.loans[0].payoff'), []);
  assert.deepEqual(await evaluate('testCloud.payload.debts'), fixture.debts);
  assert.deepEqual(await evaluate('testCloud.payload.tx'), {});
  results.push('PASS: proposal/draft/cancel do not write; confirmed save preserves debts/transactions');
  await click('Tính vay'); await click('Đề xuất vào kế hoạch');
  await click('Đóng kết nối');
  assert.equal(await evaluate("document.body.textContent.includes('Có đề xuất vay từ máy tính')"), false);
  assert.equal(await evaluate("document.querySelector('input[type=email]') !== null"), true);
  assert.equal(errors.length, 0, errors.join('\n'));
  results.push('PASS: disconnect clears proposal and account UI; no uncaught runtime errors');
  console.log(results.join('\n'));
} finally {
  socket?.close(); browser.kill(); server.close();
  await new Promise(resolve => setTimeout(resolve, 500));
  await rm(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 300 }).catch(() => {});
}