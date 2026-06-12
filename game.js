// ============================================================
// game.js — "67" speed game
// Countdown 3-2-1-GO → type "67" → press Enter → time recorded.
// Timer runs from GO until Enter is pressed with exactly "67".
// ============================================================

import { supabase } from './supabase-client.js';
import { state, showScreen, sound, toast, enterLobby } from './app.js';
import { fetchRank } from './leaderboard.js';

const $ = id => document.getElementById(id);

const TARGET = '67';
const SENTENCE_ID = 0; // kept for DB compatibility (scores.sentence_id)

let round = null; // { startTime, timerInterval, finished, live }
let countdownTimers = [];

// ---------- round start ----------
export function startRound() {
  clearCountdown();
  stopTimer();
  round = { startTime: null, timerInterval: null, finished: false, live: false, prevLen: 0 };

  const input = $('typing-input');
  input.value = '';
  input.disabled = false; // keep enabled so the mobile keyboard is already open at GO!
  input.classList.remove('ready', 'wrong');

  $('timer').innerHTML = '0<span class="timer-unit">ms</span>';
  $('timer').classList.remove('pulse-fast');
  $('submit-overlay').classList.add('hidden');

  showScreen('game');
  requestAnimationFrame(() => input.focus()); // keyboard slides up NOW, not at GO

  // countdown: 3 → 2 → 1 → GO! (fast)
  const STEP_MS = 500;
  const display = $('sentence-display');
  const steps = ['3', '2', '1'];
  display.className = 'sentence target-display counting';
  steps.forEach((n, i) => {
    countdownTimers.push(setTimeout(() => {
      display.textContent = n;
      sound.tick();
    }, i * STEP_MS));
  });
  countdownTimers.push(setTimeout(go, steps.length * STEP_MS));
}

function go() {
  if (!round) return;
  round.live = true;
  round.startTime = performance.now();

  const display = $('sentence-display');
  display.className = 'sentence target-display go';
  display.innerHTML = 'พิมพ์ <span class="target-num">67</span> + Enter!';

  const input = $('typing-input');
  input.value = ''; // wipe any false-start keystrokes
  round.prevLen = 0;
  input.focus();

  round.timerInterval = setInterval(() => {
    const ms = Math.floor(performance.now() - round.startTime);
    $('timer').innerHTML = `${ms.toLocaleString()}<span class="timer-unit">ms</span>`;
  }, 10);
  $('timer').classList.add('pulse-fast');
}

function clearCountdown() {
  countdownTimers.forEach(t => clearTimeout(t));
  countdownTimers = [];
}

function stopTimer() {
  if (round?.timerInterval) { clearInterval(round.timerInterval); round.timerInterval = null; }
}

function abortRound() {
  clearCountdown();
  stopTimer();
  round = null;
  enterLobby();
}

// ---------- typing ----------
function onInput() {
  if (!round || round.finished) return;
  const input = $('typing-input');

  // false start: typed during countdown → wipe it, doesn't count
  if (!round.live) { input.value = ''; return; }

  const typed = input.value;

  // sound feedback per keystroke
  if (typed.length > round.prevLen) {
    const i = typed.length - 1;
    if (typed[i] === TARGET[i]) sound.tick();
    else sound.error();
  }
  round.prevLen = typed.length;

  // visual: cyan glow when it reads exactly "67", red flash when wrong
  input.classList.toggle('ready', typed === TARGET);
  input.classList.toggle('wrong', typed.length > 0 && !TARGET.startsWith(typed));
}

function onKeydown(e) {
  if (e.key !== 'Enter' || !round || !round.live || round.finished) return;
  e.preventDefault();

  const input = $('typing-input');
  if (input.value === TARGET) {
    finishRound();
  } else {
    sound.error();
    input.classList.add('wrong');
    setTimeout(() => input.classList.remove('wrong'), 300);
  }
}

// ---------- finish + save ----------
async function finishRound() {
  if (!round || round.finished) return;
  round.finished = true;

  const timeMs = Math.max(1, Math.round(performance.now() - round.startTime));
  stopTimer();
  $('timer').classList.remove('pulse-fast');
  $('timer').innerHTML = `${timeMs.toLocaleString()}<span class="timer-unit">ms</span>`;
  $('typing-input').disabled = true;

  sound.fanfare();
  $('overlay-ms').textContent = timeMs.toLocaleString();
  $('submit-overlay').classList.remove('hidden');

  let saved = true;
  try {
    const { error } = await supabase.from('scores').insert({
      user_id: state.user.id,
      username: state.username,
      time_ms: timeMs,
      sentence_id: SENTENCE_ID
    });
    if (error) throw error;
  } catch (err) {
    saved = false;
    console.error(err);
    toast('บันทึกคะแนนไม่สำเร็จ — เช็คอินเทอร์เน็ตแล้วลองใหม่');
  }

  setTimeout(() => showResult(timeMs, saved), 1500);
}

// ---------- result screen ----------
async function showResult(timeMs, saved) {
  showScreen('result');

  // count-up animation 0 → timeMs
  const el = $('result-time');
  const dur = 900;
  const t0 = performance.now();
  (function step(now) {
    const k = Math.min(1, (now - t0) / dur);
    const eased = 1 - Math.pow(1 - k, 3);
    el.textContent = Math.round(timeMs * eased).toLocaleString();
    if (k < 1) requestAnimationFrame(step);
  })(t0);

  const prevBest = state.personalBest;
  const pbEl = $('result-pb');
  if (prevBest === null || timeMs < prevBest) {
    pbEl.textContent = 'New personal best! 🏆';
    state.personalBest = timeMs;
  } else {
    pbEl.textContent = `Your best: ${prevBest.toLocaleString()} ms`;
  }

  const rankEl = $('result-rank');
  rankEl.textContent = saved ? 'Calculating global rank…' : 'Score not saved — rank unavailable.';
  if (saved) {
    try {
      const { rank, total } = await fetchRank(timeMs);
      rankEl.textContent = `You ranked #${rank} out of ${total} player${total === 1 ? '' : 's'}`;
    } catch (err) {
      console.error(err);
      rankEl.textContent = 'Rank unavailable right now.';
    }
  }
}

// ---------- init ----------
export function initGame() {
  $('typing-input').addEventListener('input', onInput);
  $('typing-input').addEventListener('keydown', onKeydown);
  $('abort-btn').addEventListener('click', abortRound);

  $('typing-input').addEventListener('paste', e => {
    e.preventDefault();
    sound.error();
    toast('ห้ามวาง! พิมพ์เองสิครับ 😉');
  });
}

