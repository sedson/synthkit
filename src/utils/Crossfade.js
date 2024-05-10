/**
 * @file Crossfade modes.
 */
import { Operator } from '../core/Operator.js';
import { Signal } from '../utils/Signal.js';

export class Crossfade extends Operator {
  constructor(ctx, mix = 0.5, options) {
    super(ctx);
    this._a = new GainNode(this.ctx);
    this._b = new GainNode(this.ctx);
    this._mix = new Signal(this.ctx, mix);
    this._out = new GainNode(this.ctx);
    this.loadWorklet('crossfade');
  }

  init() {
    this._fader = this.createWorklet('crossfade', {
      numberOfInputs: 2,
      numberOfOutputs: 1,
    });
    this._mixParam = this._fader.parameters.get('mix');
    this._mix.connect(this._mixParam);
    this._a.connect(this._fader, 0, 0);
    this._b.connect(this._fader, 0, 1);
    this._fader.connect(this._out);
  }

  get mix() { return this._mix.current; }
  get inlet() { return this._a; }
  get inlet2() { return this._b; }
  get outlet() { return this._out; }
  get a() { return this._a; }
  get b() { return this._b; }
}