export type SoundName =
  | 'dig'
  | 'break'
  | 'place'
  | 'hit'
  | 'kill'
  | 'hurt'
  | 'pickup'
  | 'craft'
  | 'jump'
  | 'shoot'
  | 'chest'
  | 'boss'
  | 'die';

let actx: AudioContext | null = null;
let master: GainNode | null = null;
let lastPlayed: Record<string, number> = {};

/** Browsers only allow audio after a user gesture, so this is called from the first input. */
export function initAudio(): void {
  if (!actx) {
    actx = new AudioContext();
    master = actx.createGain();
    master.gain.value = 0.22;
    master.connect(actx.destination);
  }
  if (actx.state === 'suspended') void actx.resume();
}

function tone(freq: number, dur: number, type: OscillatorType, gain: number, slideTo?: number): void {
  if (!actx || !master) return;
  const osc = actx.createOscillator();
  const env = actx.createGain();
  const t = actx.currentTime;
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  if (slideTo !== undefined) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t + dur);
  env.gain.setValueAtTime(0.0001, t);
  env.gain.exponentialRampToValueAtTime(gain, t + 0.008);
  env.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(env).connect(master);
  osc.start(t);
  osc.stop(t + dur + 0.02);
}

function noise(dur: number, cutoff: number, gain: number): void {
  if (!actx || !master) return;
  const t = actx.currentTime;
  const frames = Math.floor(actx.sampleRate * dur);
  const buffer = actx.createBuffer(1, frames, actx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < frames; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / frames);
  const src = actx.createBufferSource();
  src.buffer = buffer;
  const filter = actx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = cutoff;
  const env = actx.createGain();
  env.gain.value = gain;
  src.connect(filter).connect(env).connect(master);
  src.start(t);
}

export function playSound(name: SoundName): void {
  if (!actx) return;
  const now = actx.currentTime;
  // Mining fires every frame while held, so rate-limit the repetitive cues.
  const throttle = name === 'dig' ? 0.09 : name === 'hit' ? 0.05 : 0;
  if (throttle && now - (lastPlayed[name] ?? -1) < throttle) return;
  lastPlayed[name] = now;

  switch (name) {
    case 'dig':
      noise(0.07, 1400, 0.5);
      break;
    case 'break':
      noise(0.16, 900, 0.8);
      tone(180, 0.12, 'triangle', 0.12, 90);
      break;
    case 'place':
      tone(320, 0.08, 'square', 0.09, 240);
      break;
    case 'hit':
      tone(420, 0.09, 'square', 0.14, 180);
      noise(0.06, 2600, 0.25);
      break;
    case 'kill':
      tone(240, 0.24, 'sawtooth', 0.16, 70);
      noise(0.2, 1200, 0.4);
      break;
    case 'hurt':
      tone(300, 0.28, 'sawtooth', 0.2, 90);
      break;
    case 'pickup':
      tone(680, 0.07, 'triangle', 0.1, 980);
      break;
    case 'craft':
      tone(520, 0.09, 'triangle', 0.12);
      setTimeout(() => tone(780, 0.12, 'triangle', 0.12), 70);
      break;
    case 'jump':
      tone(340, 0.09, 'sine', 0.08, 560);
      break;
    case 'shoot':
      noise(0.09, 3200, 0.3);
      tone(880, 0.07, 'sine', 0.07, 420);
      break;
    case 'chest':
      tone(400, 0.1, 'triangle', 0.1, 620);
      break;
    case 'boss':
      tone(90, 0.9, 'sawtooth', 0.28, 45);
      noise(0.7, 500, 0.5);
      break;
    case 'die':
      tone(400, 0.7, 'sawtooth', 0.24, 60);
      break;
  }
}
