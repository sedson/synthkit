/**
 * @file Two matched biquad filter nodes in series to get steeped frequency 
 * responses.
 */
import { Operator } from '../core/Operator.js';
import { Signal } from '../utils/Signal.js';

export class Filter2 extends Operator {
  constructor(ctx, options = {}) {
    super(ctx, options);
    const freq = options.freq || 1200;
    const type = options.type || 'lowpass';
    const resonance = options.resonance || 1;

    this._freq = new Signal(ctx, freq);
    this._q = new Signal(ctx, resonance);

    this._filterStageA = new BiquadFilterNode(ctx, { frequency: 0, type: type, Q: 0 });
    this._filterStageB = new BiquadFilterNode(ctx, { frequency: 0, type: type, Q: 0 });

    this._q.connect(this._filterStageA.Q);
    this._q.connect(this._filterStageB.Q);

    this._freq.connect(this._filterStageA.frequency);
    this._freq.connect(this._filterStageB.frequency);

    this._filterStageA.connect(this._filterStageB);
  }

  get inlet() { return this._filterStageA; }
  get outlet() { return this._filterStageB; }
  get resonance() { return this._q.current; }
  get frequency() { return this._freq.current; }
  get Q() { return this._q.current; }
}