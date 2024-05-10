/**
 * @file Onepole LP and HP filters using the IIRFilterNode. For Feedback 
 * loops, these first order filters have the advantage of not being resonant - 
 * i.e. they cannot go above unity gain.
 * 
 * The onepoles require a new IIRFilterNode on any change of cutoff and therefore
 * should be used in places where infrequent and non-modulated changes to the 
 * cutoff frequncy are OK.
 * 
 * I grabbed the math from https://www.earlevel.com/main/2021/09/02/biquad-calculator-v3/
 * but swapped the coefficient names to match the IIRFilterNode documentation 
 * which uses As for the feedback coefficients and Bs for the feedforward.
 * 
 * LOWPASS
 * a1 = exp(-2 * PI * (Fc / Fs));
 * b0 = 1.0 - a1;
 * a1 = -a1;
 * 
 * HIGHPASS
 * a1 = -exp(-2 * PI * (0.5 - Fc / Fs));
 * b0 = 1.0 + b1;
 * a1 = -a1;
 */

import { Operator } from '../core/Operator.js';

export class OnePoleFilter extends Operator {
  constructor(ctx, options = {}) {
    super(ctx, options);
    this._frequency = options.frequency || 2400;

    this._inlet = new GainNode(this.ctx, this.channelSettings);
    this._outlet = new GainNode(this.ctx, this.channelSettings);

    this.type = options.type || 'lowpass';

    this._setFrequency(this._frequency);
  }

  get inlet() { return this._inlet; }
  get outlet() { return this._outlet; }


  _setFrequency(freq) {
    this._inlet.disconnect();
    if (this._filter) this._filter.disconnect();

    let a1, b0;

    if (this.type === 'highpass') {
      a1 = -Math.exp(-2 * Math.PI * (0.5 - (freq / this.ctx.sampleRate)));
      b0 = 1 + a1;
    } else {
      a1 = Math.exp(-2 * Math.PI * (freq / this.ctx.sampleRate));
      b0 = 1 - a1;
    }

    const feedback = [1, -a1];
    const feedforward = [b0, 0];

    this._filter = new IIRFilterNode(this.ctx, { feedforward, feedback, ...this.channelSettings });
    this._inlet.connect(this._filter).connect(this._outlet);
  }

  set frequency(freq) {
    this._frequency = freq;
    this._setFrequency(this._frequency);
  }
}