/* C.O.D.E. — listagem de testes no Termux/Android.
   O Playwright recusa "platform=android" já no load do módulo, o que também
   derruba `playwright test --list`. Este script só contorna a VERIFICAÇÃO DE
   PLATAFORMA para permitir validar localmente que a suíte está descoberta e
   sintaticamente correta. NÃO executa navegador algum (não existe no Termux).
   Uso: npm run code:list */
'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const isAndroid = process.platform === 'android';
const shimPath = path.join(__dirname, 'android-platform-shim.cjs');

const env = { ...process.env };
if (isAndroid) {
  fs.writeFileSync(
    shimPath,
    "/* gerado para listagem local — ver list-tests.cjs */\n" +
      "Object.defineProperty(process, 'platform', { value: 'linux' });\n"
  );
  env.NODE_OPTIONS = [env.NODE_OPTIONS, `--require ${shimPath}`].filter(Boolean).join(' ');
}

/* --reporter=list substitui os reportantes do config: a listagem NÃO pode
   sobrescrever e2e/reports/results.json (senão um run de listagem seria
   relatório de um run de verdade). */
const args = ['playwright', 'test', '--list', '--reporter=list', ...process.argv.slice(2)];
const res = spawnSync('npx', args, { stdio: 'inherit', env, cwd: path.resolve(__dirname, '..', '..') });

if (res.error) {
  console.error(res.error.message);
  process.exit(1);
}
process.exit(res.status ?? 0);
