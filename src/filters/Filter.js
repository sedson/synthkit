/**
 * @file Light wrapper for the default Biquad filter node.
 */

import { Operator } from '../core/Operator.js';
import { Signal } from '../utils/Signal.js';

export class Filter extends Operator {
  constructor(ctx, options = {}) {
    super(ctx, options);
    const freq = options.freq || 1200;
    const type = options.type || 'lowpass';
    const q = options.q || 1;
    this._filter = new BiquadFilterNode(ctx, { frequency: freq, type: type, Q: q });
  }

  get inlet() { return this._filter; }
  get outlet() { return this._filter; }
  get frequency() { return this._filter.frequency }
  get resonance() { return this._filter.Q; }
  get Q() { return this._filter.Q; }
}