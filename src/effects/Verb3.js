/**
 * @file Artificial reverb attempt number 5!
 * 
 * Each delay line:
 * ┐ ┌ ┘ └ ┴ ┬
 * -->{gain}-->{1polelowpass@h}-->{allpass}-->{delay@t}-->{softclip}-->
 * 
 * 
 *       ┌-┬-┬-┬-<-[feedback * decay]-----------<---┬-┬-┬-┐
 *       | | | |                   ┌------------┐   | | | |
 * IN.L--┴-|-|-|-->[delayline0]--->|            |->-┴-|-|-|-----┬----->OUT.L
 * IN.R----┴-|-|-->[delayline1]--->|  4in 4out  |->---|-|-┴-----|--┬-->OUT.R
 *           └-|-->[delayLine2]--->|  rotation  |->---|-┴-------┘  |
 *             └-->[delayLine3]--->|            |->---┴------------┘
 *                                 └------------┘ 
 * 
 * Possible combination of delay line lengths.
 * [ 47, 67, 101, 137 ]
 * [ 29, 37, 69, 53 ]
 * [ 38.4325, 79.6385, 84.5423, 97.1244 ]
 * [ 37, 89, 71, 103 ]
 * [ 102.4325, 145.6385, 167.5423, 183.1244 ]
 * [ 131, 147, 201, 213 ]
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
import { OnePoleFilter } from '../filters/OnePoleFilter.js';
import { series } from '../common.js';


const HIGHCUT = 16_000;



export class Verb3 extends Effect {
  constructor(ctx, options) {
    super(ctx, options);
    this.loadWorklet('mix-4');
  }

  init() {
    // Connect up the effect chain inlet.
    const splitter = new MonoToStereo(this.ctx);
    this._chainIn.connect(splitter.inlet);


    this._mixer = this.createWorklet('mix-4', {
      numberOfInputs: 4,
      numberOfOutputs: 4,
      outputChannelCount: [1, 1, 1, 1],
    });
    this._theta = this._mixer.parameters.get('theta');
    this._iota = this._mixer.parameters.get('iota');

    this._delayLines = [
      this.createChannelDelayLine(HIGHCUT, 29 / 1000),
      this.createChannelDelayLine(HIGHCUT, 37 / 1000),
      this.createChannelDelayLine(HIGHCUT, 68 / 1000),
      this.createChannelDelayLine(HIGHCUT, 97 / 1000),
    ];

    splitter.L.connect(this._delayLines[0].in.inlet);
    splitter.R.connect(this._delayLines[0].in.inlet);

    this._decayParam = new Signal(this.ctx, 0);

    this._decayNodes = [];


    for (let i = 0; i < 4; i++) {
      const decayNode = new GainNode(this.ctx, { gain: 0, channelCount: 1 });

      // delay line -> unitary mix matrix.
      this._delayLines[i].saturator.outlet.connect(this._mixer, 0, i);

      // unitary mix matrix -> decay multiplier
      this._mixer.connect(decayNode, i, 0);

      // decay control to decay gain.
      this._decayParam.connect(decayNode.gain);

      this._decayNodes.push(decayNode);
    }

    const sumL = new GainNode(this.ctx, { gain: 0.5, channelCount: 1 });
    const sumR = new GainNode(this.ctx, { gain: 0.5, channelCount: 1 });

    this._decayNodes[0].connect(sumL);
    this._decayNodes[1].connect(sumL);

    this._decayNodes[2].connect(sumR);
    this._decayNodes[3].connect(sumR);

    this._decayNodes[0].connect(this._delayLines[0].in.inlet);
    this._decayNodes[1].connect(this._delayLines[2].in.inlet);
    this._decayNodes[2].connect(this._delayLines[1].in.inlet);
    this._decayNodes[3].connect(this._delayLines[3].in.inlet);

    const out = new StereoMerger(this.ctx);

    sumL.connect(out.L);
    sumR.connect(out.R);

    out.connect(this._chainOut);
  }

  get feedback() { return this._decayParam.current; }
  // get size () { return this._sizeParam.current; }
  get theta() { return this._theta }
  get iota() { return this._iota }



  createChannelDelayLine(highcut, delay) {
    const chain = [
      new Gain(this.ctx, 1, { mono: true }),
      new OnePoleFilter(this.ctx, { frequency: highcut, mono: true }),
      new Delay(this.ctx, delay, { mono: true }),
      new Saturator(this.ctx, { mono: true }),
    ];
    series(chain);

    const lfo = new Oscillator(this.ctx, { frequency: Math.random() * 0.1 });
    lfo.scale(10 / 10000);
    lfo.connect(chain[2].delay);


    return {
      in: chain[0],
      delay: chain[2],
      saturator: chain[3],
    };
  }
}