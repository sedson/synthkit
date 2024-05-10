/**
 * @file Provide signal (audio-rate) binary operators.
 */
import { BaseWorklet } from './BaseWorklet.processor.js';


const TYPES = {
  add: (a = 0, b = 0) => a + b,
  sub: (a = 0, b = 0) => a - b,
  mult: (a = 0, b = 1) => a * b,
  div: (a = 0, b = 1) => {
    if (Math.abs(b < 1e-5)) return 0;
    return a / b;
  },
  negate: (a = 0) => a * -1,
  min: (a = 0, b = +Infinity) => Math.min(a, b),
  max: (a = 0, b = -Infinity) => Math.max(a, b),
  sin: (a = 0) => Math.sin(a),
  sind: (a = 0) => Math.sin(a * 360 / Math.PI),
  cos: (a = 0) => Math.cos(a),
  cosd: (a = 0) => Math.cos(a * 180 / Math.PI),
};

class SignalMath extends BaseWorklet {

  constructor(options) {
    super(options);
    this.type = options.processorOptions.type || 'add';
    this.operation = TYPES[this.type];
  }

  process(inputs, outputs) {
    for (let c = 0; c < outputs[0].length; c++) {
      for (let s = 0; s < outputs[0][c].length; s++) {
        let a = this.sample(inputs[0][0], s);
        let b = this.sample(inputs[1][0], s);
        outputs[0][c][s] = this.operation(a, b);
      }
    }
    return true;
  }
}

registerProcessor('signal-math', SignalMath);