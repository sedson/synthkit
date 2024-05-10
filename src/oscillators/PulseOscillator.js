/**
 * @file A pulse-wave operator with variable duty cycle/width.
 */
import { Oscillator } from './Oscillator.js';
import { Signal } from '../utils/Signal.js';

/**
 * @class Pulse oscillator with a variable pulse width.
 */
export class PulseOscillator extends Oscillator {
  constructor(ctx, options = {}) {
    super(ctx, options);
    this._oscillator.disconnect();

    this.shape = 'pulse';

    // Wave shaper curve squishes a sine wave into a square.
    this._curve = new Float32Array(8).map((a, n) => n < 4 ? -1 : 1);
    this._shaper = new WaveShaperNode(ctx, {
      curve: this._curve,
      overSample: 'none',
    });

    // Audio param for the pulse width.
    this._width = new Signal(ctx, 0);

    // Sum the wave with the width, then squish and scale.
    this._sum = new GainNode(ctx);

    this._oscillator.connect(this._sum);
    this._width.connect(this._sum);

    this._sum
      .connect(this._shaper)
      .connect(this._gain);
  }

  get width() { return this._width.current; }
}