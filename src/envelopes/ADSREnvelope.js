const lerp = (a, b, t) => a + (t * (b - a));
const easeInExpo = (t) => t === 0 ? 0 : Math.pow(2, 10 * (t - 10));
const RESOLUTION = 0.001;



function Float32Concat(a, b) {
  const arr = new Float32Array(a.length + b.length);
  arr.set(a);
  arr.set(b, a.length);
  return arr;
}


export class ADSREnvelope {
  constructor(ctx, target, ADSR = [0.1, 0.1, 0.5, 0.5]) {
    this.ctx = ctx;
    this.param = target;

    this._attack = ADSR[0];
    this._decay = ADSR[1];
    this._sustain = ADSR[2];
    this._release = ADSR[3];

    this._resolution = 0.1;

    this._attackDecayRamp = null;
    this._releaseRamp = null;

    this._resolution = 0.001;

    this._rampDone = -1;

    this._start = 0;
    this._peak = 1;

    this._calculateRamps();

  }

  _calculateRamps() {
    const attackRamp = this.generateRamp(this._start, this._peak, this._attack, true);
    const decayRamp = this.generateRamp(this._peak, this._sustain, this._decay, true);
    this._attackDecayRamp = Float32Concat(attackRamp, decayRamp);
    this._releaseRamp = this.generateRamp(this._sustain, this._start, this._release, true);
    this._attackDecayReleaseRamp = Float32Concat(this._attackDecayRamp, this._releaseRamp);
  }

  set attack(val) {
    this._attack = val;
    this._calculateRamps();
  }
  get attack() {
    return this._attack;
  }

  set decay(val) {
    this._decay = val;
    this._calculateRamps();
  }
  get decay() {
    return this._attack;
  }

  set sustain(val) {
    this._sustain = val;
    this._calculateRamps();
  }
  get sustain() {
    return this._attack;
  }

  set release(val) {
    this._release = val;
    this._calculateRamps();
  }
  get release() {
    return this._attack;
  }


  triggerAttack(time = 0) {
    const now = this.ctx.currentTime;
    if (now < this._rampDone) return;
    const rampTime = this._attack + this._decay;
    this._rampDone = now + rampTime;
    this.param.setValueAtTime(this._start, now);

    try {
      this.param.setValueCurveAtTime(this._attackDecayRamp, now + 1 / this.ctx.sampleRate, rampTime);
    } catch {

    }
  }

  triggerRelease() {
    const now = this.ctx.currentTime;
    if (now < this._rampDone) return;
    const rampTime = this._release;
    this._rampDone = now + rampTime;

    try {
      this.param.setValueCurveAtTime(this._releaseRamp, now, rampTime);
    } catch {

    }
  }

  triggerAttackRelease() {
    const now = this.ctx.currentTime;
    if (now < this._rampDone) return;
    const rampTime = this._attack + this._decay + this._release;
    this._rampDone = now + rampTime;
    this.param.setValueAtTime(this._start, now);
    // console.log(128 / this.ctx.sampleRate)

    try {
      this.param.setValueCurveAtTime(this._attackDecayReleaseRamp, now + 128 / this.ctx.sampleRate, rampTime);
    } catch {

    }
  }



  generateRamp(from, to, time, expo = false) {
    let samples = Math.floor(time * this.ctx.sampleRate * this._resolution);
    samples = Math.max(samples, 3);
    const ramp = new Float32Array(samples);
    for (let i = 0; i < samples; i++) {
      let t = i / (samples - 1);
      if (expo) {
        ramp[i] = lerp(from, to, 1 - ((1 - t) ** 2));
      } else {
        ramp[i] = lerp(from, to, t);
      }
    }
    return ramp;
  }


}