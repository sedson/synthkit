/**
 * @file Base class for SynthKit custom audio worlet processors.
 */
export class BaseWorklet extends AudioWorkletProcessor {
  /**
   * 
   */
  constructor(options) {
    super(options);
    this.pi = Math.PI;
    this.twopi = 2 * Math.PI;
    this.halfpi = 0.5 * Math.PI;
    this.blockSize = 128;
    this.paramData = {};
  }

  /**
   * Clamp val between min and max.
   */
  clamp(val, min = 0, max = 1) {
    return Math.max(min, Math.min(val, max));
  }

  /**
   * Lerp a and b by factor t.
   */
  lerp(a, b, t = 0) {
    return a + ((b - a) * t);
  }

  /**
   * Slew a param.
   * @param {string} paramName - The name of the param. Slew requires one sample 
   *     of history so store that by param.
   * @param {number} val - The new sample to be slewed from its history.
   * @param {number} slopeMs – The maximum rate of change per ms allowed for the 
   *     value.
   * @return {number} The slewed version of the sample.
   */
  slew(paramName, val, slopeMs) {
    if (this.paramData[paramName] === undefined) {
      this.paramData[paramName] = val;
    }
    const history = this.paramData[paramName];
    const slope = Math.max(0, (1000 / sampleRate) * slopeMs);
    const slewed = history + this.clamp(val - history, -slope, slope);
    this.paramData[paramName] = slewed;
    return slewed;
  }

  /**
   * Onepole a param.
   * @param {string} paramName - The name of the param. Slew requires one sample 
   *     of history so store that by param.
   * @param {number} val - The new sample to be slewed from its history.
   * @param {number} slopeMs – The maximum rate of change per ms allowed for the 
   *     value.
   * @return {number} The slewed version of the sample.
   */
  onepole(paramName, val, fac) {
    if (this.paramData[paramName] === undefined) {
      this.paramData[paramName] = val;
    }
    const history = this.paramData[paramName];
    const onepoled = this.lerp(val, history, fac);
    this.paramData[paramName] = onepoled;
    return onepoled;
  }

  /**
   * Get sample from a buffer. Return 0 if no buffer or buffer 
   * is not sample-able.
   * @param {FloatArray} input - The channel buffer or param buffer. 
   * @param {number} sampleIndex - The index.
   * @return {number|undefined} The sample or undefined if could not sample.
   */
  sample(buffer, sampleIndex) {
    if (!buffer || !buffer.length) return 0;
    if (sampleIndex < buffer.length) return buffer[sampleIndex];
    return buffer[buffer.length - 1];
  }

  /**
   * Slew and sample.
   * @param {FloatArray} input - The channel buffer or param buffer. 
   * @param {number} sampleIndex - The index.
   * @param {string} paramName - The name of the param.
   * @param {number} slopeMs – The maximum rate of change per ms allowed.
   * @param {number} A new value. 
   */
  slewSample(buffer, sampleIndex, paramName, slopeMs) {
    const sample = this.sample(buffer, sampleIndex);
    return this.slew(paramName, sample, slopeMs);
  }

  /**
   * Slew and sample.
   * @param {FloatArray} input - The channel buffer or param buffer. 
   * @param {number} sampleIndex - The index.
   * @param {string} paramName - The name of the param.
   * @param {number} slopeMs – The maximum rate of change per ms allowed.
   * @param {number} A new value. 
   */
  onepoleSample(buffer, sampleIndex, paramName, fac) {
    const sample = this.sample(buffer, sampleIndex);
    return this.onepole(paramName, sample, fac);
  }


}