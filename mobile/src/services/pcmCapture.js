import { NativeModules, NativeEventEmitter } from 'react-native';

const { PcmCapture } = NativeModules;
const emitter = new NativeEventEmitter(PcmCapture);

let chunkCount = 0;

export const startPcmCapture = ({ sampleRate = 24000, onData } = {}) => {
  chunkCount = 0;

  const subscription = emitter.addListener('pcmData', (base64Data) => {
    chunkCount++;
    onData?.(base64Data);
  });

  PcmCapture.init({ sampleRate });
  PcmCapture.start();

  return {
    stop: () => {
      subscription.remove();
      PcmCapture.stop();
    }
  };
};
