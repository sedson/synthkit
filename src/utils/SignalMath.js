/**
 * @file Binary signal rate math node.
 */

import { Operator } from '../core/Operator.js';
import { MONO } from '../common.js';

const TYPES = {
  ADD: 'add',
  SUB: 'sub',
  MULT: 'mult',
  DIV: 'div',
  MIN: 'min',
  MAX: 'max',
  SIN: 'sin',
  SIND: 'sind',
  COS: 'cos',
  COSD: 'cosd',
};

export class SignalMath extends Operator {
  /**
   * Construct a Math node. 
   * @param {AudioContext} ctx - The context.
   * @param {string} type - The type of math
   *     'add', 'sub', 'mult', 'div', 'min', 'max'
   */
  constructor(ctx, type, options) {
    super(ctx, options);
    this.type = TYPES.ADD;
    if (TYPES[type.toUpperCase()]) {
      this.type = TYPES[type.toUpperCase()];
    }

    // Two inlet gain nodes. One outlet. 
    this._a = new GainNode(ctx, {
      ...MONO
    });
    this._b = new GainNode(ctx, {
      ...MONO
    });
    this._c = new GainNode(ctx, {
      ...MONO
    });

    this.loadWorklet('signal-math', () => this.init());
  }

  init() {
    this._node = this.createWorklet('signal-math', {
      numberOfInputs: 2,
      numberOfOutputs: 1,
      outputChannelCount: [1],
      processorOptions: {
        type: this.type,
      }
    });

    this._a.connect(this._node, 0, 0);
    this._b.connect(this._node, 0, 1);
    this._node.connect(this._c);
  }

  get inlet() {
    return this._a;
  }
  get inlet2() {
    return this._b;
  }
  get outlet() {
    return this._c;
  }
  get a() {
    return this._a;
  }
  get b() {
    return this._b;
  }
}