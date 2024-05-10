/**
 * Effect base. Has a dry wet mix.
 */
import { Operator } from '../core/Operator.js';
import { Crossfade } from '../utils/Crossfade.js';

export class Effect extends Operator {
  constructor(ctx) {
    super(ctx);
    this._dry = new GainNode(ctx);

    this._chainIn = new GainNode(ctx);
    this._chainOut = new GainNode(ctx);

    this._mix = new Crossfade(ctx);

    this._dry.connect(this._mix.inlet);
    this._dry.connect(this._chainIn);
    this._chainOut.connect(this._mix.inlet2);
  }
  get inlet() { return this._dry; }
  get outlet() { return this._mix; }
  get mix() { return this._mix.mix; }
}