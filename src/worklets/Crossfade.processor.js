/**
 * Crossfade processor. 2 M-channel inputs. 1 M-channel output.
 */

import { BaseWorklet } from './BaseWorklet.processor.js';

const FADE_TYPES = {
  linear: (a, b, t) => {
    return a + (t * (b - a));
  },
  sigmoid: (a, b, t) => {
    t = t * t * (3 - 2 * t);
    return a + (t * (b - a));
  },
  sincos: (a, b, t) => {
    return a * Math.cos(t * this.halfpi) + b * Math.sin(t * this.halfpi)
  },
}

class Crossfade extends BaseWorklet {
  constructor(options = {}) {
    super(options);
    this.frame = 0;
    this.type = options.processorOptions?.type ?? 'linear';

    this.mixOperation = FADE_TYPES[this.type];
  }

  static get parameterDescriptors() {
    return [{
      name: 'mix',
      minValue: 0,
      maxValue: 1,
      defaultValue: 0,
      automationRate: 'a-rate',
    }, ];
  }

  process(inputs, outputs, parameters) {
    let outChannels = outputs[0].length;
    for (let c = 0; c < outChannels; c++) {
      for (let i = 0; i < outputs[0][c].length; i++) {
        const a = this.sample(inputs[0][c], i);
        const b = this.sample(inputs[1][c], i);
        let m = this.sample(parameters.mix, i);
        m = this.clamp(m);
        outputs[0][c][i] = this.mixOperation(a, b, m);
      }
    }
    return true;
  }
}

registerProcessor('crossfade', Crossfade);