import { Melody } from './content-types';

const NOTE_FREQUENCIES: { [key: string]: number } = {
  'C1': 32.70, 'C#1': 34.65, 'D1': 36.71, 'D#1': 38.89, 'E1': 41.20, 'F1': 43.65, 'F#1': 46.25, 'G1': 49.00, 'G#1': 51.91, 'A1': 55.00, 'A#1': 58.27, 'B1': 61.74,
  'C2': 65.41, 'C#2': 69.30, 'D2': 73.42, 'D#2': 77.78, 'E2': 82.41, 'F2': 87.31, 'F#2': 92.50, 'G2': 98.00, 'G#2': 103.8, 'A2': 110.0, 'A#2': 116.5, 'B2': 123.5,
  'C3': 130.8, 'C#3': 138.6, 'D3': 146.8, 'D#3': 155.6, 'E3': 164.8, 'F3': 174.6, 'F#3': 185.0, 'G3': 196.0, 'G#3': 207.7, 'A3': 220.0, 'A#3': 233.1, 'B3': 246.9,
  'C4': 261.6, 'C#4': 277.2, 'D4': 293.7, 'D#4': 311.1, 'E4': 329.6, 'F4': 349.2, 'F#4': 370.0, 'G4': 392.0, 'G#4': 415.3, 'A4': 440.0, 'A#4': 466.2, 'B4': 493.9,
  'C5': 523.3, 'C#5': 554.4, 'D5': 587.3, 'D#5': 622.3, 'E5': 659.3, 'F5': 698.5, 'F#5': 740.0, 'G5': 784.0, 'G#5': 830.6, 'A5': 880.0, 'A#5': 932.3, 'B5': 987.8
};

export type SfxType = 'laser' | 'pickup' | 'explosion' | 'damage' | 'boost' | 'portal' | 'hit';

class SoundManager {
    private audioContext: AudioContext | null = null;
    private mainGain: GainNode | null = null;
    private isMuted = false;
    private isInitialized = false;
    private melody: Melody | null = null;
    private musicScheduler: number | null = null;

    public async init(): Promise<void> {
        if (this.isInitialized) return;
        try {
            this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
            this.mainGain = this.audioContext.createGain();
            this.mainGain.connect(this.audioContext.destination);
            this.isInitialized = true;
            console.log("AudioContext initialized successfully.");
            // If context was suspended, resume it
            if (this.audioContext.state === 'suspended') {
                await this.audioContext.resume();
            }
        } catch (e) {
            console.error("Web Audio API is not supported in this browser or failed to initialize.", e);
        }
    }

    public setMelody(melody: Melody) {
        this.melody = melody;
    }
    
    public startBGM() {
        if (!this.isInitialized || !this.melody || this.musicScheduler !== null) return;
        const loop = () => {
            this.playMelody();
            this.musicScheduler = window.setTimeout(loop, this.melody!.loopDuration * 1000);
        };
        loop();
        console.log("BGM started.");
    }

    public stopBGM() {
        if (this.musicScheduler !== null) {
            clearTimeout(this.musicScheduler);
            this.musicScheduler = null;
            console.log("BGM stopped.");
        }
    }

    private playMelody() {
        if (!this.audioContext || !this.melody) return;
        const now = this.audioContext.currentTime;

        Object.values(this.melody).forEach(track => {
            if (typeof track === 'object' && track.notes) {
                const trackGain = this.audioContext!.createGain();
                trackGain.gain.value = track.gain;
                trackGain.connect(this.mainGain!);

                track.notes.forEach(noteInfo => {
                    const freq = NOTE_FREQUENCIES[noteInfo.note];
                    if (freq) {
                        const osc = this.audioContext!.createOscillator();
                        osc.type = track.instrument;
                        osc.frequency.setValueAtTime(freq, now + noteInfo.time);

                        const noteGain = this.audioContext!.createGain();
                        noteGain.gain.setValueAtTime(1, now + noteInfo.time);
                        noteGain.gain.exponentialRampToValueAtTime(0.001, now + noteInfo.time + noteInfo.duration);
                        
                        osc.connect(noteGain);
                        noteGain.connect(trackGain);

                        osc.start(now + noteInfo.time);
                        osc.stop(now + noteInfo.time + noteInfo.duration);
                    }
                });
            }
        });
    }

