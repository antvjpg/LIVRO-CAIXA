const { onSchedule } = require("firebase-functions/v2/scheduler");
const admin = require("firebase-admin");
const { buildPushNotificationPlan, pruneSentMap, selectPendingToday } = require("./src/notification-plan");

process.env.TZ = process.env.TZ || "America/Sao_Paulo";

admin.initializeApp();

const INVALID_TOKEN_CODES = new Set([
  "messaging/invalid-argument",
  "messaging/registration-token-not-registered",
  "messaging/invalid-registration-token"
]);

function todayInSaoPaulo() {
  return new Date().toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" });
}

async function collectSubcollection(ref, name) {
  const snap = await ref.collection(name).get();
  return snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
}

async function sendToTokens(tokens, item) {
  const invalidDocs = [];
  for (let start = 0; start < tokens.length; start += 500) {
    const batch = tokens.slice(start, start + 500);
    const result = await admin.messaging().sendEachForMulticast({
      tokens: batch.map((entry) => entry.token),
      data: {
        title: String(item.title || ""),
        body: String(item.body || ""),
        tag: String(item.tag || ""),
        url: "./"
      }
    });
    result.responses.forEach((response, index) => {
      if (response.success) return;
      const error = response.error;
      if (error && INVALID_TOKEN_CODES.has(error.code)) invalidDocs.push(batch[index].ref);
    });
  }
  await Promise.all(invalidDocs.map((ref) => ref.delete().catch(() => null)));
}

async function processUser(doc, today) {
  const data = doc.data() || {};
  const profileFeatures =
    data.profileSettings && data.profileSettings.featureSettings
      ? data.profileSettings.featureSettings
      : {};
  if (profileFeatures.pushNotifications !== true) return;

  const [bills, goals, receivables, cards, tokenDocs] = await Promise.all([
    collectSubcollection(doc.ref, "recurringBills"),
    collectSubcollection(doc.ref, "goals"),
    collectSubcollection(doc.ref, "receivables"),
    collectSubcollection(doc.ref, "cards"),
    doc.ref.collection("pushTokens").get()
  ]);

  const tokens = tokenDocs.docs
    .map((tokenDoc) => ({ ref: tokenDoc.ref, token: tokenDoc.data().token }))
    .filter((entry) => typeof entry.token === "string" && entry.token.length > 0);
  if (!tokens.length) return;

  const plan = buildPushNotificationPlan({
    today,
    advanceDays: profileFeatures.reminderAdvanceDays,
    reminders: profileFeatures.reminders !== false,
    bills,
    goals,
    receivables,
    cards
  });
  if (!plan.length) return;

  const previous = data.pushMeta && typeof data.pushMeta.lastSent === "object" && data.pushMeta.lastSent
    ? data.pushMeta.lastSent
    : {};
  const lastSent = pruneSentMap(previous, today);
  const pending = selectPendingToday(plan, lastSent, today);
  if (pending.length) {
    for (const item of pending) {
      await sendToTokens(tokens, item);
      lastSent[item.tag] = today;
    }
    await doc.ref.set(
      { pushMeta: { lastSent, updatedAt: new Date().toISOString() } },
      { merge: true }
    );
  } else {
    await doc.ref.set({ pushMeta: { lastSent, updatedAt: new Date().toISOString() } }, { merge: true });
  }
}

exports.sendPushReminders = onSchedule(
  {
    schedule: "every day 08:00",
    timeZone: "America/Sao_Paulo",
    region: "southamerica1",
    retryCount: 1
  },
  async () => {
    const today = todayInSaoPaulo();
    let cursor = null;
    for (;;) {
      let query = admin.firestore().collection("livrocaixa").limit(300);
      if (cursor) query = query.startAfter(cursor);
      const page = await query.get();
      if (page.empty) break;
      for (const doc of page.docs) {
        try {
          await processUser(doc, today);
        } catch (err) {
          console.error("Falha ao processar usuario", doc.id, err && err.code ? err.code : err);
        }
      }
      cursor = page.docs[page.docs.length - 1];
      if (page.size < 300) break;
    }
  }
);
