import { Signal } from '../utils/Signal.js';
import { Operator } from '../core/Operator.js';
import { MONO } from '../common.js';

export class Envelope2 extends Operator {
  constructor(ctx, options) {
    super(ctx);

    this._attack = options.attack || 0.01;
    this._decay = options.decay || 0.1;
    this._sustain = options.sustain || 0.5;
    this._release = options.release || 0.1;
    this._shape = options.shape || 0.01;

    this.type = (options.type || 'adsr').toUpperCase();


    // this._source = new ConstantSourceNode(ctx, {
    //   offset: 0,
    // });
    // this._source.start();

    this.loadWorklet('envelope-generator');

    this._out = new GainNode(this.ctx, { ...MONO, gain: 1 });
  }

  init() {
    this._env = this.createWorklet('envelope-generator', {
      numberOfInputs: 0,
      numberOfOutputs: 1,
      outputChannelCount: [1],
      processorOptions: { type: this.type },
    });

    this._gateParam = this._env.parameters.get('gate');
    this._attackParam = this._env.parameters.get('attack');
    this._releaseParam = this._env.parameters.get('release');
    this._decayParam = this._env.parameters.get('decay');
    this._sustainParam = this._env.parameters.get('sustain');
    this._shapeParam = this._env.parameters.get('shape');



    this._env.connect(this._out);

  }

  get inlet() { return null; }
  get outlet() { return this._out; }

  gate(startTime = 0, length = 0) {
    const now = this.ctx.currentTime;
    let l = Math.max(1 / this.ctx.sampleRate, length);
    this._gateParam.setValueAtTime(1, now + startTime);
    this._gateParam.setValueAtTime(0, now + startTime + l);
  }

  gateOn(time = 0) {

  }

  gateOff(time = 0) {

  }

  // gate(time = 0.1) {
  //   const now = this.ctx.currentTime;
  //   this._source.offset.setValueAtTime(0, now);
  //   this._source.offset.linearRampToValueAtTime(1, now + 0.03);
  //   this._source.offset.linearRampToValueAtTime(0, now + 0.0301 + 0.03);
  //   // this._source.offset.setValueAtTime(0, now + 0.0301 + 0.5)
  // }
}