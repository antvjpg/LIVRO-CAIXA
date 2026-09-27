/* C.O.D.E. — provisionamento autônomo da conta QA.
   Fluxo real pela interface: login → (se não existir) criar conta → login.
   Nenhuma credencial é impressa nem gravada fora de e2e/.env.local.
   Nunca usa conta Google (popup) nem conta real do usuário. */
'use strict';

const { resolveCredentials } = require('./env');
const app = require('./app');
const firestore = require('./firestore-rest');
const identity = require('./identity');

const MSG = {
  notFound: 'Conta não encontrada', /* texto do app p/ auth/user-not-found */
  /* Códigos devolvidos pela API do Firebase Auth. São SINAIS diagnósticos de
     configuração/disponibilidade do provider — não provam que o provider
     esteja desabilitado agora (regra em hintFor). */
  providerSignals: ['PASSWORD_LOGIN_DISABLED', 'OPERATION_NOT_ALLOWED'],
  exists: 'Já existe uma conta',
  unauthorizedDomain: 'autorizado no Firebase',
  tooMany: 'Muitas tentativas',
  generic: 'Não foi possível concluir',
};

function credentials() {
  return resolveCredentials();
}

async function toggleMode(page) {
  await page.locator('#authToggleLink, #authToggleLink2').first().click();
  await page.waitForFunction(() => {
    const t = document.getElementById('authTitle');
    return t && (t.textContent === 'Criar conta' || t.textContent === 'Entrar');
  });
}

async function submit(page, creds) {
  await page.fill('#authEmail', creds.email);
  await page.fill('#authPass', creds.password);
  await page.click('#authSubmit');
  return page.waitForFunction(
    () => {
      const overlay = document.getElementById('authOverlay');
      if (overlay?.classList.contains('hidden')) return true;
      const err = document.getElementById('authError');
      return !!(err && err.textContent.trim());
    },
    null,
    { timeout: 45_000 }
  ).then(() =>
    page.evaluate(() => ({
      loggedIn: document.getElementById('authOverlay')?.classList.contains('hidden') === true,
      error: (document.getElementById('authError')?.textContent || '').trim(),
      title: (document.getElementById('authTitle')?.textContent || '').trim(),
    }))
  );
}

/* Registra na identidade da run (sem segredo) que ESTA run criou ou não a
   conta. createdByCode === true apenas quando o signup da UI teve sucesso —
   é a prova usada depois para autorizar a exclusão (FASE 4/6). */
function recordOwnership(result, creds) {
  try {
    if (result.status === 'ok') {
      const createdByCode = result.how === 'signup';
      identity.patch({
        createdByCode,
        state: createdByCode ? 'created-by-code' : `preexistent (${result.how})`,
        email: creds.email,
      });
    } else {
      identity.patch({ state: `blocked (${result.error || 'sem mensagem'})`, email: creds.email });
    }
  } catch {
    /* registro de metadado nunca pode derrubar o fluxo de autenticação */
  }
  return result;
}

/* Lê APENAS uid/e-mail da sessão persistida pelo SDK (nunca o token). */
async function readSessionIdentity(page, expectedEmail) {
  try {
    const got = await page.evaluate(() => {
      try {
        const key = Object.keys(localStorage).find((k) => k.indexOf('firebase:authUser:') === 0);
        if (!key) return null;
        const raw = JSON.parse(localStorage.getItem(key) || 'null');
        if (!raw || !raw.uid) return null;
        return { uid: String(raw.uid), email: String(raw.email || '') };
      } catch (e) {
        return null;
      }
    });
    if (!got || !got.uid) return null;
    if (String(got.email).toLowerCase() !== String(expectedEmail).toLowerCase()) return null;
    return got;
  } catch (e) {
    return null;
  }
}

/* FASE 4 — logout real pela UI (botão #btnLogout do próprio app).
   Não altera dado algum: auth.signOut() só encerra a sessão local. */
async function logout(page) {
  await page.locator('#btnLogout').click({ timeout: 15_000 });
  await page.waitForFunction(
    () => document.getElementById('authOverlay')?.classList.contains('hidden') !== true,
    null,
    { timeout: 15_000 }
  );
  return true;
}

/* FASE 4 — login real pela UI, SEM tocar na propriedade da conta.
   createdByCode só é definido no signup do provisionamento; relogin nunca
   pode rebaixar a propriedade para "preexistente" (senão a conta efêmera
   não seria excluída no teardown). */
async function loginOnly(page, creds) {
  await app.openApp(page);
  if (await app.isLoggedIn(page)) return { status: 'ok', how: 'sessao-ja-ativa' };
  let r = await submit(page, creds);
  if (!r.loggedIn) {
    const title = await page.evaluate(() => (document.getElementById('authTitle')?.textContent || '').trim());
    if (title === 'Criar conta') {
      await toggleMode(page);
      r = await submit(page, creds);
    }
  }
  if (r.loggedIn) return { status: 'ok', how: 'login' };
  return { status: 'blocked', error: r.error || 'sem mensagem de erro', hint: hintFor(r.error) };
}

