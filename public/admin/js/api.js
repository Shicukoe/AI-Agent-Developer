/* Helper gọi admin API: đính token (localStorage), tự chuyển về login khi 401. */
(function (global) {
  'use strict';

  var TOKEN_KEY = 'ap_admin_token';

  function getToken() { return localStorage.getItem(TOKEN_KEY) || ''; }
  function setToken(t) { localStorage.setItem(TOKEN_KEY, t); }
  function clearToken() { localStorage.removeItem(TOKEN_KEY); }

  function gotoLogin() {
    if (!/login\.html$/.test(location.pathname)) location.href = 'login.html';
  }

  async function request(method, path, body) {
    var res = await fetch('/admin/api' + path, {
      method: method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + getToken(),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (res.status === 401) { clearToken(); gotoLogin(); throw new Error('Unauthorized'); }
    var data = null;
    try { data = await res.json(); } catch (e) { /* no body */ }
    if (!res.ok) throw new Error((data && data.error) || ('HTTP ' + res.status));
    return data;
  }

  global.AdminApi = {
    getToken: getToken,
    setToken: setToken,
    clearToken: clearToken,
    gotoLogin: gotoLogin,
    requireAuth: function () { if (!getToken()) gotoLogin(); },
    get: function (path) { return request('GET', path); },
    post: function (path, body) { return request('POST', path, body); },
    put: function (path, body) { return request('PUT', path, body); },
    del: function (path) { return request('DELETE', path); },
  };
})(window);
