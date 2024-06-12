import * as sk from './map.js';
import { setupWorkletContext } from './worklets/WorkletManager.js';
export { sk };


/*
 * 
 */
export class SynthKit {
  constructor(options = {}) {
    this.ctx = new AudioContext();
    this.dac = new sk.Gain(this.ctx, 0.5);
    this.dac.connect(this.ctx.destination);

    if (this.release) {
      const path = options.pathToWorklets || '/dist/worklets.js';
      setupWorkletContext(this.ctx, path);
    } else {
      setupWorkletContext(this.ctx);
    }
  }

  get now() {
    return this.ctx.currentTime;
  }

  resume() {
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  operator(options) {
    return new sk.Operator(this.ctx, options);
  }

  oscillator(options) {
    return new sk.Oscillator(this.ctx, options);
  }

  pulseOscillator(options) {
    return new sk.PulseOscillator(this.ctx, options);
  }

  signal(val) {
    return new sk.Signal(this.ctx, val);
  }

  gain(val) {
    return new sk.Gain(this.ctx, val);
  }

  /**
   * Make a VCA.
   * @param {Operator} signal the input signal
   * @param {Opearator} voltage the control voltage – likely an envelope.
   * @returns {Gain} A gain node the multiplies the the signal and voltage.
   */
  vca(signal, voltage) {
    const g = new sk.Gain(this.ctx, 0);
    signal.connect(g);
    voltage.connect(g.gain);
    return g;
  }

  randomSource(steps, length) {
    return new sk.RandomSource(this.ctx, steps, length);
  }

  adsr(adsr) {
    const [attack, decay, sustain, release] = adsr;
    return new sk.Envelope2(this.ctx, {
      type: 'ADSR',
      attack,
      decay,
      sustain,
      release
    });
  }

  asr(asr) {
    const [attack, sustain, release] = asr;
    return new sk.Envelope2(this.ctx, {
      type: 'ASR',
      attack,
      sustain,
      release
    });
  }


}