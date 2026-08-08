
"use strict";

(function (global) {
  if (global.ZXingBrowser && !global.ZXingBrowser.__localAdapter) return;

  const requestedFormats = [
    "ean_13", "ean_8", "code_128", "code_39",
    "qr_code", "upc_a", "upc_e"
  ];

  class BrowserMultiFormatReader {
    async decodeFromConstraints(constraints, videoElement, callback) {
      if (!("BarcodeDetector" in global)) {
        const error = new Error("BARCODE_DETECTOR_NOT_SUPPORTED");
        error.name = "NotSupportedError";
        throw error;
      }

      let formats = requestedFormats;
      if (typeof global.BarcodeDetector.getSupportedFormats === "function") {
        const supported = await global.BarcodeDetector.getSupportedFormats();
        formats = requestedFormats.filter(function (format) {
          return supported.includes(format);
        });
      }

      const detector = formats.length
        ? new global.BarcodeDetector({ formats: formats })
        : new global.BarcodeDetector();
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      videoElement.srcObject = stream;
      await videoElement.play();

      let stopped = false;
      let busy = false;
      let frameId = null;
      let torchOn = false;
      const videoTrack = stream.getVideoTracks()[0] || null;

      const controls = {
        stop: function () {
          stopped = true;
          if (frameId !== null) cancelAnimationFrame(frameId);
          stream.getTracks().forEach(function (track) { track.stop(); });
          if (videoElement.srcObject === stream) videoElement.srcObject = null;
        },
        switchTorch: async function () {
          if (!videoTrack || typeof videoTrack.getCapabilities !== "function") {
            throw new Error("TORCH_NOT_SUPPORTED");
          }
          const capabilities = videoTrack.getCapabilities();
          if (!capabilities.torch) throw new Error("TORCH_NOT_SUPPORTED");
          torchOn = !torchOn;
          await videoTrack.applyConstraints({ advanced: [{ torch: torchOn }] });
          return torchOn;
        }
      };

      const scan = async function () {
        if (stopped) return;
        if (!busy && videoElement.readyState >= 2) {
          busy = true;
          try {
            const results = await detector.detect(videoElement);
            if (results && results.length > 0) {
              const rawValue = String(results[0].rawValue || "");
              const result = {
                text: rawValue,
                getText: function () { return rawValue; }
              };
              callback(result, null, controls);
            }
          } catch (error) {
            callback(null, error, controls);
          } finally {
            busy = false;
          }
        }
        frameId = requestAnimationFrame(scan);
      };
      frameId = requestAnimationFrame(scan);
      return controls;
    }
  }

  class BrowserCodeReader {
    static async listVideoInputDevices() {
      const devices = await navigator.mediaDevices.enumerateDevices();
      return devices.filter(function (device) {
        return device.kind === "videoinput";
      });
    }
  }

  global.ZXingBrowser = {
    BrowserMultiFormatReader: BrowserMultiFormatReader,
    BrowserCodeReader: BrowserCodeReader,
    __localAdapter: true,
    __version: "native-barcode-detector-adapter-v1"
  };
})(window);
