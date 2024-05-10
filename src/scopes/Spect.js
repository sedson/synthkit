import { Operator } from '../core/Operator.js';

export class Spect extends Operator {
  constructor(ctx, container, options = {}) {
    super(ctx, options);

    this.samples = options.samples || 2048;

    this._analyser = new AnalyserNode(ctx, {
      fftSize: this.samples,
      smoothingTimeConstant: 0.6,
    });


    this._panel = document.createElement('div');
    this._panel.classList.add('scope');
    this._canvas = document.createElement('canvas');
    this._canvas.classList.add('scope-canvas');
    this._canvas.width = options.width || 400;
    this._canvas.height = options.height || 140;
    this._canvasCtx = this._canvas.getContext('2d');

    this._binCount = this._analyser.frequencyBinCount;
    this._dataBuffer = new Uint8Array(this._binCount);
    this._panel.append(this._canvas);

    this._nyquist = ctx.sampleRate / 2;

    this._frequencyLabels = [
      ['100', 100],
      ['1k', 1000],
      ['10k', 10000],
      ['•', 440]
    ];

    this.mode = options.mode || 'line';

    this.colorStr = options.color || '#fff';
    this.backgroundStr = options.background || '#000';

    this._render = this.render.bind(this);
    this._render();
    this._canvas.addEventListener('mousemove', (e) => this._handleMouse(e));

    container.append(this._panel);

  }

  _handleMouse(e) {
    const {
      clientX,
      clientY
    } = e;
    const rect = this._canvas.getBoundingClientRect();
    const normX = (clientX - rect.left) / rect.width;
    if (normX >= 0 && normX <= 1) {
      this._frequencyLabels[this._frequencyLabels.length - 1][0] = this._xPosToFreq(normX);
      this._frequencyLabels[this._frequencyLabels.length - 1][1] = this._xPosToFreq(normX);
    }
  }

  get inlet() {
    return this._analyser;
  }

  _freqToXpos(frequency) {
    let a = Math.log10(frequency) / Math.log10(this._nyquist);
    let val = (1 / .7) * (a - .3);
    return val * this._canvas.width;
  }

  _xPosToFreq(xPos) {
    let val = (xPos / (1 / .7) + 0.3) * Math.log10(this._nyquist);
    return Math.floor(Math.pow(10, val));
  }

  render() {
    this._analyser.getByteFrequencyData(this._dataBuffer);

    this._canvasCtx.fillStyle = this.backgroundStr;
    this._canvasCtx.globalAlpha = 1;
    this._canvasCtx.fillRect(0, 0, this._canvas.width, this._canvas.height);

    for (let [label, freq] of this._frequencyLabels) {
      this._canvasCtx.font = "10px Arial";
      this._canvasCtx.fillStyle = this.colorStr;;
      const x = this._freqToXpos(freq);
      this._canvasCtx.strokeStyle = this.colorStr;
      this._canvasCtx.textAlign = 'center'
      this._canvasCtx.fillText(label, x, 10);
      this._canvasCtx.beginPath();
      this._canvasCtx.setLineDash([1, 5]);
      this._canvasCtx.moveTo(x, this._canvas.height);
      this._canvasCtx.lineTo(x, 20);
      this._canvasCtx.stroke();
    }

    if (this.mode === 'line') {
      this._renderLine();
    } else if (this.mode === 'bars') {
      this._renderBars();
    } else if (this.mode === 'both') {
      this._renderLine();
      this._renderBars();
    }


    requestAnimationFrame(this._render);
  }


  _renderBars() {
    this._canvasCtx.lineWidth = 1;
    this._canvasCtx.setLineDash([]);

    this._canvasCtx.strokeStyle = this.colorStr;

    const w = this._canvas.width / this._binCount;

    for (let i = 0; i < this._binCount; i++) {
      const val = 1.0 - this._dataBuffer[i] / 256.0;
      const y = (val * this._canvas.height);

      const freq = this._nyquist * i / this._binCount;
      const x = this._freqToXpos(freq);

      this._canvasCtx.beginPath();
      this._canvasCtx.moveTo(x, this._canvas.height);
      this._canvasCtx.lineTo(x, y);
      this._canvasCtx.stroke();
    }
  }


  _renderLine() {
    const w = this._canvas.width / this._binCount;


    this._canvasCtx.lineWidth = 2;
    this._canvasCtx.setLineDash([]);
    this._canvasCtx.strokeStyle = this.colorStr;


    this._canvasCtx.beginPath();
    const valAtZero = 1.0 - this._dataBuffer[0] / 256.0;
    this._canvasCtx.moveTo(0, valAtZero * this._canvas.height);


    for (let i = 0; i < this._binCount; i++) {
      const val = 1.0 - this._dataBuffer[i] / 256.0;
      const y = (val * this._canvas.height + 2);
      const freq = this._nyquist * i / this._binCount;
      const x = this._freqToXpos(freq);
      this._canvasCtx.lineTo(x, y);
    }
    this._canvasCtx.stroke();

  }
}