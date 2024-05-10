/**
 * @file Stereo splitter. Split a stero inlet into a left and right 
 * mono output. Return the unsplit audio to outlet.
 */
import { Operator } from '../core/Operator.js';


export class StereoSplitter extends Operator {
  constructor(ctx) {
    super(ctx);
    this._input = new GainNode(ctx);
    this._split = new ChannelSplitterNode(ctx, { numberOfOutputs: 2 });
    console.log('SPLITTER:', this._split);

    this._outL = new GainNode(ctx);
    this._outR = new GainNode(ctx);

    this._input.connect(this._split);
    this._split.connect(this._outL, 0);
    this._split.connect(this._outR, 1);
  }

  get inlet() { return this._input; }
  get L() { return this._outL; }
  get R() { return this._outR; }
  get outlet() { return this._input; }
}