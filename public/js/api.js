export class ApiError extends Error {
  constructor(status, message, body) { super(message); this.status = status; this.body = body; }
}

async function request(method, url, body, opts = {}) {
  const res = await fetch(url, {
    method,
    headers: body === undefined ? {} : { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
    ...opts,
  });
  if (res.status === 204) return null;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, data.error || `Request failed (${res.status})`, data);
  return data;
}

const enc = encodeURIComponent;

export const api = {
  list: () => request('GET', '/api/stories'),
  get: (id) => request('GET', `/api/stories/${enc(id)}`),
  create: (title) => request('POST', '/api/stories', { title }),
  import: (doc) => request('POST', '/api/stories/import', doc),
  save: (story, opts) => request('PUT', `/api/stories/${enc(story.id)}`, { ...story, baseUpdatedAt: story.updatedAt }, opts),
  remove: (id) => request('DELETE', `/api/stories/${enc(id)}`),
  playthrough: (id, path) => request('POST', `/api/stories/${enc(id)}/playthrough`, { path }),
  resetStats: (id) => request('DELETE', `/api/stories/${enc(id)}/stats`),
};
