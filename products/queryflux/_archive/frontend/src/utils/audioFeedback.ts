export class AudioFeedback {
  private context: AudioContext | null = null;
  private enabled: boolean = true;

  constructor() {
    if (typeof window !== 'undefined' && 'AudioContext' in window) {
      this.context = new AudioContext();
    }
  }

  setEnabled(enabled: boolean) {
    this.enabled = enabled;
  }

  private playTone(frequency: number, duration: number, type: OscillatorType = 'sine', volume: number = 0.3) {
    if (!this.enabled || !this.context) return;

    const oscillator = this.context.createOscillator();
    const gainNode = this.context.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(this.context.destination);

    oscillator.type = type;
    oscillator.frequency.value = frequency;

    gainNode.gain.setValueAtTime(volume, this.context.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, this.context.currentTime + duration);

    oscillator.start(this.context.currentTime);
    oscillator.stop(this.context.currentTime + duration);
  }

  success() {
    this.playTone(800, 0.1, 'sine', 0.2);
    setTimeout(() => this.playTone(1000, 0.15, 'sine', 0.2), 100);
  }

  error() {
    this.playTone(300, 0.2, 'square', 0.15);
    setTimeout(() => this.playTone(250, 0.2, 'square', 0.15), 150);
  }

  click() {
    this.playTone(600, 0.05, 'sine', 0.1);
  }

  connect() {
    this.playTone(400, 0.1, 'sine', 0.15);
    setTimeout(() => this.playTone(600, 0.1, 'sine', 0.15), 100);
    setTimeout(() => this.playTone(800, 0.15, 'sine', 0.15), 200);
  }

  disconnect() {
    this.playTone(800, 0.1, 'sine', 0.15);
    setTimeout(() => this.playTone(600, 0.1, 'sine', 0.15), 100);
    setTimeout(() => this.playTone(400, 0.15, 'sine', 0.15), 200);
  }

  queryExecute() {
    this.playTone(500, 0.05, 'triangle', 0.12);
    setTimeout(() => this.playTone(700, 0.08, 'triangle', 0.12), 50);
  }

  notification() {
    this.playTone(900, 0.1, 'sine', 0.15);
  }

  toggle() {
    this.playTone(700, 0.08, 'square', 0.1);
  }
}

export const audioFeedback = new AudioFeedback();
