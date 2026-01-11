export class AudioManager {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private bgmOscillators: OscillatorNode[] = [];
  private bgmGain: GainNode | null = null;
  private isMuted: boolean = false;
  private isInitialized: boolean = false;

  constructor() {}

  init() {
    if (this.isInitialized) return;
    
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    this.ctx = new AudioContextClass();
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = 0.2; // Master volume
    this.masterGain.connect(this.ctx.destination);
    this.isInitialized = true;

    this.startBGM();
  }

  toggleMute(muted: boolean) {
    this.isMuted = muted;
    if (this.masterGain) {
      // Ramp to avoid clicking
      const t = this.ctx?.currentTime || 0;
      this.masterGain.gain.setTargetAtTime(muted ? 0 : 0.2, t, 0.1);
    }
    
    if (!muted && this.ctx?.state === 'suspended') {
      this.ctx.resume();
    }
  }

  private startBGM() {
    if (!this.ctx || !this.masterGain) return;

    this.bgmGain = this.ctx.createGain();
    this.bgmGain.gain.value = 0.05; // Quiet ambience
    this.bgmGain.connect(this.masterGain);

    // Create a drone sound (low frequency oscillators)
    const freqs = [55, 110, 112]; // Low A, slightly detuned
    freqs.forEach(f => {
      const osc = this.ctx!.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.value = f;
      osc.connect(this.bgmGain!);
      osc.start();
      this.bgmOscillators.push(osc);
    });

    // LFO to modulate volume slightly for "alive" feel
    const lfo = this.ctx.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.value = 0.1;
    const lfoGain = this.ctx.createGain();
    lfoGain.gain.value = 0.02;
    lfo.connect(lfoGain);
    lfoGain.connect(this.bgmGain.gain);
    lfo.start();
    this.bgmOscillators.push(lfo);
  }

  playSFX(type: 'GATHER' | 'ATTACK' | 'BUILD' | 'DEATH' | 'PILLAGE' | 'SPAWN') {
    if (!this.ctx || this.isMuted || !this.masterGain) return;
    if (this.ctx.state === 'suspended') this.ctx.resume();

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    
    osc.connect(gain);
    gain.connect(this.masterGain);

    switch (type) {
      case 'GATHER':
        // High pitched "plink"
        osc.type = 'sine';
        osc.frequency.setValueAtTime(800, t);
        osc.frequency.exponentialRampToValueAtTime(1200, t + 0.1);
        gain.gain.setValueAtTime(0.3, t);
        gain.gain.exponentialRampToValueAtTime(0.01, t + 0.1);
        osc.start(t);
        osc.stop(t + 0.15);
        break;

      case 'ATTACK':
        // Sharp noise/sawtooth
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(150, t);
        osc.frequency.linearRampToValueAtTime(50, t + 0.1);
        gain.gain.setValueAtTime(0.2, t);
        gain.gain.exponentialRampToValueAtTime(0.01, t + 0.1);
        osc.start(t);
        osc.stop(t + 0.1);
        break;

      case 'BUILD':
        // Series of low thuds
        osc.type = 'square';
        osc.frequency.setValueAtTime(100, t);
        gain.gain.setValueAtTime(0.2, t);
        gain.gain.exponentialRampToValueAtTime(0.01, t + 0.1);
        osc.start(t);
        osc.stop(t + 0.1);
        // We could schedule multiple but simple is fine
        break;

      case 'DEATH':
        // Descending slide
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(400, t);
        osc.frequency.exponentialRampToValueAtTime(50, t + 0.4);
        gain.gain.setValueAtTime(0.2, t);
        gain.gain.linearRampToValueAtTime(0, t + 0.4);
        osc.start(t);
        osc.stop(t + 0.4);
        break;

      case 'PILLAGE':
        // Discordant fast sequence
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(600, t);
        osc.frequency.linearRampToValueAtTime(300, t + 0.2);
        gain.gain.setValueAtTime(0.1, t);
        gain.gain.exponentialRampToValueAtTime(0.01, t + 0.2);
        osc.start(t);
        osc.stop(t + 0.2);
        break;
        
      case 'SPAWN':
        // Rising slide
        osc.type = 'sine';
        osc.frequency.setValueAtTime(200, t);
        osc.frequency.exponentialRampToValueAtTime(600, t + 0.3);
        gain.gain.setValueAtTime(0.2, t);
        gain.gain.linearRampToValueAtTime(0, t + 0.3);
        osc.start(t);
        osc.stop(t + 0.3);
        break;
    }
  }
}