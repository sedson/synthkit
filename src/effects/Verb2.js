/**
 * @file Artificial reverb attempt number 4! Simpler circuit with a better 
 * understanding.
 * ┐┌┘└
 *        ┌--<-[gain]---<------------------┐
 *        |                ┌-----------┐   |
 * L ----[+]---[delay1]----| Othogonal |---•------ L
 *                         | Matrix    |
 * R ----[+]---[delay2]----|           |---•------ R
 *        |                └-----------┘   |
 *        └--<-[gain]---<------------------┘
 * 
 * 
 * Where orthogonal matrix is defined as 
 * 
 * L1 = Lcosθ - Rsinθ
 * R2 = Lsinθ + Rcosθ
 * 
 * for some θ.
 * 
 */

import { Effect } from './Effect.js';
import { Gain } from '../utils/Gain.js';
import { Delay } from '../utils/Delay.js';
import { Signal } from '../utils/Signal.js';
import { Saturator } from '../utils/Saturator.js';
import { Oscillator } from '../oscillators/Oscillator.js';
import { StereoSplitter } from '../utils/StereoSplitter.js';
import { StereoMerger } from '../utils/StereoMerger.js';
import { MonoToStereo } from '../utils/MonoToStereo.js';
import { Filter2 } from '../filters/Filter2.js';

const HIGHCUT = 10_000;



export class Verb2 extends Effect {
  constructor(ctx, options) {
    super(ctx, options);
    this.loadWorklet('mix-2', () => this.init());
  }

  init() {
    // Connect up the effect chain inlet.
    const splitter = new MonoToStereo(this.ctx);
    const inputHighCut = new Filter2(this.ctx, { frequency: 16_000, Q: 0 });
    const inputAllPass = new Filter2(this.ctx, { frequency: 2000, Q: 0, type: 'allpass' });

    this._chainIn
      .connect(inputAllPass.inlet)
      // .connect(inputHighCut.inlet)
      .connect(splitter.inlet);


    this._mixer = new AudioWorkletNode(this.ctx, 'mix-2', {
      numberOfInputs: 2,
      numberOfOutputs: 2,
      outputChannelCount: [1, 1],
    });

    this._theta = this._mixer.parameters.get('theta');



    const delayL = new Delay(this.ctx, 68 / 1000, { mono: true });
    const delayR = new Delay(this.ctx, 37 / 1000, { mono: true });

    this.debugL = delayL;
    this.debugR = delayR;

    console.log(delayL, delayR)


    splitter.L.connect(delayL.inlet);
    splitter.R.connect(delayR.inlet);

    delayL.outlet.connect(this._mixer, 0, 0);
    delayR.outlet.connect(this._mixer, 0, 1);


    const decayL = new Gain(this.ctx, 0);
    const decayR = new Gain(this.ctx, 0);

    // console.log(decayL, decayR);


    this._decayParam = new Signal(this.ctx, 0);


    this._decayParam.connect(decayL.gain);
    this._decayParam.connect(decayR.gain);

    const gL = new GainNode(this.ctx);
    const gR = new GainNode(this.ctx);


    this._mixer.connect(gL, 0);
    this._mixer.connect(gR, 1);


    gL.connect(decayL.inlet).connect(delayL.inlet);
    gR.connect(decayR.inlet).connect(delayR.inlet);

    const lfoL = new Oscillator(this.ctx, { frequency: 3.1415 });
    lfoL.scale(2 / 10000)
      .connect(delayL.delay);


    const lfoR = new Oscillator(this.ctx, { frequency: 1.97 });
    lfoR.scale(2 / 10000)
      .connect(delayR.delay);



    const out = new StereoMerger(this.ctx);

    gL.connect(out.L);
    gR.connect(out.R);

    out.connect(this._chainOut);



    this.trigger('init')


  }

  get feedback() { return this._decayParam.current; }
  // get size () { return this._sizeParam.current; }
  get theta() { return this._theta }
}