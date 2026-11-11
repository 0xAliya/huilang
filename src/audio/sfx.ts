/** 五声音阶（C 宫），机关按状态升调。 */
const PENTATONIC = [261.63, 293.66, 329.63, 392.0, 440.0, 523.25];

/** Web Audio 合成音效。首次用户点击后调用 unlock() 才会出声。 */
export class Sfx {
  muted = false;
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;

  unlock(): void {
    if (!this.ctx) {
      const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return;
      this.ctx = new Ctor();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 1;
      this.master.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    if (this.master && this.ctx) this.master.gain.setTargetAtTime(muted ? 0 : 1, this.ctx.currentTime, 0.02);
  }

  private tone(freq: number, dur: number, type: OscillatorType, gain: number, delay = 0, slideTo?: number): void {
    if (!this.ctx || !this.master) return;
    const t = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    const env = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    env.gain.setValueAtTime(0.0001, t);
    env.gain.exponentialRampToValueAtTime(gain, t + 0.015);
    env.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(env).connect(this.master);
    osc.start(t);
    osc.stop(t + dur + 0.05);
  }

  step(): void {
    this.tone(540 + Math.random() * 80, 0.07, 'triangle', 0.05);
  }

  mech(state: number): void {
    const f = PENTATONIC[state % PENTATONIC.length];
    this.tone(f, 0.6, 'sine', 0.2);
    this.tone(f * 2, 0.35, 'triangle', 0.05, 0.06);
  }

  deny(): void {
    this.tone(120, 0.28, 'sine', 0.22, 0, 82);
  }

  win(): void {
    [261.63, 329.63, 392.0, 523.25, 659.25].forEach((f, i) => {
      this.tone(f, 1.4 - i * 0.12, 'sine', 0.14, i * 0.11);
      this.tone(f * 2, 0.6, 'triangle', 0.03, i * 0.11);
    });
  }
}