    public playSoundEffect(type: SfxType) {
        if (!this.isInitialized || !this.audioContext || this.isMuted) return;

        const now = this.audioContext.currentTime;
        const sfxGain = this.audioContext.createGain();
        sfxGain.connect(this.mainGain!);

        let osc: OscillatorNode;

        switch(type) {
            case 'laser':
                sfxGain.gain.value = 0.1;
                osc = this.audioContext.createOscillator();
                osc.type = 'sawtooth';
                osc.frequency.setValueAtTime(880, now);
                osc.frequency.exponentialRampToValueAtTime(300, now + 0.15);
                sfxGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.15);
                osc.connect(sfxGain);
                osc.start(now);
                osc.stop(now + 0.15);
                break;
            
            case 'pickup':
                sfxGain.gain.value = 0.2;
                osc = this.audioContext.createOscillator();
                osc.type = 'sine';
                osc.frequency.setValueAtTime(900, now);
                osc.frequency.exponentialRampToValueAtTime(1200, now + 0.1);
                sfxGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.1);
                osc.connect(sfxGain);
                osc.start(now);
                osc.stop(now + 0.1);
                break;
                
            case 'explosion':
                sfxGain.gain.value = 0.5;
                const noise = this.createNoiseBuffer(0.5);
                noise.connect(sfxGain);
                sfxGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.5);
                noise.start(now);
                break;
                
            case 'damage':
                sfxGain.gain.value = 0.3;
                osc = this.audioContext.createOscillator();
                osc.type = 'square';
                osc.frequency.setValueAtTime(120, now);
                osc.frequency.exponentialRampToValueAtTime(40, now + 0.2);
                sfxGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.2);
                osc.connect(sfxGain);
                osc.start(now);
                osc.stop(now + 0.2);
                break;

            case 'boost':
                sfxGain.gain.value = 0.15;
                osc = this.audioContext.createOscillator();
                osc.type = 'sine';
                osc.frequency.setValueAtTime(200, now);
                osc.frequency.exponentialRampToValueAtTime(500, now + 0.3);
                sfxGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.3);
                osc.connect(sfxGain);
                osc.start(now);
                osc.stop(now + 0.3);
                break;
            
            case 'portal':
                sfxGain.gain.value = 0.4;
                osc = this.audioContext.createOscillator();
                osc.type = 'sawtooth';
                osc.frequency.setValueAtTime(100, now);
                osc.frequency.exponentialRampToValueAtTime(1500, now + 0.8);
                sfxGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.8);
                osc.connect(sfxGain);
                osc.start(now);
                osc.stop(now + 0.8);
                break;
            
            case 'hit':
                 sfxGain.gain.value = 0.4;
                 const hitNoise = this.createNoiseBuffer(0.1);
                 hitNoise.connect(sfxGain);
                 sfxGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.1);
                 hitNoise.start(now);
                 break;
        }
    }
    
    private createNoiseBuffer(duration: number): AudioBufferSourceNode {
        const bufferSize = this.audioContext!.sampleRate * duration;
        const buffer = this.audioContext!.createBuffer(1, bufferSize, this.audioContext!.sampleRate);
        const output = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            output[i] = Math.random() * 2 - 1;
        }
        const noise = this.audioContext!.createBufferSource();
        noise.buffer = buffer;
        return noise;
    }

    public toggleMute(): boolean {
        if (!this.isInitialized || !this.mainGain) return this.isMuted;
        this.isMuted = !this.isMuted;
        this.mainGain.gain.setValueAtTime(this.isMuted ? 0 : 1, this.audioContext!.currentTime);
        console.log(`Audio ${this.isMuted ? 'muted' : 'unmuted'}.`);
        return this.isMuted;
    }
}

export const soundManager = new SoundManager();
