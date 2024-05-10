/**
 * @file Provide the paramify function.
 */

const paramObject = {
  /**
   * The list of exposed parameters.
   * @type {object}
   */
  params: {},

  /**
   * Set a named parameter.
   * @param {string} name - The name of the param
   * @param {number} value - The value to set.
   * @param {number} time - The amount of time to tween the change over. 
   */
  param: function (name, value, time) {
    this._setParam(name, value, false, time);
    return this;
  },

  /**
   * Set a named parameter from a normalized value.
   * @param {string} name - The name of the param
   * @param {number} value - The value to set.
   * @param {number} time - The amount of time to tween the change over. 
   */
  nParam: function (name, value, time) {
    this._setParam(name, value, true, time);
    return this;
  },

  /**
   * Set a param or macro.
   * @param {string} name The name of the param or macro.
   * @param {number} value The value to set.
   * @param {number} time The amount of time to tween the change over. 
   * @private
   */
  _setParam: function (name, value, normalized, time) {
    if (!this.params[name]) return;
    const param = this.params[name];

    param.value = normalized ?
      (param.max - param.min) * value + param.min :
      value;

    if (typeof param.target === 'function') {
      param.target.call(this, value, time);
      return;
    }

    if (!time) {
      param.target.setValueAtTime(param.value, this.ctx.currentTime);
    } else {
      param.target.setTargetAtTime(param.value, this.ctx.currentTime, time);
    }
  },

  /**
   * Create a parameter externally. 
   * @param {string} name The name of the param.
   * @param {AudioParameter} target The native WebAudio AudioParameter that this 
   *     parameter targets.
   * @param {number} value The initial value.
   * @param {number} min The min value.
   * @param {number} max The max value.
   * @param {number} smoothing The default smoothing amount for this param.
   */
  createParam: function (name, target, value, min, max, smoothing = 0) {
    this.params[name] = {
      value: value,
      min: min,
      max: max,
      target: target
    };
    this._setParam(name, value, false, 0);
  }
}


/**
 * Apply the param management functions to the input class defniftion or object.
 * @param {Class|object} type – The type to apply param utils to.
 */
export function paramify(type) {
  Object.assign(type.prototype, paramObject);
  return type;
}