/**
 * Web Audio API sound manager for racing game.
 * Generates procedural sounds for engine and tire squeals.
 */
export class SoundManager {
  private audioContext: AudioContext;
  private masterGain: GainNode;

  private engineOsc: OscillatorNode | null = null;
  private engineGain: GainNode;
  private engineFilter: BiquadFilterNode;

  private tireOsc: OscillatorNode | null = null;
  private tireGain: GainNode;

  constructor() {
    this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    this.masterGain = this.audioContext.createGain();
    this.masterGain.gain.value = 0.1; // Keep it quiet
    this.masterGain.connect(this.audioContext.destination);

    // Engine oscillator (plays continuously)
    this.engineGain = this.audioContext.createGain();
    this.engineGain.connect(this.masterGain);

    this.engineFilter = this.audioContext.createBiquadFilter();
    this.engineFilter.type = 'lowpass';
    this.engineFilter.frequency.value = 400;
    this.engineFilter.connect(this.engineGain);

    // Tire squeal oscillator (optional, triggered by turning)
    this.tireGain = this.audioContext.createGain();
    this.tireGain.gain.value = 0;
    this.tireGain.connect(this.masterGain);

    this.startEngine();
  }

  private startEngine(): void {
    if (this.engineOsc) return;

    this.engineOsc = this.audioContext.createOscillator();
    this.engineOsc.type = 'sine';
    this.engineOsc.frequency.value = 100; // Base frequency
    this.engineOsc.connect(this.engineFilter);
    this.engineOsc.start();
  }

  /**
   * Update engine sound based on speed and acceleration.
   *
   * @param speed Current forward speed (m/s). Can be negative (reversing).
   * @param maxSpeed Max forward speed (m/s).
   * @param accel Current acceleration magnitude (0-1, normalized).
   */
  updateEngineSound(speed: number, maxSpeed: number, accel: number = 0): void {
    if (!this.engineOsc) return;

    const absSpeed = Math.abs(speed);
    const speedRatio = Math.min(1, absSpeed / maxSpeed);

    // Engine pitch scales with speed: 100 Hz idle → 800 Hz at max speed
    const basePitch = 100 + speedRatio * 700;
    // Add rev-up when accelerating
    const revPitch = accel * 200;
    this.engineOsc.frequency.setTargetAtTime(
      basePitch + revPitch,
      this.audioContext.currentTime,
      0.1
    );

    // Engine volume: higher when moving
    const engineVol = 0.05 + speedRatio * 0.15;
    this.engineGain.gain.setTargetAtTime(engineVol, this.audioContext.currentTime, 0.05);

    // Filter cutoff follows speed (higher pitch more presence)
    this.engineFilter.frequency.setTargetAtTime(
      400 + speedRatio * 600,
      this.audioContext.currentTime,
      0.1
    );
  }

  /**
   * Trigger tire squeal based on lateral acceleration / turning sharpness.
   *
   * @param lateralForce Magnitude of turning (0-1, normalized where 1 = max steering input).
   * @param speed Current speed (m/s). Squeals only at higher speeds.
   */
  updateTireSqueals(lateralForce: number, speed: number): void {
    const absSpeed = Math.abs(speed);
    const speedThreshold = 15; // Only squeal above ~54 km/h

    if (absSpeed < speedThreshold || lateralForce < 0.3) {
      // Stop squealing
      if (this.tireOsc) {
        this.tireGain.gain.setTargetAtTime(0, this.audioContext.currentTime, 0.05);
      }
      return;
    }

    // Start squeal if not already squealing
    if (!this.tireOsc) {
      this.tireOsc = this.audioContext.createOscillator();
      this.tireOsc.type = 'triangle';
      this.tireOsc.connect(this.tireGain);
      this.tireOsc.start();
    }

    // Squeal pitch: 800-1600 Hz based on turning intensity
    const squeelPitch = 800 + lateralForce * 800;
    this.tireOsc.frequency.setTargetAtTime(squeelPitch, this.audioContext.currentTime, 0.05);

    // Squeal volume: scales with lateral force and speed
    const speedFactor = Math.min(1, (absSpeed - speedThreshold) / 20);
    const squeelVol = lateralForce * speedFactor * 0.1;
    this.tireGain.gain.setTargetAtTime(squeelVol, this.audioContext.currentTime, 0.05);
  }

  /** Stop all sounds. */
  stop(): void {
    if (this.engineOsc) {
      this.engineOsc.stop();
      this.engineOsc = null;
    }
    if (this.tireOsc) {
      this.tireOsc.stop();
      this.tireOsc = null;
    }
  }
}
