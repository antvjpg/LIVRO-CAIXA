/* LIVRO-CAIXA · js/00-bootstrap.js — bootstrap de topo: config pública do Firebase, constantes e utilitários gerais (app.js: 1-454). Separação por responsabilidade; conteúdo preservado. */
if (typeof Chart !== 'undefined') {
  Chart.defaults.font.family = 'Plus Jakarta Sans';
  Chart.defaults.font.weight = '500';
}
/* [JS 01] CONFIGURAÇÃO / FIREBASE / BOOTSTRAP BASE */
const firebaseConfig = {
  apiKey: "AIzaSyADRwvRCaOB0Q8QvDeDfReVeMzK_m4KqlA",
  authDomain: "livro-caixa-54357.firebaseapp.com",
  projectId: "livro-caixa-54357",
  storageBucket: "livro-caixa-54357.firebasestorage.app",
  messagingSenderId: "508374087306",
  appId: "1:508374087306:web:43a797d57ca6e548655f73"
};
window.__firebaseConfig = firebaseConfig;
window.__FCM_VAPID_KEY = "BJ_SAUk9tFJPLKxXGNqu0v3uDpyyhPeqyKaz7myEixa3an_MZQ79jk9zMypKIq0ZjuKS0j_V_8Cz1clFtfsPhu8";

/* [JS INDICADORES] Base do Worker para GET /financial: mesma origem da IA,
   derivada da URL acima (nada de host novo no código). Vazia = adaptador
   desligado e o app segue normalmente. */
const FINANCIAL_WORKER_ENDPOINT = 'https://livro-caixa-ai.livro-caixa-ai.workers.dev';
window.LivroCaixaFinancial?.configure?.({
  baseUrl: FINANCIAL_WORKER_ENDPOINT,
  ttlMs: 6 * 60 * 60 * 1000
});

/* [BOOT FIREBASE] Precisa estar ANTES de qualquer firebase.firestore()/auth():
   sem initializeApp() a primeira chamada lança e derruba todo o resto do script. */
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();

firebase.firestore().enablePersistence().catch(err => {
  console.log("A persistência offline não pôde ser ativada:", err);
});
const db = firebase.firestore();
window.db = db;

let currentUser = null;
  let firstLoadDone = false;
  let loadGeneration = 0;
let isSignupMode = false;
let saveTimer = null;
let pendingSaveCount = 0;
let snapshotBuffer = {};
window.addEventListener('beforeunload', e => {
  if (pendingSaveCount > 0) {
    e.preventDefault();
    e.returnValue = '';
  }
});
  function updateNavIndicator(tabName) {
    const nav = document.querySelector('.mobile-bottom-nav');
    if (!nav) return;
    const buttons = Array.from(nav.querySelectorAll('button[data-destination]'));
    if (tabName === 'dash') tabName = 'dashboard';
    let index = buttons.findIndex(btn => btn.dataset.destination === tabName);
    if (index < 0) {
      index = buttons.findIndex(btn => btn.dataset.destination === 'caixa');
      tabName = 'caixa';
    }
    if (index < 0) index = 0;
    nav.dataset.active = tabName || 'caixa';
    nav.style.setProperty('--nav-indicator-x', `${index * 100}%`);
  }

  function markValueRefresh(root = document) {
    root.querySelectorAll('.balance-card .amount,.card-amount').forEach((node) => {
      node.classList.remove('value-refresh');
      requestAnimationFrame(() => node.classList.add('value-refresh'));
    });
  }

