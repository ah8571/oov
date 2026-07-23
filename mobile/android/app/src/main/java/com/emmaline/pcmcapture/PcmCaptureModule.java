package com.emmaline.pcmcapture;

import android.media.AudioFormat;
import android.media.AudioRecord;
import android.media.MediaRecorder;
import android.util.Base64;

import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.ReadableMap;
import com.facebook.react.modules.core.DeviceEventManagerModule;

public class PcmCaptureModule extends ReactContextBaseJavaModule {

    private static final int PCM_BYTES_PER_SAMPLE = 2;
    private static final int TARGET_CHUNK_MS = 100;

    private final ReactApplicationContext reactContext;
    private AudioRecord audioRecord;
    private Thread recordingThread;
    private volatile boolean isRecording = false;
    private int sampleRate = 24000;
    private int bufferSize;
    private int chunkBytes;

    public PcmCaptureModule(ReactApplicationContext reactContext) {
        super(reactContext);
        this.reactContext = reactContext;
    }

    @Override
    public String getName() {
        return "PcmCapture";
    }

    @ReactMethod
    public void init(ReadableMap options) {
        if (options.hasKey("sampleRate")) {
            sampleRate = options.getInt("sampleRate");
        }
        int channelConfig = AudioFormat.CHANNEL_IN_MONO;
        int audioFormat = AudioFormat.ENCODING_PCM_16BIT;
        int minBufferSize = AudioRecord.getMinBufferSize(sampleRate, channelConfig, audioFormat);
        chunkBytes = Math.max((sampleRate * PCM_BYTES_PER_SAMPLE * TARGET_CHUNK_MS) / 1000, PCM_BYTES_PER_SAMPLE);
        bufferSize = Math.max(minBufferSize, chunkBytes * 2);
    }

    @ReactMethod
    public void start() {
        if (isRecording) return;
        isRecording = true;

        recordingThread = new Thread(() -> {
            android.os.Process.setThreadPriority(android.os.Process.THREAD_PRIORITY_AUDIO);

            int channelConfig = AudioFormat.CHANNEL_IN_MONO;
            int audioFormat = AudioFormat.ENCODING_PCM_16BIT;

            try {
                audioRecord = new AudioRecord(
                    MediaRecorder.AudioSource.VOICE_RECOGNITION,
                    sampleRate,
                    channelConfig,
                    audioFormat,
                    bufferSize
                );

                if (audioRecord.getState() != AudioRecord.STATE_INITIALIZED) {
                    throw new IllegalStateException("AudioRecord failed to initialize");
                }

                audioRecord.startRecording();

                if (audioRecord.getRecordingState() != AudioRecord.RECORDSTATE_RECORDING) {
                    throw new IllegalStateException("AudioRecord failed to start recording");
                }

                byte[] buffer = new byte[chunkBytes];

                while (isRecording) {
                    int bytesRead = audioRecord.read(buffer, 0, buffer.length);
                    if (bytesRead > 0 && isRecording) {
                        byte[] chunk = new byte[bytesRead];
                        System.arraycopy(buffer, 0, chunk, 0, bytesRead);
                        String base64Data = Base64.encodeToString(chunk, Base64.NO_WRAP);

                        reactContext
                            .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter.class)
                            .emit("pcmData", base64Data);
                    }
                }
            } catch (Exception e) {
                // AudioRecord error ΓÇö silently stop
            } finally {
                if (audioRecord != null) {
                    try { audioRecord.stop(); } catch (Exception ignored) {}
                    try { audioRecord.release(); } catch (Exception ignored) {}
                    audioRecord = null;
                }
            }
        }, "PcmCaptureThread");
        recordingThread.start();
    }

    @ReactMethod
    public void stop() {
        isRecording = false;

        if (audioRecord != null) {
            try { audioRecord.stop(); } catch (Exception ignored) {}
        }

        if (recordingThread != null) {
            try { recordingThread.join(500); } catch (InterruptedException ignored) {}
            recordingThread = null;
        }
    }
}
