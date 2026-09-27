/* C.O.D.E. — configuração do Playwright.
   Camada externa de testes: não modifica o aplicativo.
   Execução real: Linux (CI ou máquina do desenvolvedor). No Termux/Android o
   Playwright não roda ("Unsupported platform: android") — ver e2e/README.md. */
const { defineConfig } = require('@playwright/test');

const PORT = Number(process.env.CODE_PORT || 8000);
const baseURL = process.env.CODE_BASE_URL || `http://127.0.0.1:${PORT}`;
const isCI = !!process.env.CI;
const STATE = 'e2e/.state/qa-session.json';

module.exports = defineConfig({
  testDir: './e2e',
  outputDir: './e2e/.artifacts/test-results',
  timeout: 90_000,
  expect: { timeout: 20_000 },
  /* Identidade efêmera por run: execução serial para não haver corrida
     entre suítes (mesma conta temporária compartilhada pela run). */
  fullyParallel: false,
  workers: 1,
  retries: isCI ? 1 : 0,
  forbidOnly: isCI,
  globalSetup: require.resolve('./e2e/helpers/global-setup.js'),
  /* "finally" da run: Firestore + Auth da conta efêmera, sempre. */
  globalTeardown: require.resolve('./e2e/helpers/global-teardown.js'),
  reporter: [
    ['list'],
    ['html', { outputFolder: 'e2e/reports/html', open: 'never' }],
    ['json', { outputFile: 'e2e/reports/results.json' }],
  ],
  use: {
    baseURL,
    actionTimeout: 15_000,
    navigationTimeout: 45_000,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'off',
    locale: 'pt-BR',
    timezoneId: 'America/Sao_Paulo',
  },
  projects: [
    /* 1) provisiona/reusa a sessão QA e grava storageState.
       Sem trace/screenshot/video: o trace do Playwright grava o corpo da
       requisição de login (e-mail+senha), que não pode ir para artefatos. */
    {
      name: 'setup',
      testMatch: /auth\/qa\.setup\.js$/,
      use: { trace: 'off', screenshot: 'off', video: 'off' },
    },
    /* 2) suítes que consomem a sessão */
    {
      name: 'smoke',
      dependencies: ['setup'],
      testMatch: /smoke\/.*\.spec\.js$/,
      use: { storageState: STATE },
    },
    {
      name: 'movimentacoes',
      dependencies: ['setup'],
      testMatch: /movimentacoes\/.*\.spec\.js$/,
      use: { storageState: STATE },
    },
  ],
  webServer: {
    command: `python3 -m http.server ${PORT} --bind 127.0.0.1`,
    url: `http://127.0.0.1:${PORT}/index.html`,
    cwd: __dirname,
    reuseExistingServer: !isCI,
    timeout: 30_000,
  },
});
