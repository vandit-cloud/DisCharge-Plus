const BASE_URL = import.meta.env.VITE_API_URL || '/api';

/** Error thrown for any failed request. `code` and `fields` come from the API's error shape. */
export class ApiError extends Error {
  constructor(status, error = {}) {
    super(error.message || 'Request failed');
    this.status = status;
    this.code = error.code || (status === 0 ? 'NETWORK' : 'UNKNOWN');
    this.fields = error.fields || {};
  }
}

let getToken = () => null;
let onUnauthorized = () => {};

/** Called once by AuthProvider, so every request carries the token and a 401 logs the user out. */
export function configureApi(options) {
  getToken = options.getToken;
  onUnauthorized = options.onUnauthorized;
}

export async function api(path, { method = 'GET', body, query } = {}) {
  const params = new URLSearchParams(Object.entries(query ?? {}).filter(([, v]) => v !== undefined && v !== '' && v !== null));
  const url = `${BASE_URL}${path}${params.size ? `?${params}` : ''}`;
  const token = getToken();
  const headers = { Accept: 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;

  let response;
  try {
    response = await fetch(url, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  } catch {
    throw new ApiError(0, { message: 'Could not reach the server' });
  }
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (response.status === 401 && token) onUnauthorized();
    throw new ApiError(response.status, data.error);
  }
  return data;
}
