/* 门页解密：PBKDF2-SHA256 派生密钥 → AES-256-GCM 解密受保护页面
 *
 * 页面内联 window.__ENC = { iter, salt, iv, data }（base64）。
 * 密钥 = PBKDF2(账号 + \u001f + 密码, salt, iter, 32B)，因此账号与密码都必须正确。
 * 登录成功后把「派生密钥」放进 sessionStorage，同一标签页内翻其他加密页免重复输入；
 * 密码本身不会被存储，关闭标签页即失效。
 */
(function () {
  'use strict';

  var SEP = '\u001f';
  var KEY_STORE = 'site.key';
  var USER_STORE = 'site.user';
  var enc = window.__ENC || null;

  function b64ToBytes(s) {
    var bin = atob(s), out = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }
  function bytesToB64(bytes) {
    var s = '';
    for (var i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
    return btoa(s);
  }

  function deriveBits(user, pass) {
    var subtle = crypto.subtle;
    var raw = new TextEncoder().encode(user + SEP + pass);
    return subtle.importKey('raw', raw, 'PBKDF2', false, ['deriveBits'])
      .then(function (base) {
        return subtle.deriveBits(
          { name: 'PBKDF2', salt: b64ToBytes(enc.salt), iterations: enc.iter, hash: 'SHA-256' },
          base, 256
        );
      })
      .then(function (bits) { return new Uint8Array(bits); });
  }

  function decryptWithBits(bits) {
    var subtle = crypto.subtle;
    return subtle.importKey('raw', bits, 'AES-GCM', false, ['decrypt'])
      .then(function (key) {
        return subtle.decrypt(
          { name: 'AES-GCM', iv: b64ToBytes(enc.iv), tagLength: 128 },
          key, b64ToBytes(enc.data)
        );
      })
      .then(function (buf) { return new TextDecoder().decode(buf); });
  }

  /* 账号或密码错误时 WebCrypto 抛 OperationError */
  function decrypt(user, pass) {
    if (!enc) return Promise.reject(new Error('missing payload'));
    if (!crypto.subtle) return Promise.reject(new Error('insecure context'));
    return deriveBits(user, pass).then(function (bits) {
      return decryptWithBits(bits).then(function (html) {
        return { html: html, bits: bits };
      });
    });
  }

  function render(html) {
    document.open();
    document.write(html);
    document.close();
  }

  function boot() {
    var form = document.getElementById('gateForm');
    if (!form) return;
    var u = document.getElementById('u');
    var p = document.getElementById('p');
    var btn = document.getElementById('go');
    var msg = document.getElementById('msg');

    function fail(text) {
      btn.disabled = false;
      p.value = '';
      msg.className = 'gate-msg';
      msg.textContent = text;
      p.focus();
    }

    try {
      var savedUser = localStorage.getItem(USER_STORE);
      if (savedUser && !u.value) u.value = savedUser;
    } catch (e) { /* 隐私模式忽略 */ }

    /* 同一标签页内已经登录过：直接用会话密钥解密 */
    var sessionKey = null;
    try { sessionKey = sessionStorage.getItem(KEY_STORE); } catch (e) { /* 忽略 */ }
    if (sessionKey) {
      btn.disabled = true;
      msg.className = 'gate-msg';
      msg.textContent = '正在解锁…';
      decryptWithBits(b64ToBytes(sessionKey)).then(render).catch(function () {
        try { sessionStorage.removeItem(KEY_STORE); } catch (e) { /* 忽略 */ }
        btn.disabled = false;
        msg.textContent = '';
      });
      return;
    }

    form.addEventListener('submit', function (ev) {
      ev.preventDefault();
      var user = (u.value || '').trim();
      var pass = p.value || '';
      if (!user || !pass) {
        msg.className = 'gate-msg';
        msg.textContent = '请填写账号和密码';
        return;
      }
      btn.disabled = true;
      msg.className = 'gate-msg';
      msg.textContent = '正在验证…';

      decrypt(user, pass).then(function (res) {
        try {
          localStorage.setItem(USER_STORE, user);
          sessionStorage.setItem(KEY_STORE, bytesToB64(res.bits));
        } catch (e) { /* 忽略 */ }
        render(res.html);
      }).catch(function () {
        fail('账号或密码不正确');
      });
    });

    if (!crypto.subtle) {
      msg.textContent = '当前环境不支持 Web Crypto，请用 https 或 localhost 访问';
      btn.disabled = true;
    }
  }

  /* 供调试与自动化校验使用 */
  window.__decrypt = decrypt;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
