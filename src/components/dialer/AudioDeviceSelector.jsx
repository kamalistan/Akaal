import React, { useState, useEffect } from 'react';
import { Mic, Volume2, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { twilioClientManager } from '@/utils/twilioClient';

export default function AudioDeviceSelector() {
  const [audioInputs, setAudioInputs] = useState([]);
  const [audioOutputs, setAudioOutputs] = useState([]);
  const [selectedInput, setSelectedInput] = useState('default');
  const [selectedOutput, setSelectedOutput] = useState('default');
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadDevices();
    }
  }, [isOpen]);

  const loadDevices = async () => {
    try {
      const devices = await twilioClientManager.getAudioDevices();
      setAudioInputs(devices.audioInputs);
      setAudioOutputs(devices.audioOutputs);
    } catch (error) {
      console.error('Failed to load audio devices:', error);
    }
  };

  const handleInputChange = async (deviceId) => {
    try {
      await twilioClientManager.setInputDevice(deviceId);
      setSelectedInput(deviceId);
    } catch (error) {
      console.error('Failed to set input device:', error);
    }
  };

  const handleOutputChange = async (deviceId) => {
    try {
      await twilioClientManager.setOutputDevice(deviceId);
      setSelectedOutput(deviceId);
    } catch (error) {
      console.error('Failed to set output device:', error);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="icon" className="rounded-full">
          <Settings className="w-4 h-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Audio Device Settings</DialogTitle>
          <DialogDescription>
            Select your preferred microphone and speaker for calls
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-6 py-4">
          <div className="space-y-3">
            <Label htmlFor="input-device" className="flex items-center gap-2">
              <Mic className="w-4 h-4" />
              Microphone
            </Label>
            <Select value={selectedInput} onValueChange={handleInputChange}>
              <SelectTrigger id="input-device">
                <SelectValue placeholder="Select microphone" />
              </SelectTrigger>
              <SelectContent>
                {audioInputs.length === 0 && (
                  <SelectItem value="default">Default Microphone</SelectItem>
                )}
                {audioInputs.map((device) => (
                  <SelectItem key={device.deviceId} value={device.deviceId}>
                    {device.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-3">
            <Label htmlFor="output-device" className="flex items-center gap-2">
              <Volume2 className="w-4 h-4" />
              Speaker
            </Label>
            <Select value={selectedOutput} onValueChange={handleOutputChange}>
              <SelectTrigger id="output-device">
                <SelectValue placeholder="Select speaker" />
              </SelectTrigger>
              <SelectContent>
                {audioOutputs.length === 0 && (
                  <SelectItem value="default">Default Speaker</SelectItem>
                )}
                {audioOutputs.map((device) => (
                  <SelectItem key={device.deviceId} value={device.deviceId}>
                    {device.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="pt-4 border-t">
            <p className="text-sm text-slate-500">
              Make sure to allow microphone access when prompted by your browser
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
