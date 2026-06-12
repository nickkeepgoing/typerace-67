// ============================================================
// profile.js — settings screen: avatar upload, change password,
// and the password-recovery (reset via email) flow
// ============================================================

import { supabase } from './supabase-client.js';
import { state, showScreen, toast } from './app.js';

const $ = id => document.getElementById(id);

const MAX_AVATAR_BYTES = 2 * 1024 * 1024; // 2 MB

// ---------- avatar helpers ----------

export function renderAvatar(imgEl, fallbackEl, size) {
  if (state.avatarUrl) {
    imgEl.src = state.avatarUrl;
    imgEl.classList.remove('hidden');
    if (fallbackEl) fallbackEl.classList.add('hidden');
  } else {
    imgEl.classList.add('hidden');
    if (fallbackEl) {
      fallbackEl.textContent = (state.username || '?').charAt(0).toUpperCase();
      fallbackEl.classList.remove('hidden');
    }
  }
}

export function refreshNavAvatar() {
  const img = $('nav-avatar');
  const fb = $('nav-avatar-fallback');
  if (!img || !fb) return;
  if (state.avatarUrl) {
    img.src = state.avatarUrl;
    img.classList.remove('hidden');
    fb.classList.add('hidden');
  } else {
    img.classList.add('hidden');
    fb.textContent = (state.username || '?').charAt(0).toUpperCase();
    fb.classList.remove('hidden');
  }
}

// ---------- settings screen ----------

export function openSettings(welcome = false) {
  $('settings-username').textContent = state.username;
  $('avatar-status').textContent = '';
  $('pass-status').textContent = '';
  $('new-password').value = '';
  renderAvatar($('settings-avatar'), $('settings-avatar-fallback'));

  // first-time welcome mode
  $('settings-welcome').classList.toggle('hidden', !welcome);
  $('settings-back-btn').textContent = welcome ? '▶ เริ่มเล่นเลย!' : '◀ กลับ Lobby';
  $('settings-back-btn').classList.toggle('btn-primary', welcome);
  $('settings-back-btn').classList.toggle('btn-ghost', !welcome);

  showScreen('settings');
}

async function onAvatarPicked(e) {
  const file = e.target.files?.[0];
  e.target.value = ''; // allow re-picking the same file
  if (!file) return;

  const status = $('avatar-status');

  if (!file.type.startsWith('image/')) {
    status.textContent = 'ไฟล์ต้องเป็นรูปภาพเท่านั้น';
    return;
  }
  if (file.size > MAX_AVATAR_BYTES) {
    status.textContent = 'รูปใหญ่เกิน 2 MB — ย่อรูปก่อนแล้วลองใหม่';
    return;
  }

  status.textContent = 'กำลังอัปโหลด…';
  try {
    const path = `${state.user.id}/avatar`;
    const { error: upErr } = await supabase.storage
      .from('avatars')
      .upload(path, file, { upsert: true, contentType: file.type, cacheControl: '3600' });
    if (upErr) throw upErr;

    const { data } = supabase.storage.from('avatars').getPublicUrl(path);
    const url = `${data.publicUrl}?v=${Date.now()}`; // bust old cache

    const { error: dbErr } = await supabase
      .from('profiles').update({ avatar_url: url }).eq('id', state.user.id);
    if (dbErr) throw dbErr;

    state.avatarUrl = url;
    renderAvatar($('settings-avatar'), $('settings-avatar-fallback'));
    refreshNavAvatar();
    status.textContent = 'เปลี่ยนรูปสำเร็จ ✓';
  } catch (err) {
    console.error(err);
    status.textContent = 'อัปโหลดไม่สำเร็จ — เช็คอินเทอร์เน็ตแล้วลองใหม่';
  }
}

// ---------- change password (logged in) ----------

async function onChangePassword() {
  const status = $('pass-status');
  const pass = $('new-password').value;
  if (pass.length < 6) { status.textContent = 'รหัสผ่านต้องยาวอย่างน้อย 6 ตัวอักษร'; return; }

  const btn = $('change-pass-btn');
  btn.disabled = true;
  status.textContent = 'กำลังบันทึก…';
  try {
    const { error } = await supabase.auth.updateUser({ password: pass });
    if (error) throw error;
    $('new-password').value = '';
    status.textContent = 'เปลี่ยนรหัสผ่านสำเร็จ ✓';
  } catch (err) {
    console.error(err);
    status.textContent = err.message?.includes('different')
      ? 'รหัสใหม่ต้องไม่ซ้ำกับรหัสเดิม'
      : 'บันทึกไม่สำเร็จ ลองใหม่อีกครั้ง';
  } finally {
    btn.disabled = false;
  }
}

// ---------- forgot password (from login screen) ----------

export async function sendResetEmail() {
  const email = $('login-email').value.trim();
  const msg = $('auth-message');
  if (!email) {
    msg.textContent = 'พิมพ์อีเมลในช่องด้านบนก่อน แล้วกดลืมรหัสผ่านอีกครั้ง';
    msg.className = 'auth-message error';
    return;
  }
  try {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin
    });
    if (error) throw error;
    msg.textContent = 'ส่งลิงก์รีเซ็ตไปที่อีเมลแล้ว — เปิดเมลแล้วกดลิงก์ได้เลย';
    msg.className = 'auth-message ok';
  } catch (err) {
    console.error(err);
    msg.textContent = 'ส่งอีเมลไม่สำเร็จ ลองใหม่อีกครั้ง';
    msg.className = 'auth-message error';
  }
}

// ---------- recovery screen (after clicking the email link) ----------

async function onRecoverySubmit(e) {
  e.preventDefault();
  const status = $('recovery-status');
  const pass = $('recovery-password').value;
  if (pass.length < 6) { status.textContent = 'รหัสผ่านต้องยาวอย่างน้อย 6 ตัวอักษร'; return; }

  status.textContent = 'กำลังตั้งรหัสใหม่…';
  try {
    const { error } = await supabase.auth.updateUser({ password: pass });
    if (error) throw error;
    toast('ตั้งรหัสผ่านใหม่สำเร็จ!');
    setTimeout(() => window.location.replace(window.location.origin), 800);
  } catch (err) {
    console.error(err);
    status.textContent = 'ตั้งรหัสไม่สำเร็จ — ลิงก์อาจหมดอายุ ขอลิงก์ใหม่อีกครั้ง';
  }
}

// ---------- init ----------

export function initProfile() {
  $('avatar-input').addEventListener('change', onAvatarPicked);
  $('change-pass-btn').addEventListener('click', onChangePassword);
  $('forgot-btn').addEventListener('click', sendResetEmail);
  $('form-recovery').addEventListener('submit', onRecoverySubmit);
}

