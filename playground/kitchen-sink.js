import { SynthKit, sk } from '/src/synthkit.js';

// import * as SK from '/dist/synthkit.js';

/** Query a css color from the page */
const getCol = col => {
  return getComputedStyle(document.body).getPropertyValue(`--${col}`);
}

const bg = getCol("text");
const fg = getCol("green");

const SK = window.SK = sk;
const kit = new SynthKit();
window.kit = kit;

const lerp = (a, b, t) => a + t * (b - a);

function makeModule(name, col) {
  const container = document.createElement('div');
  container.classList.add('container', col);
  document.getElementById('modules').append(container);

  const title = document.createElement('h3');
  title.innerText = name;
  container.append(title)


  return {
    module: container,
    slider: (name, fn) => {
      const grp = document.createElement('div');
      grp.classList.add('flex-group');
      const slider = document.createElement('input');
      slider.type = 'range';
      slider.min = 0;
      slider.step = 0.01;
      slider.max = 1;
      slider.classList.add('slider');
      const label = document.createElement('label');
      label.innerText = name;
      container.append(grp);
      grp.append(label, slider);
      slider.oninput = () => {
        fn(slider.value)
      }
      return slider;
    },
    btn: (name, fn) => {
      const btn = document.createElement('button');
      btn.innerText = name;
      btn.onclick = fn;
      container.append(btn);
      return btn;
    }
  }
}



let dac = makeModule('DAC', 'gray');
const spect = new SK.Spect(kit.ctx, dac.module, {
  color: getCol('gray'),
  background: bg,
  mode: 'bars',
});
const scope = new SK.Scope(kit.ctx, dac.module, {
  color: getCol('gray'),
  background: bg,
  pointSize: 3,
  samples: 1024,
  smoothingTimeConstant: 0.1,
});
kit.dac.connect(spect);
kit.dac.connect(scope);


dac.slider('Gain', (val) => {
  const dB = ((val * 100) - 100);
  kit.dac.gain.value = SK.dBtogain(dB)
});
let startbtn = dac.btn('CTX', () => { kit.resume(); });
startbtn.classList.add('blue');

window.addEventListener('keydown', e => {
  if (e.keyCode === 32) {
    console.log('PANIC')
    kit.dac.gain.value = 0;
  }
})


{
  let mod = makeModule('Crossfade', 'yellow');

  let A = kit.signal(0);
  let B = kit.signal(0);


  let osc = kit.oscillator({ freq: 0 });


  let fader = new SK.Crossfade(kit.ctx, 0.5);
  A.connect(fader.a);
  B.connect(fader.b);

  let info = document.createElement('p');
  let getInfo = () => {
    info.innerText = `A: ${A.current.value.toFixed(2)}, B: ${B.current.value.toFixed(2)}, MIX: ${fader.mix.value.toFixed(2)}`;
  }



  mod.slider('A', val => {
    A.current.value = val * 10_000;
    getInfo();
  });
  mod.slider('B', val => {
    B.current.value = val * 10_000;
    getInfo();
  });
  mod.slider('MIX', val => {
    fader.mix.value = val;
    getInfo();

  })

  fader.connect(osc.frequency);

  const spect = new SK.Spect(kit.ctx, mod.module, {
    color: getCol('yellow'),
    background: bg,
    mode: 'bars',
  });
  mod.module.append(info);
  getInfo();

  osc.connect(spect);
}

// -----------------------------------------------------------------------------


{
  let mod = makeModule('Feedback Oscillator + Filter', 'pink');

  const osc = new SK.FeedbackOscillator(kit.ctx, { frequency: 220 });
  const filt = new SK.StateVariableFilter(kit.ctx, { type: 'lowpass', freq: 0, q: 1 });
  // const lfo = kit.oscillator({ frequency: 5 }).scale(100).connect(filt.frequency);
  filt.connect(kit.dac);
  mod.btn('►', () => { osc.connect(filt); });
  mod.btn('■', () => { osc.disconnect(); });

  mod.slider('cutoff', val => {
    filt.frequency.value = lerp(300, 5000, val);
  });
  mod.slider('Q', val => {

    filt.Q.value = lerp(0, 20, val);
  });
  mod.slider('feedback', val => {
    osc.feedback.value = lerp(-8, 8, val);
  });



  osc.listen('init', () => {
    let src1 = kit.randomSource(16, 2);
    let src2 = kit.randomSource(16, 2);

    src1.restart(kit.now + 0.1);
    src2.restart(kit.now + 0.1);


    src1.connect(kit.gain(100)).connect(osc.frequency);
    src1.connect(kit.gain(600)).connect(filt.frequency);
  });
}


{
  let mod = makeModule('One pole', 'gray');
  let noise = new SK.Noise(kit.ctx, 1).scale(0.5);
  let LP = new SK.OnePoleFilter(kit.ctx, { frequency: 1200, type: 'lowpass' });
  let HP = new SK.OnePoleFilter(kit.ctx, { frequency: 20000, type: 'highpass' });
  const disconnect = () => {
    noise.disconnect();
    LP.disconnect();
    HP.disconnect();
  }
  mod.btn('NO FILT', () => {
    disconnect();
    noise.connect(kit.dac)
  });
  mod.btn('LP', () => {
    disconnect();
    noise.connect(LP).connect(kit.dac);
  });
  mod.btn('HP', () => {
    disconnect();
    noise.connect(HP).connect(kit.dac);
  });
  mod.btn('■', () => {
    disconnect();
  });
}

