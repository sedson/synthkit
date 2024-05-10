/**
 * @file Operator is the  basic component of the SynthKit. An operator should 
 * do one thing. Many operators are light wrappers around default WebAudio nodes 
 * with some quality-of-life improvements. 
 * 
 * Each operator can have a number of inlets and outlets defined with js 
 * getters. Each operator should have at least one default inlet and one default 
 * outlet for the sake of connection chaining.
 * 
 * The internals of an operator tend to be underscore-prefixed private members 
 * that are exposed with js getters.
 * 
 * Mixes in EventEmitter and WorkletNode.
 */
export class Operator {
  /**
   * Construct an Operator.
   * @param {AudioContext} ctx - The parent audio context.
   * @param {object} options – Some extra options.
   * @param {boolean} options.mono - True if the operator and its internal nodes
   *     should have explicitly only one input and outlet channel.
   * @param {number} options.channels - The number of explicit channels that
   *     the operator and its internal nodes should have. Setting channels = 1
   *     is the same as setting mono = true.
   */
  constructor(ctx, options = {}) {
    /**
     * The parent audio context.
     * @type {AudioContext}
     */
    this.ctx = ctx;

    /**
     * Event listener functions keyed by name.
     * @type {object}
     */
    this.events = {};

    /**
     * Whether the init function has beed called.
     * @type {boolean}
     * @private
     */
    this._initCalled = false;

    /**
     * Desired channel settings for this operator. To be passed to internal
     * AudioNode constructors. For the most part, I keep the WebAudio default
     * channel modes, but use the most rigid channel modes if an operator
     * was constructed with a specific number of channels.
     * @type {object}
     */
    this.channelSettings = {};
    if (options.channels) {
      this.channelSettings.channelCount = options.channels;
      this.channelSettings.channelInterpretation = "discrete";
      this.channelSettings.channelCountMode = "explicit";
    } else if (options.mono) {
      this.channelSettings.channelCount = 1;
      this.channelSettings.channelInterpretation = "discrete";
      this.channelSettings.channelCountMode = "explicit";
    }
  }

  /**
   * Initialize the Operator once worklets are loaded. Any worklet-dependent 
   * audio-routing has to go in the override for init.
   */
  init() {}

  //----------------------------------------------------------------------------
  // Connections
  //----------------------------------------------------------------------------

  /**
   * The first node in this Operator's sub-graph. Calls to
   * otherOperator.connect(thisOperator) will connect here.
   * @type {AudioNode|AuidoParam}
   */
  get inlet() { return null; }

  /**
   * The final node in this Operator's sub-graph.
   * @type {AudioNode|AuidoParam}
   */
  get outlet() { return null; }

  /**
   * Connect to a target.
   * @param {Operator|AudioNode|AudioParam} target - The target.
   * @param {number} o - Optional outlet index (on this operator's outlet).
   *     Not applicable if connecting to an audio param.
   * @param {number} i - Optional inlet index (on the target). Not applicable
   *     if connecting to an audio param.
   * @return {Operator|AudioNode|AudioParam} The target. For
   *     connection chaining.
   */
  connect(target, o, i) {
    if (this.outlet === null) {
      console.warn("Connect failed! Operator has no outlet", this);
      return null;
    }

    if (target instanceof Operator && target.inlet) {
      this.outlet.connect(target.inlet, o, i);
      return target;
    }

    if (target instanceof AudioNode) {
      this.outlet.connect(target, o, i);
      return target;
    }

    if (target instanceof AudioParam) {
      this.outlet.connect(target);
      return this;
    }

    return this;
  }

  /**
   * Disconnect from a target or remove all outgoing connections if no target
   * is provided.
   * @param {Operator|AudioNode|AudioParam} target - The target.
   */
  disconnect(target) {
    if (this.outlet === null) {
      console.warn("Disconnect failed: Operator has no outlet");
      return null;
    }
    this.outlet.disconnect(target);
    return this;
  }

  //----------------------------------------------------------------------------
  // Utility
  //----------------------------------------------------------------------------

  /**
   * If the specific operator implementation has a scale node configured, set
   * its gain so some value.
   * @param {number} value - The value.
   */
  scale(value) {
    if (this._scaler?.gain) {
      this._scaler.gain.value = value;
    }
    return this;
  }

  //----------------------------------------------------------------------------
  // Events
  //----------------------------------------------------------------------------

  /** 
   * Subscribe to a event.
   * @param {string} event - Event name.
   * @param {funciton} fn - Subscribing function.
   * @param {boolean} once - Whether to remove after one shot.
   */
  listen(event, fn, once = false) {
    if (!this.events[event]) this.events[event] = [];
    this.events[event].push(fn);
    if (once) fn._once = true;
  }

  /** 
   * Remove subsriber (by reference) from event.
   * @param {string} event - Event name.
   * @param {funciton} fn - Subscribing function.
   * 
   */
  removeListener(event, fn) {
    if (!this.events || !this.events[event]) return;
    this.events[event] = this.events[event].filter(item => item !== fn);
  }

  /** 
   * Clear all subscribers.
   * @param {string} event - Event name.
   */
  clearEvent(event) {
    delete this.events[event];
  }

  /** 
   * Trigger event.
   * @param {string} event - Event name.
   */
  triggerEvent(event) {
    if (!this.events[event]) return;
    const updatedEvents = []
    for (let fn of this.events[event]) {
      fn();
      if (!fn._once) {
        updatedEvents.push(fn);
      }
    }
    this.events[event] = updatedEvents;
  }

  //----------------------------------------------------------------------------
  // Worklets
  //----------------------------------------------------------------------------

  /**
   * Handle worklet load.
   * @private
   */
  _onWorkletLoaded() {
    if (this._initCalled) return;
    this.init();
    this.triggerEvent('init');
    this._initCalled = true;
  }

  /**
   * Load a worklet.
   * @param {string} name - The name of the worklet processor.
   * @param {function} fn - The callback to evaluate on load. Usually this
   *     operator's initialization function.
   */
  loadWorklet(name) {
    if (!this.ctx.sk_getWorklet) return;
    this.ctx.sk_getWorklet(name, this._onWorkletLoaded.bind(this));
  }

  /**
   * Create a worklet.
   * @param {string} name - The name of the worklet processor.
   * @param {object} options - Options for the worklet node.
   */
  createWorklet(name, options) {
    const worklet = new AudioWorkletNode(this.ctx, name, options);
    worklet.addEventListener('processorerror', (e) => {
      console.error('There was an error!', e)
    });
    worklet.port.onmessage = e => console.log(e.data);
    return worklet;
  }
}