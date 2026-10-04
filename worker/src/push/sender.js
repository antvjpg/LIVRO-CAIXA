import notificationPlan from "../../../functions/src/notification-plan.js";
import { getGoogleAccessToken } from "./service-account.js";
import {
  listDocuments,
  fromFirestoreFields,
  setPushMeta,
  deleteDocument,
  documentPath
} from "./firestore.js";

const { buildPushNotificationPlan, pruneSentMap, selectPendingToday } = notificationPlan;

const COLLECTIONS = ["recurringBills", "goals", "receivables", "cards", "pushTokens"];
const SUBREQUEST_BUDGET = 45;

function todayInSaoPaulo() {
  return new Date().toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" });
}

async function sendFcm(project, accessToken, registrationToken, item) {
  const response = await fetch(`https://fcm.googleapis.com/v1/projects/${project}/messages:send`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      message: {
        token: registrationToken,
        data: {
          title: String(item.title || ""),
          body: String(item.body || ""),
          tag: String(item.tag || ""),
          url: "./"
        }
      }
    })
  });
  if (response.ok) return { ok: true, invalid: false };
  const raw = await response.text().catch(() => "");
  let errorCode = "";
  let message = "";
  try {
    const parsed = JSON.parse(raw);
    message = (parsed.error && parsed.error.message) || "";
    const details = (parsed.error && parsed.error.details) || [];
    for (const detail of details) {
      if (detail && typeof detail.errorCode === "string") errorCode = detail.errorCode;
    }
  } catch (err) {
    message = raw.slice(0, 300);
  }
  const invalid =
    response.status === 404 ||
    errorCode === "UNREGISTERED" ||
    /not[- ]registered|invalid[ _-]?(registration[ _-]?token|token)/i.test(
      `${errorCode} ${message}`
    );
  return { ok: false, invalid, status: response.status };
}

async function processUser({ project, accessToken, userDoc, today, budget }) {
  const data = fromFirestoreFields(userDoc.fields || {});
  const profileFeatures =
    data.profileSettings && data.profileSettings.featureSettings
      ? data.profileSettings.featureSettings
      : {};
  if (profileFeatures.pushNotifications !== true) return "skipped";

  const uid = documentPath(userDoc.name).split("/").pop();
  if (budget.spent + 6 > SUBREQUEST_BUDGET) {
    budget.exhausted = true;
    return "skipped";
  }
  const [bills, goals, receivables, cards, tokenDocs] = await Promise.all(
    COLLECTIONS.map((name) => listDocuments(project, accessToken, `livrocaixa/${uid}/${name}`))
  );
  budget.spent += 5;
  const tokens = tokenDocs
    .map((doc) => ({
      path: documentPath(doc.name),
      token: fromFirestoreFields(doc.fields || {}).token,
      invalid: false
    }))
    .filter((entry) => typeof entry.token === "string" && entry.token.length > 0);
  if (!tokens.length) return "skipped";

  const plan = buildPushNotificationPlan({
    today,
    advanceDays: profileFeatures.reminderAdvanceDays,
    reminders: profileFeatures.reminders !== false,
    bills: bills.map((doc) => withDocId(doc)),
    goals: goals.map((doc) => withDocId(doc)),
    receivables: receivables.map((doc) => withDocId(doc)),
    cards: cards.map((doc) => withDocId(doc))
  });
  if (!plan.length) return "skipped";

  const previous =
    data.pushMeta && typeof data.pushMeta.lastSent === "object" && data.pushMeta.lastSent
      ? data.pushMeta.lastSent
      : {};
  const lastSent = pruneSentMap(previous, today);
  const pending = selectPendingToday(plan, lastSent, today);
  if (pending.length) {
    for (const item of pending) {
      let attempted = false;
      for (const entry of tokens) {
        if (entry.invalid) continue;
        if (budget.spent >= SUBREQUEST_BUDGET) break;
        budget.spent += 1;
        attempted = true;
        const result = await sendFcm(project, accessToken, entry.token, item);
        if (result.ok) {
          budget.sent += 1;
          continue;
        }
        if (result.invalid) {
          entry.invalid = true;
          budget.spent += 1;
          await deleteDocument(project, accessToken, entry.path).catch(() => null);
        }
      }
      if (attempted) lastSent[item.tag] = today;
      if (budget.spent >= SUBREQUEST_BUDGET) {
        budget.exhausted = true;
        break;
      }
    }
  }
  budget.spent += 1;
  await setPushMeta(project, accessToken, uid, {
    lastSent,
    updatedAt: new Date().toISOString()
  });
  return "processed";
}

function withDocId(doc) {
  const data = fromFirestoreFields(doc.fields || {});
  if (typeof data.id === "string" && data.id) return data;
  data.id = documentPath(doc.name).split("/").pop();
  return data;
}

export async function runPushDispatch(env) {
  const project = env.FIREBASE_PROJECT_ID;
  if (!project) throw new Error("FIREBASE_PROJECT_ID ausente");
  const budget = { spent: 0, sent: 0, exhausted: false };
  const accessToken = await getGoogleAccessToken(env);
  budget.spent += 1;
  const today = todayInSaoPaulo();
  const userDocs = await listDocuments(project, accessToken, "livrocaixa");
  budget.spent += 1;
  const summary = {
    users: userDocs.length,
    processed: 0,
    skipped: 0,
    errors: 0,
    sent: 0,
    spent: 0
  };
  for (const userDoc of userDocs) {
    if (budget.exhausted) break;
    try {
      const result = await processUser({ project, accessToken, userDoc, today, budget });
      if (result === "processed") summary.processed += 1;
      else summary.skipped += 1;
    } catch (err) {
      summary.errors += 1;
      const message = err && err.message ? String(err.message) : String(err);
      console.log(
        JSON.stringify({ event: "push_dispatch_user_error", detail: message.slice(0, 200) })
      );
    }
  }
  summary.sent = budget.sent;
  summary.spent = budget.spent;
  if (budget.exhausted) summary.exhausted = true;
  return summary;
}
