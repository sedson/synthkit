/**
 * @file 4 in 4 out rotation / signal mixing operator.
 */
import { BaseWorklet } from './BaseWorklet.processor.js';

class Mix4 extends BaseWorklet {
  constructor(options = {}) {
    super(options);
  }

  static get parameterDescriptors() {
    return [{
      name: 'theta',
      minValue: 0,
      maxValue: 2 * Math.PI,
      defaultValue: Math.PI / 4,
      automationRate: 'k-rate',
    }, {
      name: 'iota',
      minValue: 0,
      maxValue: 2 * Math.PI,
      defaultValue: Math.PI / 4,
      automationRate: 'k-rate',
    }, ];
  }

  process(inputs, outputs, parameters) {
    const theta = this.slewSample(parameters.theta, 0, 'theta', 0.5);
    const sinTheta = Math.sin(theta);
    const cosTheta = Math.cos(theta);

    const iota = this.slewSample(parameters.iota, 0, 'iota', 0.5);
    const sinIota = Math.sin(iota);
    const cosIota = Math.cos(iota);

    const len = outputs[0][0].length;
    for (let s = 0; s < len; s++) {
      const a = this.sample(inputs[0][0], s) ?? 0;
      const b = this.sample(inputs[1][0], s) ?? 0;
      const c = this.sample(inputs[2][0], s) ?? 0;
      const d = this.sample(inputs[3][0], s) ?? 0;

      const a1 = (a * cosTheta) - (b * sinTheta);
      const b1 = (a * sinTheta) + (b * cosTheta);

      const c1 = (c * cosTheta) - (d * sinTheta);
      const d1 = (c * sinTheta) + (d * cosTheta);

      const a2 = (a1 * cosIota) - (c1 * sinIota);
      const b2 = (a1 * sinIota) + (c1 * cosIota);

      const c2 = (b1 * cosIota) - (d1 * sinIota);
      const d2 = (b1 * sinIota) + (d1 * cosIota);

      outputs[0][0][s] = a2;
      outputs[1][0][s] = b2;
      outputs[2][0][s] = c2;
      outputs[3][0][s] = d2;
    }
    return true;
  }
}

registerProcessor('mix-4', Mix4);