/* Retorna { status: 'ok', how } ou { status: 'blocked', error, hint }. */
async function signInOrCreate(page, creds) {
  /* fecha cada caminho registrando propriedade/uid na identidade da run */
  const finish = async (result) => {
    recordOwnership(result, creds);
    if (result.status === 'ok') {
      const sess = await readSessionIdentity(page, creds.email);
      if (sess) {
        try {
          identity.patch({ uid: sess.uid });
        } catch {
          /* metadado nunca derruba o fluxo */
        }
        result.uid = sess.uid;
      }
    }
    return result;
  };

  await app.openApp(page);
  if (await app.isLoggedIn(page)) return finish({ status: 'ok', how: 'sessao-reutilizada' });

  let r = await submit(page, creds);
  if (r.loggedIn) return finish({ status: 'ok', how: 'login' });

  const loginErr = r.error || '';
  const authTitle = async () =>
    (await page.evaluate(() => (document.getElementById('authTitle')?.textContent || '').trim()));

  /* Login falhou: em projetos com proteção contra enumeração de contas o
     Firebase devolve "credencial inválida" (auth/invalid-credential) em vez
     de "conta não encontrada" (auth/user-not-found). Por isso o cadastro é
     tentado SEMPRE que o login falha — nunca dependendo do texto do erro —
     e a colisão "já existe" volta ao login com a mesma senha. */
  if ((await authTitle()) !== 'Criar conta') await toggleMode(page);
  r = await submit(page, creds);
  if (r.loggedIn) return finish({ status: 'ok', how: 'signup' });

  let err = r.error || '';
  if (err.includes(MSG.exists)) {
    if ((await authTitle()) !== 'Entrar') await toggleMode(page);
    r = await submit(page, creds);
    if (r.loggedIn) return finish({ status: 'ok', how: 'login-apos-colisao' });
    err = r.error || '';
  }

  const erroFinal = err || loginErr;
  return finish({ status: 'blocked', error: erroFinal || 'sem mensagem de erro', hint: hintFor(erroFinal) });
}

/* Interpreta erros da autenticação.
   REGRA DE DIAGNÓSTICO: PASSWORD_LOGIN_DISABLED / OPERATION_NOT_ALLOWED são
   sinais de um erro compatível com configuração ou disponibilidade do
   provider. Eles NÃO provam que o provider esteja desabilitado agora: a
   mesma mensagem pode vir de execução anterior, configuração ainda não
   aplicada, ambiente divergente, inconsistência transitória ou falha de
   roteamento. Classificar o provider como desabilitado exige evidência
   contemporânea e independente (Firebase Console, API oficial autorizada ou
   signup/login real). Nunca registrar "está desabilitado" com base só no erro. */
function hintFor(message = '') {
  const code = MSG.providerSignals.find((c) => String(message).includes(c));
  if (code) {
    return (
      'A tentativa de autenticação recebeu um erro compatível com configuração ou disponibilidade do provider ' +
      `(sinal: ${code}). Verifique o estado ATUAL em Firebase Console → Authentication → Sign-in method → ` +
      'E-mail/senha e valide o fluxo numa execução controlada (signup + login).'
    );
  }
  if (message.includes(MSG.unauthorizedDomain)) {
    return 'Ação manual: Firebase Console → Authentication → Settings → Authorized domains → adicionar o domínio usado (localhost/127.0.0.1/github.io).';
  }
  if (message.includes(MSG.tooMany)) {
    return 'Rate limit do Firebase Auth. Aguardar e reexecutar.';
  }
  if (message.includes(MSG.generic)) {
    return (
      'Erro genérico de autenticação: verificar o estado ATUAL do provedor E-mail/senha, domínio autorizado ' +
      'e conectividade, e validar o fluxo numa execução controlada.'
    );
  }
  return 'Verificar estado atual do provedor E-mail/senha, domínio autorizado e conectividade.';
}

/* Reset/cleanup autônomo e idempotente: apaga tudo sob livrocaixa/{uid-qa}.
   Só age no uid retornado pela autenticação da própria conta QA. */
async function reset() {
  const creds = resolveCredentials();
  if (!creds) {
    const err = new Error('BLOCKED: credenciais QA ausentes para reset/cleanup');
    err.code = 'CODE_BLOCKED';
    throw err;
  }
  return firestore.resetUser(creds);
}

module.exports = {
  credentials,
  signInOrCreate,
  loginOnly,
  logout,
  sessionIdentity: readSessionIdentity,
  reset,
  MSG,
  hintFor,
};
