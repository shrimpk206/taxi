// Web Audio API로 효과음을 생성. mp3 파일 없음.
// - bump()    : 요금 100원 올라갈 때의 짧은 "띡"
// - surcharge(): 할증 구간 진입 시 낮고 둔탁한 톤

let ctx = null;
let muted = false;

function ensureCtx() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  }
  // 모바일에선 사용자 제스처 이후 resume 필요
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  return ctx;
}

function beep({ freq = 440, durationMs = 40, type = 'sine', volume = 0.08 }) {
  if (muted) return;
  const c = ensureCtx();
  if (!c) return;

  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  gain.gain.value = volume;

  // 클릭 노이즈 방지용 페이드
  const now = c.currentTime;
  gain.gain.setValueAtTime(0, now);
  gain.gain.linearRampToValueAtTime(volume, now + 0.005);
  gain.gain.linearRampToValueAtTime(0, now + durationMs / 1000);

  osc.connect(gain).connect(c.destination);
  osc.start(now);
  osc.stop(now + durationMs / 1000 + 0.02);
}

export function bump() {
  beep({ freq: 880, durationMs: 40, type: 'square', volume: 0.06 });
}

export function surcharge() {
  beep({ freq: 180, durationMs: 220, type: 'sawtooth', volume: 0.12 });
}

export function setMuted(flag) {
  muted = !!flag;
}

export function isMuted() {
  return muted;
}

// 사용자 제스처에서 한 번 호출해 AudioContext를 깨운다.
export function primeAudio() {
  ensureCtx();
}
