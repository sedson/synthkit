/**
 * @file Two matched biquad filter nodes in series to get steeped frequency 
 * responses.
 */
import { Operator } from '../core/Operator.js';
import { Signal } from '../utils/Signal.js';
import { Gain } from '../utils/Gain.js';


export class StateVariableFilter extends Operator {
  constructor(ctx, options = {}) {
    super(ctx, options);
    const freq = options.freq || 1200;
    const Q = options.Q || 1;

    this._inlet = new GainNode(this.ctx);

    this._lp = new Gain(this.ctx);
    this._bp = new Gain(this.ctx);
    this._hp = new Gain(this.ctx);

    this._frequency = new Signal(this.ctx, freq);
    this._q = new Signal(this.ctx, Q);

    this.loadWorklet('state-variable-filter');
  }

  init() {
    this._filter = this.createWorklet('state-variable-filter', {
      numberOfInputs: 1,
      numberOfOutputs: 3,
    });
    this._frequencyParam = this._filter.parameters.get('frequency');
    this._Qparam = this._filter.parameters.get('Q');
    this._frequencyParam.value = 0;
    this._Qparam.value = 0;

    this._inlet.connect(this._filter);
    this._filter.connect(this._lp.inlet, 0);
    this._filter.connect(this._hp.inlet, 1);
    this._filter.connect(this._bp.inlet, 2);

    this._frequency.connect(this._frequencyParam);
    this._q.connect(this._Qparam);
  }

  disconnect(target) {
    this.lowpass.disconnect(target);
    this.highpass.disconnect(target);
    this.bandpass.disconnect(target);
    return this;
  }

  get inlet() { return this._inlet; }
  get outlet() { return this._lp; }
  get frequency() { return this._frequency.current; }
  get resonance() { return this._q.current; }
  get Q() { return this._q.current; }
  get lowpass() { return this._lp; }
  get bandpass() { return this._bp; }
  get highpass() { return this._hp; }
}