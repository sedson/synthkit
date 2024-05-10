/**
 * @file Multiply two audio rate values. Internally uses one gain node to 
 * multiply. A is the input to the gain, B is the gain AudioParam.
 */
import { Operator } from '../core/Operator.js';

export class Mult extends Operator {
  /**
   * Construct a new Gain. 
   * @param {AudioContext} ctx - The context.
   * @param {number} value - The value of the gain.
   */
  constructor(ctx, value = 1) {
    super(ctx);
    this._gain = new GainNode(ctx, {
      gain: value
    });
  }

  get inlet() { return this._gain; }
  get outlet() { return this._gain; }
  get gain() { return this._gain.gain; }
  get A() { return this._gain; }
  get B() { return this._gain.gain; }
}