{
  let mod = makeModule('Math', 'green');

  let A = kit.signal(0);
  let B = kit.signal(0);

  let info = document.createElement('p');
  let getInfo = () => {
    info.innerText = `A: ${A.current.value.toFixed(2)}, B: ${B.current.value.toFixed(2)}`;
  }

  let osc = kit.oscillator({ freq: 0 });
  mod.slider('A', val => {
    A.current.value = val * 400;
    getInfo();
  });
  mod.slider('B', val => {
    B.current.value = val * 400;
    getInfo();
  });


  let C = new SK.SignalMath(kit.ctx, 'max');
  A.connect(C.a);
  B.connect(C.b);

  C.connect(osc.frequency);

  const spect = new SK.Spect(kit.ctx, mod.module, {
    color: fg,
    background: bg,
    mode: 'bars',
  });
  mod.module.append(info);
  getInfo();

  osc.connect(spect);
}

{
  let mod = makeModule('Envelope', 'blue');
  const gain = kit.gain(0);
  const sig = kit.signal(1);

  const env = new SK.Envelope2(kit.ctx, {
    type: 'ASR'
  });
  env.connect(gain.gain);

  console.log(env)
  mod.btn('ON', () => {
    // env.triggerAttackRelease();
    console.log(kit.now)

    for (let i = 0; i < 5; i++) {
      env.gate(i * 1, 0.3);
    }
  });


  const scope = new SK.Scope(kit.ctx, mod.module, {
    color: getCol('blue'),
    background: bg,
    mode: 'points',
    pointSize: 1,
    samples: 2 ** 15,
  });

  env.listen('init', () => {
    env._attackParam.value = 0.02;
    env._decayParam.value = 0.02;
    env._releaseParam.value = 0.2;
    env._sustainParam.value = 0.3;
    env._shapeParam.value = 0.01;
  });



  sig.connect(gain).connect(scope);
}



{
  let mod = makeModule('VCA', 'green');
  let vca = kit.gain(0);
  let osc = kit.oscillator({ shape: 'sinw', freq: 220 });
  let env = kit.asr([0.01, 1.0, 2.5]);

  osc.connect(vca);
  env.connect(vca.gain);

  vca.connect(kit.dac);

  mod.btn('PLAY', () => {
    env.gate(0, 0.02);
  });

  const scope = new SK.Scope(kit.ctx, mod.module, {
    color: getCol('green'),
    background: bg,
    mode: 'points',
    pointSize: 1,
    samples: 2 ** 8,
  });
  vca.connect(scope);
}


{
  let mod = makeModule('Verb 3', 'yellow');
  let osc;

  let noise = false;
  if (noise) {
    osc = new SK.Noise(kit.ctx)
  } else {
    osc = new SK.FeedbackOscillator(kit.ctx, { frequency: 800, shape: 'tri' });
    osc.listen('init', () => {
      osc.feedback.value = 0.7;
    })
  }


  const env = kit.asr([0.01, 1.0, 0.1]);
  const vca = kit.vca(osc, env);

  const verb = new SK.Verb3(kit.ctx);
  vca.connect(verb).connect(kit.dac);

  let getInfo;

  const cols = [
    getCol("red"),
    getCol("green"),
    getCol("blue"),
    getCol("pink"),
  ];
  verb.listen('init', () => {
    console.log('Verb3 on init');

    for (let i = 0; i < 4; i++) {
      let scp = new SK.Scope(kit.ctx, mod.module, {
        color: cols[i],
        mono: true,
        height: 80,
        samples: 2 ** 12,
      });
      verb._decayNodes[i].connect(scp.inlet);
    }

    getInfo = () => {
      info.innerText = `THETA: ${rtod(verb.theta.value).toFixed(2)}, IOTA: ${rtod(verb.iota.value).toFixed(2)}`;
    }
    getInfo();
    mod.module.append(info);

  });



  const scale = [60, 64, 72, 67, 71, 48];
  mod.btn('ON', () => {
    if (!noise) {
      osc.frequency.value = SK.mtof(scale[Math.floor(Math.random() * scale.length)]);
    }
    console.log(env)
    env.gate(0, 0.05);
  });
  mod.slider('Mix', (val) => {
    verb.mix.value = val;
  });
  // mod.slider('highcut', (val) => {
  //   verb.highcut.value = lerp(400, 10000, val);
  // });
  mod.slider('feedback', (val) => {
    verb.feedback.value = Math.min(val * 1, 1.01);
  });
  mod.slider('theta', (val) => {
    verb.theta.value = val * 0.5 * Math.PI;
    getInfo();
  });
  mod.slider('iota', (val) => {
    verb.iota.value = val * 0.5 * Math.PI;
    getInfo();
  });


  const rtod = r => r * 180 / Math.PI;
  let info = document.createElement('p');


}



{
  let mod = makeModule('State Variable Filter', 'green');
  let noise = new SK.Noise(kit.ctx, 1).scale(0.5);
  let filt = new SK.StateVariableFilter(kit.ctx);

  const disconnect = () => {
    noise.disconnect();
    filt.disconnect();
  }

  mod.btn('NO FILT', () => {
    disconnect();
    noise.connect(kit.dac)
  });

  mod.btn('LP', () => {
    disconnect();
    noise.connect(filt);
    filt.lowpass.connect(kit.dac);
  });

  mod.btn('BP', () => {
    disconnect();
    noise.connect(filt);
    filt.bandpass.connect(kit.dac);
  });

  mod.btn('HP', () => {
    disconnect();
    noise.connect(filt);
    filt.highpass.connect(kit.dac);
  });

  mod.btn('■', () => {
    disconnect();
  });

  mod.slider('CUTOFF', (val) => {
    filt.frequency.value = val * 11_000;
  })
}