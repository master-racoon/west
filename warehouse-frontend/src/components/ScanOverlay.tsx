import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Html5Qrcode } from "html5-qrcode";

type ScanMode = "barcode" | "ocr";

interface ScanOverlayProps {
  onBarcodeScan: (value: string) => void;
  onTextCapture?: (value: string) => void;
  onClose: () => void;
  enableOcr?: boolean;
}

export function ScanOverlay({
  onBarcodeScan,
  onTextCapture,
  onClose,
  enableOcr = false,
}: ScanOverlayProps) {
  const [mode, setMode] = useState<ScanMode>("barcode");
  const [error, setError] = useState<string | null>(null);
  const [ocrText, setOcrText] = useState("");
  const [isProcessingOcr, setIsProcessingOcr] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const videoContainerRef = useRef<HTMLDivElement | null>(null);
  const ocrVideoRef = useRef<HTMLVideoElement | null>(null);
  const ocrStreamRef = useRef<MediaStream | null>(null);
  const hasScannedRef = useRef(false);
  const isMountedRef = useRef(true);

  const stopScanner = useCallback(async () => {
    const scanner = scannerRef.current;
    if (scanner) {
      try {
        const state = scanner.getState();
        if (state === 2) {
          await scanner.stop();
        }
      } catch {
        // scanner already stopped
      }
      try {
        scanner.clear();
      } catch {
        // ignore
      }
      scannerRef.current = null;
    }
  }, []);

  const stopOcrPreview = useCallback(() => {
    if (ocrStreamRef.current) {
      ocrStreamRef.current.getTracks().forEach((t) => t.stop());
      ocrStreamRef.current = null;
    }
  }, []);

  const startOcrPreview = useCallback(async () => {
    stopOcrPreview();
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
      });
      if (!isMountedRef.current) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      ocrStreamRef.current = stream;
      if (ocrVideoRef.current) {
        ocrVideoRef.current.srcObject = stream;
      }
    } catch (err) {
      if (isMountedRef.current) {
        setError(
          err instanceof Error
            ? err.message
            : "Camera access denied or unavailable",
        );
      }
    }
  }, [stopOcrPreview]);

  const startBarcodeScanner = useCallback(async () => {
    if (!videoContainerRef.current || hasScannedRef.current) return;

    await stopScanner();
    setError(null);
    setCameraReady(false);

    const containerId = "scan-overlay-reader";
    videoContainerRef.current.id = containerId;

    try {
      const scanner = new Html5Qrcode(containerId);
      scannerRef.current = scanner;

      await scanner.start(
        { facingMode: "environment" },
        {
          fps: 10,
          qrbox: (vw: number, vh: number) => ({
            width: Math.min(Math.floor(vw * 0.8), 320),
            height: Math.min(Math.floor(vh * 0.35), 200),
          }),
        },
        (decodedText) => {
          if (hasScannedRef.current) return;
          hasScannedRef.current = true;
          void stopScanner().then(() => {
            onBarcodeScan(decodedText);
          });
        },
        () => {
          // scan miss — do nothing
        },
      );

      if (isMountedRef.current) {
        setCameraReady(true);
      }
    } catch (err) {
      if (isMountedRef.current) {
        setError(
          err instanceof Error
            ? err.message
            : "Camera access denied or unavailable",
        );
      }
    }
  }, [onBarcodeScan, stopScanner]);

  useEffect(() => {
    isMountedRef.current = true;
    hasScannedRef.current = false;

    if (mode === "barcode") {
      stopOcrPreview();
      void startBarcodeScanner();
    } else {
      void stopScanner();
      void startOcrPreview();
    }

    return () => {
      isMountedRef.current = false;
      void stopScanner();
      stopOcrPreview();
    };
  }, [mode, startBarcodeScanner, stopScanner, startOcrPreview, stopOcrPreview]);

  const handleCaptureText = async () => {
    const videoEl = ocrVideoRef.current;
    if (!videoEl || !videoEl.videoWidth) return;

    setIsProcessingOcr(true);
    setError(null);

    try {
      const canvas = document.createElement("canvas");
      canvas.width = videoEl.videoWidth;
      canvas.height = videoEl.videoHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Failed to create canvas context");
      ctx.drawImage(videoEl, 0, 0);

      stopOcrPreview();

      const { createWorker } = await import("tesseract.js");
      const worker = await createWorker("eng");
      const result = await worker.recognize(canvas);
      await worker.terminate();

      if (isMountedRef.current) {
        setOcrText(result.data.text.trim());
      }
    } catch (err) {
      if (isMountedRef.current) {
        setError(err instanceof Error ? err.message : "Failed to capture text");
      }
    } finally {
      if (isMountedRef.current) {
        setIsProcessingOcr(false);
      }
    }
  };

  const handleConfirmOcrText = () => {
    const trimmed = ocrText.trim();
    if (trimmed && onTextCapture) {
      onTextCapture(trimmed);
    }
  };

  const handleModeSwitch = (newMode: ScanMode) => {
    setMode(newMode);
    setError(null);
    setOcrText("");
  };

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex flex-col"
      style={{ background: "#000" }}
    >
      {/* Scoped overrides for html5-qrcode's default scan region */}
      <style>{`
        #scan-overlay-reader video {
          object-fit: cover !important;
        }
        #scan-overlay-reader img[alt="Info"] {
          display: none !important;
        }
        #scan-overlay-reader {
          border: none !important;
        }
      `}</style>

      {/* Top bar */}
      <div
        className="relative z-10 flex items-center justify-between px-4"
        style={{
          paddingTop: "env(safe-area-inset-top, 12px)",
          paddingBottom: 12,
          background: "rgba(0,0,0,0.6)",
        }}
      >
        <h3 style={{ color: "#fff", fontSize: 17, fontWeight: 600, margin: 0 }}>
          {mode === "barcode" ? "Scan Barcode" : "Read Text"}
        </h3>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close scanner"
          style={{
            width: 44,
            height: 44,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "rgba(255,255,255,0.15)",
            borderRadius: "50%",
            border: "none",
            cursor: "pointer",
          }}
        >
          <svg
            width="20"
            height="20"
            fill="none"
            stroke="#fff"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      </div>

      {/* Mode toggle */}
      {enableOcr && (
        <div
          className="relative z-10 flex"
          style={{ background: "rgba(0,0,0,0.5)" }}
        >
          <button
            type="button"
            onClick={() => handleModeSwitch("barcode")}
            style={{
              flex: 1,
              padding: "10px 0",
              fontSize: 14,
              fontWeight: 500,
              textAlign: "center",
              color: mode === "barcode" ? "#fff" : "rgba(255,255,255,0.5)",
              background: "none",
              border: "none",
              borderBottomWidth: 2,
              borderBottomStyle: "solid",
              borderBottomColor: mode === "barcode" ? "#3b82f6" : "transparent",
              cursor: "pointer",
            }}
          >
            Barcode
          </button>
          <button
            type="button"
            onClick={() => handleModeSwitch("ocr")}
            style={{
              flex: 1,
              padding: "10px 0",
              fontSize: 14,
              fontWeight: 500,
              textAlign: "center",
              color: mode === "ocr" ? "#fff" : "rgba(255,255,255,0.5)",
              background: "none",
              border: "none",
              borderBottomWidth: 2,
              borderBottomStyle: "solid",
              borderBottomColor: mode === "ocr" ? "#3b82f6" : "transparent",
              cursor: "pointer",
            }}
          >
            Read Text
          </button>
        </div>
      )}

      {/* Camera / content area — fills remaining space */}
      <div style={{ flex: 1, position: "relative", overflow: "hidden" }}>
        {/* Error overlay */}
        {error && (
          <div
            className="relative z-10"
            style={{
              position: "absolute",
              top: 16,
              left: 16,
              right: 16,
              background: "rgba(220,38,38,0.9)",
              color: "#fff",
              borderRadius: 8,
              padding: "10px 14px",
              fontSize: 14,
            }}
          >
            {error}
          </div>
        )}

        {mode === "barcode" && (
          <>
            {/* Camera feed — fills the area */}
            <div
              ref={videoContainerRef}
              style={{ position: "absolute", inset: 0, background: "#111" }}
            />

            {/* Viewfinder overlay */}
            <div
              style={{
                position: "absolute",
                inset: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                pointerEvents: "none",
              }}
            >
              <div style={{ position: "relative", width: 280, height: 180 }}>
                {/* Corner markers */}
                {(
                  ["topLeft", "topRight", "bottomLeft", "bottomRight"] as const
                ).map((corner) => {
                  const isTop = corner.startsWith("top");
                  const isLeft = corner.endsWith("Left");
                  return (
                    <div
                      key={corner}
                      style={{
                        position: "absolute",
                        [isTop ? "top" : "bottom"]: -2,
                        [isLeft ? "left" : "right"]: -2,
                        width: 28,
                        height: 28,
                        borderColor: "#3b82f6",
                        borderStyle: "solid",
                        borderWidth: 0,
                        ...(isTop
                          ? { borderTopWidth: 3 }
                          : { borderBottomWidth: 3 }),
                        ...(isLeft
                          ? { borderLeftWidth: 3 }
                          : { borderRightWidth: 3 }),
                        borderRadius: isTop
                          ? isLeft
                            ? "8px 0 0 0"
                            : "0 8px 0 0"
                          : isLeft
                            ? "0 0 0 8px"
                            : "0 0 8px 0",
                      }}
                    />
                  );
                })}
              </div>
            </div>

            {/* Loading overlay */}
            {!cameraReady && !error && (
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 12,
                }}
              >
                <div
                  style={{
                    width: 32,
                    height: 32,
                    border: "3px solid rgba(255,255,255,0.3)",
                    borderTopColor: "#fff",
                    borderRadius: "50%",
                    animation: "spin 0.8s linear infinite",
                  }}
                />
                <p
                  style={{
                    color: "rgba(255,255,255,0.7)",
                    fontSize: 14,
                    margin: 0,
                  }}
                >
                  Starting camera…
                </p>
                <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
              </div>
            )}
          </>
        )}

        {/* OCR video — always mounted so ocrVideoRef is available before startOcrPreview runs */}
        <video
          ref={ocrVideoRef}
          autoPlay
          playsInline
          muted
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "cover",
            display: mode === "ocr" && !ocrText ? "block" : "none",
          }}
        />

        {mode === "ocr" && (
          <>
            {/* Processing overlay */}
            {isProcessingOcr && (
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 12,
                  background: "rgba(0,0,0,0.65)",
                }}
              >
                <div
                  style={{
                    width: 32,
                    height: 32,
                    border: "3px solid rgba(255,255,255,0.3)",
                    borderTopColor: "#3b82f6",
                    borderRadius: "50%",
                    animation: "spin 0.8s linear infinite",
                  }}
                />
                <p
                  style={{
                    color: "rgba(255,255,255,0.8)",
                    fontSize: 14,
                    margin: 0,
                  }}
                >
                  Reading text from image…
                </p>
              </div>
            )}

            {/* Capture button — overlaid at bottom of live preview */}
            {!ocrText && !isProcessingOcr && (
              <div
                style={{
                  position: "absolute",
                  bottom: 0,
                  left: 0,
                  right: 0,
                  padding: "24px 24px",
                  paddingBottom: "max(24px, env(safe-area-inset-bottom))",
                  background: "linear-gradient(transparent, rgba(0,0,0,0.75))",
                  display: "flex",
                  justifyContent: "center",
                }}
              >
                <button
                  type="button"
                  onClick={() => void handleCaptureText()}
                  style={{
                    padding: "14px 40px",
                    fontSize: 16,
                    fontWeight: 600,
                    color: "#fff",
                    background: "#3b82f6",
                    borderRadius: 12,
                    border: "none",
                    cursor: "pointer",
                    minWidth: 200,
                  }}
                >
                  📷 Capture Photo
                </button>
              </div>
            )}

            {/* OCR result editor */}
            {ocrText && !isProcessingOcr && (
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: 24,
                  gap: 16,
                }}
              >
                <div style={{ width: "100%", maxWidth: 360 }}>
                  <label
                    htmlFor="ocr-text"
                    style={{
                      display: "block",
                      fontSize: 13,
                      fontWeight: 500,
                      color: "rgba(255,255,255,0.7)",
                      marginBottom: 6,
                    }}
                  >
                    Extracted text (edit if needed)
                  </label>
                  <textarea
                    id="ocr-text"
                    value={ocrText}
                    onChange={(e) => setOcrText(e.target.value)}
                    rows={3}
                    style={{
                      width: "100%",
                      padding: "10px 12px",
                      fontSize: 15,
                      borderRadius: 8,
                      border: "1px solid rgba(255,255,255,0.2)",
                      background: "rgba(255,255,255,0.1)",
                      color: "#fff",
                      resize: "vertical",
                      boxSizing: "border-box",
                    }}
                  />
                  <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
                    <button
                      type="button"
                      onClick={handleConfirmOcrText}
                      disabled={!ocrText.trim()}
                      style={{
                        flex: 1,
                        padding: "12px 16px",
                        fontSize: 15,
                        fontWeight: 600,
                        color: "#fff",
                        background: "#3b82f6",
                        borderRadius: 10,
                        border: "none",
                        cursor: "pointer",
                        opacity: !ocrText.trim() ? 0.5 : 1,
                      }}
                    >
                      Use This Text
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setOcrText("");
                        void startOcrPreview();
                      }}
                      style={{
                        padding: "12px 16px",
                        fontSize: 15,
                        fontWeight: 500,
                        color: "#fff",
                        background: "rgba(255,255,255,0.15)",
                        borderRadius: 10,
                        border: "none",
                        cursor: "pointer",
                      }}
                    >
                      Retake
                    </button>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Bottom hint */}
      {mode === "barcode" && cameraReady && (
        <div
          className="relative z-10"
          style={{
            padding: "14px 16px",
            paddingBottom: "max(14px, env(safe-area-inset-bottom))",
            background: "rgba(0,0,0,0.6)",
            textAlign: "center",
          }}
        >
          <p
            style={{ color: "rgba(255,255,255,0.8)", fontSize: 14, margin: 0 }}
          >
            Point camera at a barcode
          </p>
        </div>
      )}
    </div>,
    document.body
  );
}
