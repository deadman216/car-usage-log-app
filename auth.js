/* Sanaya Auth — server-based auth for multi-device support
 * Default server: http://localhost:3000
 * Change SERVER_URL below to point to your server.
 */
(function () {
  "use strict";

  // Auto-detect server URL: use same host as the page, or fallback to localhost:3000
  const SERVER_URL = (location.hostname && location.protocol !== 'file:')
    ? `${location.protocol}//${location.hostname}:3000`
    : "http://localhost:3000";
  const TOKEN_KEY = "sanaya_token_v1";
  const USER_KEY = "sanaya_user_v1";

  function getToken() {
    return localStorage.getItem(TOKEN_KEY);
  }

  function setToken(token) {
    localStorage.setItem(TOKEN_KEY, token);
  }

  function getUser() {
    try {
      const raw = localStorage.getItem(USER_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  }

  function setUser(user) {
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  }

  function clearAuth() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  }

  async function apiCall(method, path, body) {
    const token = getToken();
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await fetch(`${SERVER_URL}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'API error');
    return data;
  }

  async function login(username, password) {
    const data = await apiCall('POST', '/api/auth/login', { username, password });
    setToken(data.token);
    setUser(data.user);
    return data.user;
  }

  async function register(username, password, displayName) {
    return await apiCall('POST', '/api/auth/register', { username, password, displayName });
  }

  async function logout() {
    try {
      await apiCall('POST', '/api/auth/logout');
    } catch (e) {
      // Ignore errors on logout
    }
    clearAuth();
  }

  async function getMe() {
    try {
      const data = await apiCall('GET', '/api/auth/me');
      setUser(data.user);
      return data.user;
    } catch {
      clearAuth();
      return null;
    }
  }

  function isLoggedIn() {
    return !!getToken() && !!getUser();
  }

  function requireAuth(redirectTo) {
    if (!isLoggedIn()) {
      const target = redirectTo || "login.html";
      const current = location.pathname.split("/").pop();
      if (current !== "login.html") {
        location.replace(target);
      }
      return false;
    }
    return true;
  }

  function currentUsername() {
    const u = getUser();
    return u ? u.username : null;
  }

  function currentRole() {
    const u = getUser();
    return u ? u.role : null;
  }

  function isAdmin() {
    return currentRole() === "admin";
  }

  // WebSocket connection for presence
  let ws = null;
  let presenceCallback = null;

  function connectPresence() {
    const token = getToken();
    if (!token) return;

    const wsUrl = SERVER_URL.replace('http', 'ws');
    ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      ws.send(JSON.stringify({ type: 'auth', token }));
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === 'presence' && presenceCallback) {
          presenceCallback(msg.users);
        }
      } catch (e) {}
    };

    ws.onclose = () => {
      // Reconnect after 3 seconds
      setTimeout(connectPresence, 3000);
    };

    ws.onerror = () => {};
  }

  function onPresenceUpdate(callback) {
    presenceCallback = callback;
    connectPresence();
  }

  function disconnectPresence() {
    if (ws) {
      ws.close();
      ws = null;
    }
    presenceCallback = null;
  }

  // Auto-refresh user data on load
  document.addEventListener("DOMContentLoaded", async () => {
    if (isLoggedIn()) {
      try {
        await getMe();
      } catch {
        clearAuth();
      }
    }

    // Wire logout buttons
    document.querySelectorAll("[data-logout]").forEach(btn => {
      btn.addEventListener("click", async () => {
        await logout();
        location.replace("login.html");
      });
    });

    // Set username displays
    const uname = currentUsername();
    document.querySelectorAll("[data-username]").forEach(el => {
      if (uname) el.textContent = uname;
    });
  });

  // Storage sync: if token cleared in another tab, redirect
  window.addEventListener("storage", (e) => {
    if (e.key === TOKEN_KEY && !e.newValue) {
      const cur = location.pathname.split("/").pop();
      if (cur !== "login.html") location.replace("login.html");
    }
  });

  // Expose globally
  window.SanayaAuth = {
    SERVER_URL, TOKEN_KEY, USER_KEY,
    getToken, getUser, login, logout, register,
    getMe, isLoggedIn, requireAuth, currentUsername, currentRole, isAdmin,
    apiCall, onPresenceUpdate, disconnectPresence,
  };
})();
