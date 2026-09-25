const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000';

export async function apiRequest(path, options = {}) {
  const token = localStorage.getItem('token');
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  };

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });

  const text = await res.text();
  let data = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch (error) {
      data = { error: 'Unexpected server response', raw: text.slice(0, 500) };
    }
  }

  if (!res.ok) {
    throw new Error(data?.error || 'Request failed');
  }

  return data;
}

export function getUser() {
  const token = localStorage.getItem('token');
  if (!token) return null;
  let role = localStorage.getItem('role');
  let profileId = localStorage.getItem('profileId');
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    if (payload.role) role = payload.role;
    if (payload.profileId || payload.userId) profileId = payload.profileId || payload.userId;
  } catch (e) {
    // fallback to stored items
  }
  return { token, role, profileId };
}

export function setUser(data) {
  localStorage.setItem('token', data.token);
  localStorage.setItem('role', data.role);
  localStorage.setItem('profileId', data.profileId);
}

export function clearUser() {
  localStorage.removeItem('token');
  localStorage.removeItem('role');
  localStorage.removeItem('profileId');
}
