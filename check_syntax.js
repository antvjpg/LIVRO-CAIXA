const fs = require('fs');
const vm = require('vm');
const html = fs.readFileSync('index.html', 'utf8');
const re = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi;
let m;
let blocks = [];
while ((m = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi.exec(html)) !== null) {
  const attrs = m[1] || '';
  if (/\bsrc\s*=/i.test(attrs)) continue;
  if (/\btype\s*=\s*['"]?(?!text\/javascript|module["'])/i.test(attrs)) continue;
  const offset = html.slice(0, m.index).split('\n').length;
  blocks.push({ offset: m.index, code: m[2] });
}
console.log('Total blocks:', blocks.length);
blocks.forEach((block, i) => {
  try {
    new vm.Script(block.code, { filename: 'index.html:inline['+i+']@'+block.offset });
    console.log('Block', i, 'OK');
  } catch (err) {
    console.error('BLOCK', i, 'line ~' + block.offset + ':', err.message);
    const lines = block.code.split('\n');
    if (err.stack) {
      const match = err.stack.match(/line (\d+)/);
      if (match) {
        const lineNum = parseInt(match[1]);
        console.error('  Error at line', lineNum, 'of block:', lines[lineNum - 1]);
        for(let i = Math.max(0, lineNum - 3); i < Math.min(lines.length, lineNum + 2); i++) {
          console.error('  ' + (i+1) + ': ' + lines[i]);
        }
      }
    }
  });
});
ENDOFSCRIPT
node check_syntax.js 2>&1
