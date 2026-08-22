/* =========================================================
   昆布在庫管理
   Supabase Auth v159
   ---------------------------------------------------------
   ・既存アプリ本体には極力干渉しない
   ・未ログイン時はログイン画面を全面表示
   ・ログイン成功後は通常アプリを表示
   ・Supabaseのセッションはブラウザ側で保持
   ========================================================= */

(function () {
  'use strict';

  function ready() {
    return document.readyState === 'loading'
      ? new Promise(function (resolve) {
          document.addEventListener('DOMContentLoaded', resolve, { once: true });
        })
      : Promise.resolve();
  }

  function getClient() {
    return window.kombuSupabase || null;
  }

  function removeLoginScreen() {
    var old = document.getElementById('kombuSupabaseLogin');
    if (old) old.remove();
  }

  function createStyles() {
    if (document.getElementById('kombuSupabaseAuthStyle')) return;

    var style = document.createElement('style');
    style.id = 'kombuSupabaseAuthStyle';

    style.textContent = `
      #kombuSupabaseLogin{
        position:fixed;
        inset:0;
        z-index:99999;
        background:#f4f7fb;
        display:flex;
        align-items:center;
        justify-content:center;
        padding:20px;
        box-sizing:border-box;
      }

      #kombuSupabaseLogin .ksa-card{
        width:min(430px,100%);
        background:#fff;
        border-radius:20px;
        padding:24px;
        box-shadow:0 8px 30px rgba(0,0,0,.12);
      }

      #kombuSupabaseLogin h2{
        margin:0 0 6px;
        text-align:center;
        color:#102a43;
        font-size:22px;
      }

      #kombuSupabaseLogin .ksa-sub{
        text-align:center;
        color:#627d98;
        font-size:13px;
        margin-bottom:20px;
      }

      #kombuSupabaseLogin label{
        display:block;
        margin-top:12px;
        color:#102a43;
        font-weight:700;
        font-size:14px;
      }

      #kombuSupabaseLogin input{
        width:100%;
        margin-top:5px;
        padding:13px;
        border:1px solid #ccd6e2;
        border-radius:10px;
        box-sizing:border-box;
        font-size:16px;
        background:#fff;
      }

      #kombuSupabaseLogin button{
        width:100%;
        margin-top:18px;
        padding:14px;
        border:0;
        border-radius:11px;
        background:#0b2b55;
        color:#fff;
        font-size:16px;
        font-weight:700;
        cursor:pointer;
      }

      #kombuSupabaseLogin button:disabled{
        opacity:.55;
        cursor:default;
      }

      #kombuSupabaseLogin .ksa-msg{
        min-height:20px;
        margin-top:12px;
        text-align:center;
        font-size:13px;
        color:#b42318;
      }

      #kombuSupabaseLogin .ksa-note{
        margin-top:16px;
        font-size:11px;
        color:#627d98;
        text-align:center;
      }

      #kombuSupabaseStatus{
        position:fixed;
        right:10px;
        top:10px;
        z-index:9998;
        font-size:11px;
        background:rgba(255,255,255,.9);
        color:#627d98;
        border-radius:999px;
        padding:4px 8px;
        display:none;
      }
    `;

    document.head.appendChild(style);
  }

  function showLoginScreen() {
    removeLoginScreen();
    createStyles();

    var wrap = document.createElement('div');
    wrap.id = 'kombuSupabaseLogin';

    wrap.innerHTML = `
      <div class="ksa-card">
        <h2>昆布在庫管理</h2>
        <div class="ksa-sub">送り状PDF連携 ログイン</div>

        <form id="kombuSupabaseLoginForm">
          <label>
            メールアドレス
            <input
              id="kombuSupabaseEmail"
              type="email"
              autocomplete="username"
              required
            >
          </label>

          <label>
            パスワード
            <input
              id="kombuSupabasePassword"
              type="password"
              autocomplete="current-password"
              required
            >
          </label>

          <button id="kombuSupabaseLoginBtn" type="submit">
            ログイン
          </button>

          <div id="kombuSupabaseLoginMsg" class="ksa-msg"></div>
        </form>

        <div class="ksa-note">
          登録済みの管理者アカウントでログインしてください。
        </div>
      </div>
    `;

    document.body.appendChild(wrap);

    var form = document.getElementById('kombuSupabaseLoginForm');
    var email = document.getElementById('kombuSupabaseEmail');
    var password = document.getElementById('kombuSupabasePassword');
    var button = document.getElementById('kombuSupabaseLoginBtn');
    var msg = document.getElementById('kombuSupabaseLoginMsg');

    form.addEventListener('submit', async function (event) {
      event.preventDefault();

      var client = getClient();

      if (!client) {
        msg.textContent = 'Supabaseへ接続できません。';
        return;
      }

      button.disabled = true;
      button.textContent = 'ログイン中…';
      msg.textContent = '';

      try {
        var result = await client.auth.signInWithPassword({
          email: email.value.trim(),
          password: password.value
        });

        if (result.error) {
          msg.textContent = 'メールアドレスまたはパスワードを確認してください。';
          return;
        }

        if (result.data && result.data.session) {
          removeLoginScreen();
          window.dispatchEvent(
            new CustomEvent('kombu:supabase-login', {
              detail: {
                user: result.data.user || null
              }
            })
          );
        }

      } catch (error) {
        console.error('Supabase login error:', error);
        msg.textContent = 'ログイン処理でエラーが発生しました。';

      } finally {
        button.disabled = false;
        button.textContent = 'ログイン';
      }
    });
  }

  async function initializeAuth() {
    await ready();

    var client = getClient();

    if (!client) {
      console.warn(
        'Supabase client is not ready. Auth screen was not started.'
      );
      return;
    }

    try {
      var result = await client.auth.getSession();

      if (
        result &&
        result.data &&
        result.data.session
      ) {
        removeLoginScreen();

        window.dispatchEvent(
          new CustomEvent('kombu:supabase-login', {
            detail: {
              user: result.data.session.user || null
            }
          })
        );

      } else {
        showLoginScreen();
      }

      client.auth.onAuthStateChange(function (event, session) {
        if (event === 'SIGNED_IN' && session) {
          removeLoginScreen();
        }

        if (event === 'SIGNED_OUT') {
          showLoginScreen();
        }
      });

    } catch (error) {
      console.error('Supabase auth initialization error:', error);
      showLoginScreen();
    }
  }

  window.kombuSupabaseLogout = async function () {
    var client = getClient();
    if (!client) return;

    try {
      await client.auth.signOut();
    } catch (error) {
      console.error('Supabase logout error:', error);
    }
  };

  initializeAuth();

})();
