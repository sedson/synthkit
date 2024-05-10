/**
 * @file 2 in 2 out rotation / signal mixing operator.
 */ 
import { BaseWorklet } from './BaseWorklet.processor.js';


class Mix2 extends BaseWorklet {
  constructor (options = {}) {
    super(options);
    this.frame = 0;
  }

  static get parameterDescriptors () {
    return [
      {
        name: 'theta',
        minValue: 0,
        maxValue: 2 * Math.PI,
        defaultValue: Math.PI / 4,
        automationRate: 'k-rate',
      },
    ]
  }

  /**
   * Get the audio sample from a channel buffer. Perform safety checks before 
   * sampling.
   * @param {FloatArray} input - The channel buffer.
   * @return {number|undefined} The sample or undefined if could not sample.
   */ 
  getInputAtSample (input, sampleIndex) {
    if (!input || !input.length) return undefined;
    if (input.length === 1) return input[0];
    if (sampleIndex < input.length) return input[sampleIndex];
  }
  
  process (inputs, outputs, parameters) {
    const theta = parameters.theta[0];
    const sin = Math.sin(theta);
    const cos = Math.cos(theta);
   
    // loop output channels.
    const len = outputs[0][0].length;
    for (let s = 0; s < len; s++) {
      const a = this.getInputAtSample(inputs[0][0], s) ?? 0;
      const b = this.getInputAtSample(inputs[1][0], s) ?? 0;
      const a1 = (a * cos) - (b * sin);
      const b1 = (a * sin) + (b * cos);
      outputs[0][0][s] = a1;
      outputs[1][0][s] = b1;
    }

    return true;
  }
}

registerProcessor('mix-2', Mix2);