// ============================================================
// auth.js — register / login / logout
// ============================================================

import { supabase } from './supabase-client.js';
import { state, enterLobby, exitToAuth } from './app.js';
import { openSettings } from './profile.js';

const $ = id => document.getElementById(id);

function setMessage(text, kind = 'error') {
  const el = $('auth-message');
  el.textContent = text;
  el.className = `auth-message ${text ? kind : ''}`;
}

function setBusy(btn, busy, busyLabel, idleLabel) {
  btn.disabled = busy;
  btn.textContent = busy ? busyLabel : idleLabel;
}

function friendlyAuthError(error) {
  const msg = (error?.message || '').toLowerCase();
  if (msg.includes('invalid login credentials')) return 'Wrong email or password.';
  if (msg.includes('already registered'))        return 'This email is already registered — try logging in.';
  if (msg.includes('rate limit'))                return 'Too many attempts. Wait a minute and try again.';
  if (msg.includes('failed to fetch') || msg.includes('network'))
    return 'Network error — check your connection and try again.';
  return error?.message || 'Something went wrong. Please try again.';
}

// ---------- register ----------
async function handleRegister(e) {
  e.preventDefault();
  setMessage('');
  const email = $('reg-email').value.trim();
  const username = $('reg-username').value.trim();
  const password = $('reg-password').value;
  const btn = $('register-submit');

  setBusy(btn, true, 'Creating…', 'Create account');
  try {
    // 1) username availability check (fast feedback before creating the auth user)
    const { data: taken, error: checkErr } = await supabase
      .from('profiles').select('id').eq('username', username).maybeSingle();
    if (checkErr) throw checkErr;
    if (taken) { setMessage('That username is taken — pick another.'); return; }

    // 2) create the auth user (username stashed in metadata as a fallback)
    const { data, error } = await supabase.auth.signUp({
      email, password,
      options: { data: { username } }
    });
    if (error) { setMessage(friendlyAuthError(error)); return; }

    // 3) if email confirmation is ON in your project, there is no session yet
    if (!data.session) {
      setMessage('Account created! Check your email to confirm, then log in.', 'ok');
      switchTab('login');
      return;
    }

    // 4) insert the profile row
    const { error: profErr } = await supabase
      .from('profiles').insert({ id: data.user.id, username });
    if (profErr) {
      if (profErr.code === '23505') { setMessage('That username was just taken — log in and contact support, or use a new email.'); return; }
      throw profErr;
    }

    state.user = data.user;
    state.username = username;
    await enterLobby();
    openSettings(true); // first time here — invite them to set a profile picture
  } catch (err) {
    console.error(err);
    setMessage(friendlyAuthError(err));
  } finally {
    setBusy(btn, false, 'Creating…', 'Create account');
  }
}

// ---------- login ----------
async function handleLogin(e) {
  e.preventDefault();
  setMessage('');
  const email = $('login-email').value.trim();
  const password = $('login-password').value;
  const btn = $('login-submit');

  setBusy(btn, true, 'Logging in…', 'Log in');
  try {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) { setMessage(friendlyAuthError(error)); return; }

    state.user = data.user;

    // fetch (or create) the profile
    const { data: profile, error: profErr } = await supabase
      .from('profiles').select('username, avatar_url').eq('id', data.user.id).maybeSingle();
    if (profErr) throw profErr;

    if (profile) {
      state.username = profile.username;
      state.avatarUrl = profile.avatar_url || null;
    } else {
      const uname = data.user.user_metadata?.username
        || email.split('@')[0].replace(/[^A-Za-z0-9_]/g, '_').slice(0, 20);
      const { error: insErr } = await supabase.from('profiles').insert({ id: data.user.id, username: uname });
      if (insErr && insErr.code !== '23505') throw insErr;
      state.username = uname;
      await enterLobby();
      openSettings(true); // profile just created — first login, show welcome
      return;
    }

    await enterLobby();
  } catch (err) {
    console.error(err);
    setMessage(friendlyAuthError(err));
  } finally {
    setBusy(btn, false, 'Logging in…', 'Log in');
  }
}

// ---------- logout ----------
export async function logout() {
  try { await supabase.auth.signOut(); }
  catch (err) { console.error(err); }
  exitToAuth();
}

// ---------- tabs ----------
function switchTab(which) {
  $('tab-login').classList.toggle('active', which === 'login');
  $('tab-register').classList.toggle('active', which === 'register');
  $('form-login').classList.toggle('hidden', which !== 'login');
  $('form-register').classList.toggle('hidden', which !== 'register');
  setMessage('');
}

// ---------- init ----------
export function initAuth() {
  $('tab-login').addEventListener('click', () => switchTab('login'));
  $('tab-register').addEventListener('click', () => switchTab('register'));
  $('form-login').addEventListener('submit', handleLogin);
  $('form-register').addEventListener('submit', handleRegister);
}
