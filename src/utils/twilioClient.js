import { Device } from '@twilio/voice-sdk';
import { callEdgeFunction } from '@/lib/supabase';

class TwilioClientManager {
  constructor() {
    this.device = null;
    this.activeCall = null;
    this.isInitialized = false;
    this.onCallAnsweredCallback = null;
    this.onCallEndedCallback = null;
    this.onCallErrorCallback = null;
    this.lastError = null;
    this.missingConfig = null;
  }

  async initialize(userEmail = 'demo@example.com') {
    if (this.isInitialized && this.device) {
      console.log('Twilio Client already initialized');
      return true;
    }

    try {
      const response = await callEdgeFunction('twilioGenerateToken', { userEmail });

      if (!response.success || !response.token) {
        console.warn('Twilio not configured:', response.error || 'Unknown error');
        if (response.missingVars) {
          console.warn('Missing Twilio environment variables:', response.missingVars);
        }
        this.lastError = response.error || 'Twilio not configured';
        this.missingConfig = response.missingVars || null;
        return false;
      }

      this.device = new Device(response.token, {
        codecPreferences: ['opus', 'pcmu'],
        enableImprovedSignalingErrorPrecision: true,
        logLevel: 1,
        maxAverageBitrate: 16000,
      });

      this.device.on('registered', () => {
        console.log('Twilio Device ready to receive calls');
        this.isInitialized = true;
      });

      this.device.on('error', (error) => {
        console.error('Twilio Device Error:', error);
        if (this.onCallErrorCallback) {
          this.onCallErrorCallback(error);
        }
      });

      this.device.on('incoming', (call) => {
        console.log('Incoming call received');
        this.activeCall = call;

        call.on('accept', () => {
          console.log('Call accepted');
          if (this.onCallAnsweredCallback) {
            this.onCallAnsweredCallback(call);
          }
        });

        call.on('disconnect', () => {
          console.log('Call disconnected');
          this.activeCall = null;
          if (this.onCallEndedCallback) {
            this.onCallEndedCallback();
          }
        });

        call.on('cancel', () => {
          console.log('Call canceled');
          this.activeCall = null;
          if (this.onCallEndedCallback) {
            this.onCallEndedCallback();
          }
        });

        call.on('reject', () => {
          console.log('Call rejected');
          this.activeCall = null;
          if (this.onCallEndedCallback) {
            this.onCallEndedCallback();
          }
        });

        call.accept();
      });

      await this.device.register();
      console.log('Twilio Client initialized successfully');
      return true;
    } catch (error) {
      console.error('Error initializing Twilio Client:', error);
      this.isInitialized = false;
      return false;
    }
  }

  async getAudioDevices() {
    if (!this.device) {
      throw new Error('Device not initialized');
    }

    try {
      await this.device.audio.setInputDevice('default');

      const devices = await navigator.mediaDevices.enumerateDevices();

      const audioInputs = devices
        .filter(device => device.kind === 'audioinput')
        .map(device => ({
          deviceId: device.deviceId,
          label: device.label || `Microphone ${device.deviceId.slice(0, 5)}`,
        }));

      const audioOutputs = devices
        .filter(device => device.kind === 'audiooutput')
        .map(device => ({
          deviceId: device.deviceId,
          label: device.label || `Speaker ${device.deviceId.slice(0, 5)}`,
        }));

      return { audioInputs, audioOutputs };
    } catch (error) {
      console.error('Error getting audio devices:', error);
      return { audioInputs: [], audioOutputs: [] };
    }
  }

  async setInputDevice(deviceId) {
    if (!this.device) {
      throw new Error('Device not initialized');
    }

    try {
      await this.device.audio.setInputDevice(deviceId);
      console.log('Input device set to:', deviceId);
    } catch (error) {
      console.error('Error setting input device:', error);
      throw error;
    }
  }

  async setOutputDevice(deviceId) {
    if (!this.device) {
      throw new Error('Device not initialized');
    }

    try {
      await this.device.audio.speakerDevices.set(deviceId);
      console.log('Output device set to:', deviceId);
    } catch (error) {
      console.error('Error setting output device:', error);
      throw error;
    }
  }

  muteCall() {
    if (this.activeCall) {
      this.activeCall.mute(true);
      return true;
    }
    return false;
  }

  unmuteCall() {
    if (this.activeCall) {
      this.activeCall.mute(false);
      return true;
    }
    return false;
  }

  async makeCall(phoneNumber, params = {}) {
    if (!this.device || !this.isInitialized) {
      throw new Error('Twilio Device not initialized. Call initialize() first.');
    }

    if (this.activeCall) {
      throw new Error('Another call is already in progress');
    }

    try {
      const callParams = {
        To: phoneNumber,
        ...params
      };

      console.log('Making call with Device SDK:', callParams);

      const call = await this.device.connect({ params: callParams });
      this.activeCall = call;

      call.on('accept', () => {
        console.log('Outbound call accepted (connected to Twilio)');
      });

      call.on('ringing', () => {
        console.log('Call is ringing');
      });

      call.on('connect', () => {
        console.log('Call connected (other party answered)');
        if (this.onCallAnsweredCallback) {
          this.onCallAnsweredCallback(call);
        }
      });

      call.on('disconnect', () => {
        console.log('Call disconnected');
        this.activeCall = null;
        if (this.onCallEndedCallback) {
          this.onCallEndedCallback();
        }
      });

      call.on('cancel', () => {
        console.log('Call canceled');
        this.activeCall = null;
        if (this.onCallEndedCallback) {
          this.onCallEndedCallback();
        }
      });

      call.on('error', (error) => {
        console.error('Call error:', error);
        this.activeCall = null;
        if (this.onCallErrorCallback) {
          this.onCallErrorCallback(error);
        }
      });

      return call;
    } catch (error) {
      console.error('Error making call:', error);
      this.activeCall = null;
      throw error;
    }
  }

  disconnectCall() {
    if (this.activeCall) {
      this.activeCall.disconnect();
      this.activeCall = null;
      return true;
    }
    return false;
  }

  onCallAnswered(callback) {
    this.onCallAnsweredCallback = callback;
  }

  onCallEnded(callback) {
    this.onCallEndedCallback = callback;
  }

  onCallError(callback) {
    this.onCallErrorCallback = callback;
  }

  async destroy() {
    if (this.activeCall) {
      this.activeCall.disconnect();
      this.activeCall = null;
    }

    if (this.device) {
      this.device.destroy();
      this.device = null;
    }

    this.isInitialized = false;
  }

  isReady() {
    return this.isInitialized && this.device !== null;
  }

  hasActiveCall() {
    return this.activeCall !== null;
  }

  getLastError() {
    return this.lastError;
  }

  getMissingConfig() {
    return this.missingConfig;
  }
}

export const twilioClientManager = new TwilioClientManager();
