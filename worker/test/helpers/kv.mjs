/* Binding KV em memória para os testes: espelha o contrato mínimo de
   Cloudflare KV usado pelo Worker (get/put/delete) sem sair do processo.
   Permite exercitar o caminho de produção (QUOTA_KV / RATE_LIMIT_KV) em vez
   do fallback local, sem tocar no código do Worker. */
export function makeKvMock() {
  const store = new Map();
  return {
    async get(key, options = {}) {
      const raw = store.get(key);
      if (raw == null) return null;
      return options && options.type === "json" ? JSON.parse(raw) : raw;
    },
    async put(key, value) {
      store.set(key, String(value));
    },
    async delete(key) {
      store.delete(key);
    }
  };
}
