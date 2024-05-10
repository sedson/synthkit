/**
 * @file Stereo splitter. Split a stero inlet into a left and right 
 * mono output. Return the unsplit audio to outlet.
 */
import { Operator } from '../core/Operator.js';


export class MonoToStereo extends Operator {
  constructor(ctx) {
    super(ctx);
    this._input = new GainNode(ctx);
    this._outL = new GainNode(ctx);
    this._outR = new GainNode(ctx);
    this._input.connect(this._outL);
    this._input.connect(this._outR);
  }

  get inlet() { return this._input; }
  get L() { return this._outL; }
  get R() { return this._outR; }
  get outlet() { return this._input; }
}