/**
 * @file Implements a 1in 3out state variable filter.
 * Implementation based on pages 184 - 190 of Graham Wakefield and Gregory 
 * Taylor's "Generating Sounf & Organizing Time".
 */

import { BaseWorklet } from './BaseWorklet.processor.js';

class StateVariableFilter extends BaseWorklet {
  constructor(options = {}) {
    super(options);

    this.frame = 0;

    /** 
     * A buffer of two history values. One 2-elem array per channel.
     */
    this.history = [];
  }


  static get parameterDescriptors() {
    return [{
      name: 'frequency',
      minValue: 0,
      maxValue: sampleRate / 4,
      defaultValue: 1000,
      automationRate: 'a-rate',
    }, {
      name: 'Q',
      minValue: 1e-5,
      maxValue: 2 * Math.PI,
      defaultValue: Math.PI / 4,
      automationRate: 'a-rate',
    }, ];
  }

  coefficients(frequency, Q) {
    let g = frequency;
    g = this.clamp(Math.abs(g), 0, sampleRate / 4);
    g = Math.tan(g * Math.PI / sampleRate);
    g = g / (1 + g);

    let r = (1 / Math.max(Q, 1e-5)) / 2;

    let a = 1 / ((g * g) + (2 * r * g) + 1);
    let b = g;
    let c = g + (2 * r);

    return [a, b, c];
  }

  process(inputs, outputs, parameters) {
    for (let c = 0; c < outputs[0].length; c++) {

      // Create a history buffer for the channel if needed.
      if (!this.history[c]) {
        this.history[c] = [0, 0];
      }

      for (let i = 0; i < outputs[0][c].length; i++) {

        // Get filter coefficients from params.
        const frequency = this.slewSample(parameters.frequency, i, 'frequency', 30);
        const Q = this.slewSample(parameters.Q, i, 'Q', 0.5);

        // console.log(frequency, Q);

        // Params to coefficients. Maybe do this per block?
        const [g1, g2, g3] = this.coefficients(frequency, Q);

        // The incoming sample.
        const xn = this.sample(inputs[0][c], i);

        // The single sample delay values.
        const s1 = this.history[c][0];
        const s2 = this.history[c][1];

        const hp = g1 * (xn - (g3 * s1) - s2);
        const bp = hp * g2 + s1;
        const lp = bp * g2 + s2;

        this.history[c][0] = hp * g2 + bp;
        this.history[c][1] = bp * g2 + lp;

        outputs[0][c][i] = lp;
        outputs[1][c][i] = hp;
        outputs[2][c][i] = bp;
      }
    }

    return true;
  }
}

registerProcessor('state-variable-filter', StateVariableFilter);