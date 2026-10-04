const BASE = (project) =>
  `https://firestore.googleapis.com/v1/projects/${project}/databases/(default)/documents`;

function authHeaders(token) {
  return { Authorization: `Bearer ${token}` };
}

export function documentPath(name) {
  const marker = "/documents/";
  const index = typeof name === "string" ? name.indexOf(marker) : -1;
  return index >= 0 ? name.slice(index + marker.length) : String(name || "");
}

export function fromFirestore(value) {
  if (value == null) return null;
  if (typeof value.stringValue === "string") return value.stringValue;
  if (typeof value.integerValue === "string" || typeof value.integerValue === "number") {
    return Number(value.integerValue);
  }
  if (typeof value.doubleValue === "number") return value.doubleValue;
  if (typeof value.booleanValue === "boolean") return value.booleanValue;
  if ("nullValue" in value) return null;
  if (typeof value.timestampValue === "string") return value.timestampValue;
  if (value.arrayValue && Array.isArray(value.arrayValue.values)) {
    return value.arrayValue.values.map(fromFirestore);
  }
  if (value.mapValue && value.mapValue.fields) return fromFirestoreFields(value.mapValue.fields);
  return null;
}

export function fromFirestoreFields(fields) {
  const result = {};
  if (!fields || typeof fields !== "object") return result;
  for (const key of Object.keys(fields)) result[key] = fromFirestore(fields[key]);
  return result;
}

function toFirestore(value) {
  if (value === null || value === undefined) return { nullValue: null };
  if (typeof value === "string") return { stringValue: value };
  if (typeof value === "boolean") return { booleanValue: value };
  if (typeof value === "number") {
    return Number.isInteger(value) ? { integerValue: String(value) } : { doubleValue: value };
  }
  if (Array.isArray(value)) return { arrayValue: { values: value.map(toFirestore) } };
  const fields = {};
  for (const key of Object.keys(value)) fields[key] = toFirestore(value[key]);
  return { mapValue: { fields } };
}

async function getJson(url, token, init) {
  const response = await fetch(url, {
    ...init,
    headers: { ...authHeaders(token), ...(init && init.headers) }
  });
  if (!response.ok) {
    throw new Error(`firestore ${init && init.method ? init.method : "GET"} ${response.status}`);
  }
  return response.json();
}

export async function listDocuments(project, token, collectionPath, pageSize = 300) {
  const documents = [];
  let pageToken = "";
  for (;;) {
    const url = `${BASE(project)}/${collectionPath}?pageSize=${pageSize}${
      pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : ""
    }`;
    const payload = await getJson(url, token);
    for (const doc of payload.documents || []) documents.push(doc);
    if (!payload.nextPageToken) break;
    pageToken = payload.nextPageToken;
  }
  return documents;
}

export async function setPushMeta(project, token, userId, pushMeta) {
  const url = `${BASE(project)}/livrocaixa/${userId}?updateMask.fieldPaths=pushMeta`;
  await getJson(url, token, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ fields: { pushMeta: toFirestore(pushMeta) } })
  });
}

export async function deleteDocument(project, token, path) {
  const response = await fetch(`${BASE(project)}/${path}`, {
    method: "DELETE",
    headers: authHeaders(token)
  });
  if (!response.ok && response.status !== 404) {
    throw new Error(`firestore DELETE ${response.status}`);
  }
}
