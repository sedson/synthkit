/**
 * @file Helper functions to make Worklet management a little bit easier.
 */
import { worklets } from './worklets.js';

/**
 * Module-scoped list of worklets and their state.
 */
const WORKLETS = {};


/**
 * Add the synth kit custom worklets to an audio context.
 * IMPORTANT: attaches the function `sk_getWorklet` to the host audio context 
 * so that auidio nodes made within that context can ask about the status of 
 * worklets.
 */
export function setupWorkletContext(ctx, bundlePath) {

  if (ctx.sk_getWorklet) {
    console.warn('Synthkit worklets already set up in context.');
    return;
  }

  // Allow nodes to look for worklets withou just calling new WorkletPorcessor.
  ctx.sk_getWorklet = getWorklet;

  for (let worklet of worklets) {
    registerWorklet(worklet);
  }

  if (bundlePath) {
    ctx.audioWorklet.addModule(bundlePath).then(() => {
      for (let name in WORKLETS) {
        onLoadWorklet(name);
      }
    });
    return;
  }

  for (let name in WORKLETS) {
    ctx.audioWorklet.addModule(WORKLETS[name].path).then(() => {
      onLoadWorklet(name);
    });
  }
}

/**
 * Register a worklet.
 */
function registerWorklet(worklet) {
  WORKLETS[worklet.name] = {
    path: worklet.path,
    loaded: false,
    onLoadCallbacks: [],
  };
}

/**
 * When a named worklet loads.
 */
function onLoadWorklet(name) {
  if (!WORKLETS[name]) return;
  WORKLETS[name].loaded = true;
  for (const fn of WORKLETS[name].onLoadCallbacks) {
    fn();
  }
  WORKLETS[name].onLoadCallbacks = [];
}

/**
 * 
 */
function getWorklet(name, fn) {
  // Case (1) unknown worklet.
  if (!WORKLETS[name]) {
    console.error('Unknown worklet processor name: ', name);
    return;
  }

  // Case (2) already loaded worklet! Imediately invoke the callback.
  if (WORKLETS[name].loaded) {
    fn();
  }

  // Case (3) push the callback into the stack for when complete.
  WORKLETS[name].onLoadCallbacks.push(fn);
}