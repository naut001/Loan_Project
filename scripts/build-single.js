#!/usr/bin/env node
/* Gộp index.html + css + js thành MỘT file HTML tự chứa (dist/so-tra-no.single.html).
   Dùng để nhúng vào nơi chỉ nhận một file (ví dụ artifact). Bỏ manifest và service worker. */
const fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..');
let html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

html = html.replace(/<!-- build:remove-start -->[\s\S]*?<!-- build:remove-end -->\s*/g, '');
html = html.replace(/<link rel="stylesheet" href="([^"]+)">/g, (_, href) =>
  '<style>\n' + fs.readFileSync(path.join(root, href), 'utf8') + '</style>');
html = html.replace(/<script src="([^"]+)"><\/script>/g, (_, src) => {
  const code = fs.readFileSync(path.join(root, src), 'utf8');
  if (/<\/script/i.test(code)) throw new Error('File ' + src + ' chứa </script>, không nhúng được');
  return '<script>\n/* ' + src + ' */\n' + code + '</script>';
});

const outDir = path.join(root, 'dist'); fs.mkdirSync(outDir, { recursive: true });
const out = path.join(outDir, 'so-tra-no.single.html');
fs.writeFileSync(out, html);
console.log('Đã tạo', path.relative(root, out), '(' + Math.round(html.length / 1024) + ' KB)');
