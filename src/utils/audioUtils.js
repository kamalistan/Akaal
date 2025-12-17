class CallAudioManager {
  constructor() {
    this.audioContext = null;
    this.currentSound = null;
    this.isMuted = false;
    this.initAudioContext();
  }

  initAudioContext() {
    try {
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
    } catch (e) {
      console.warn('Web Audio API not supported');
    }
  }

  resumeContext() {
    if (this.audioContext && this.audioContext.state === 'suspended') {
      this.audioContext.resume();
    }
  }

  playDialingSound() {
    if (this.isMuted || !this.audioContext) return;

    this.stopAllSounds();
    this.resumeContext();

    const playBeep = () => {
      if (this.currentSound !== 'dialing') return;

      const oscillator = this.audioContext.createOscillator();
      const gainNode = this.audioContext.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(this.audioContext.destination);

      oscillator.frequency.value = 480;
      oscillator.type = 'sine';

      gainNode.gain.setValueAtTime(0.1, this.audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.1);

      oscillator.start(this.audioContext.currentTime);
      oscillator.stop(this.audioContext.currentTime + 0.1);

      setTimeout(playBeep, 500);
    };

    this.currentSound = 'dialing';
    playBeep();
  }

  playRingingSound() {
    if (this.isMuted || !this.audioContext) return;

    this.stopAllSounds();
    this.resumeContext();

    const playRing = () => {
      if (this.currentSound !== 'ringing') return;

      const oscillator1 = this.audioContext.createOscillator();
      const oscillator2 = this.audioContext.createOscillator();
      const gainNode = this.audioContext.createGain();

      oscillator1.connect(gainNode);
      oscillator2.connect(gainNode);
      gainNode.connect(this.audioContext.destination);

      oscillator1.frequency.value = 440;
      oscillator2.frequency.value = 480;
      oscillator1.type = 'sine';
      oscillator2.type = 'sine';

      gainNode.gain.setValueAtTime(0.15, this.audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.4);

      oscillator1.start(this.audioContext.currentTime);
      oscillator2.start(this.audioContext.currentTime);
      oscillator1.stop(this.audioContext.currentTime + 0.4);
      oscillator2.stop(this.audioContext.currentTime + 0.4);

      setTimeout(() => {
        if (this.currentSound !== 'ringing') return;

        const osc1 = this.audioContext.createOscillator();
        const osc2 = this.audioContext.createOscillator();
        const gain = this.audioContext.createGain();

        osc1.connect(gain);
        osc2.connect(gain);
        gain.connect(this.audioContext.destination);

        osc1.frequency.value = 440;
        osc2.frequency.value = 480;
        osc1.type = 'sine';
        osc2.type = 'sine';

        gain.gain.setValueAtTime(0.15, this.audioContext.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.4);

        osc1.start(this.audioContext.currentTime);
        osc2.start(this.audioContext.currentTime);
        osc1.stop(this.audioContext.currentTime + 0.4);
        osc2.stop(this.audioContext.currentTime + 0.4);

        setTimeout(playRing, 4000);
      }, 800);
    };

    this.currentSound = 'ringing';
    playRing();
  }

  playConnectedSound() {
    if (this.isMuted || !this.audioContext) return;

    this.stopAllSounds();
    this.resumeContext();

    const oscillator = this.audioContext.createOscillator();
    const gainNode = this.audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(this.audioContext.destination);

    oscillator.frequency.value = 800;
    oscillator.type = 'sine';

    gainNode.gain.setValueAtTime(0.2, this.audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.2);

    oscillator.start(this.audioContext.currentTime);
    oscillator.stop(this.audioContext.currentTime + 0.2);

    this.currentSound = null;
  }

  stopAllSounds() {
    this.currentSound = null;
  }

  toggleMute() {
    this.isMuted = !this.isMuted;
    if (this.isMuted) {
      this.stopAllSounds();
    }
    return this.isMuted;
  }

  setMuted(muted) {
    this.isMuted = muted;
    if (muted) {
      this.stopAllSounds();
    }
  }
}

export const callAudioManager = new CallAudioManager();
