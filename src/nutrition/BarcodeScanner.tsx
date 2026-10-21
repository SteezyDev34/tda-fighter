import { useEffect, useRef, useState } from "react";

// BarcodeDetector is not in the TS DOM lib yet (Chrome / Android only).
type Detector = {
  detect: (src: HTMLVideoElement) => Promise<{ rawValue: string }[]>;
};
const BarcodeDetectorCtor = (
  globalThis as unknown as {
    BarcodeDetector?: new (o: { formats: string[] }) => Detector;
  }
).BarcodeDetector;

interface Props {
  onCode: (code: string) => void;
  onClose: () => void;
  /** false when the parent already has its own code field (and its own form). */
  typing?: boolean;
}

/** Camera scan when the browser supports it, otherwise the code is typed. */
export function BarcodeScanner({ onCode, onClose, typing = true }: Props) {
  const video = useRef<HTMLVideoElement>(null);
  // Kept in a ref so a parent re-render doesn't restart the camera.
  const onCodeRef = useRef(onCode);
  onCodeRef.current = onCode;
  const [typed, setTyped] = useState("");
  const [cameraError, setCameraError] = useState(!BarcodeDetectorCtor);

  useEffect(() => {
    if (!BarcodeDetectorCtor) return;
    let stream: MediaStream | undefined;
    let timer: number | undefined;
    const detector = new BarcodeDetectorCtor({
      formats: ["ean_13", "ean_8", "upc_a", "upc_e"],
    });
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: "environment" } })
      .then((s) => {
        stream = s;
        if (!video.current) return;
        video.current.srcObject = s;
        void video.current.play();
        timer = window.setInterval(async () => {
          if (!video.current) return;
          const [hit] = await detector.detect(video.current).catch(() => []);
          if (hit) onCodeRef.current(hit.rawValue);
        }, 400);
      })
      .catch(() => setCameraError(true));
    return () => {
      window.clearInterval(timer);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  return (
    <div className="stack scanner">
      {!cameraError && (
        <video ref={video} className="scanner-video" muted playsInline />
      )}
      {cameraError && !typing && (
        <p className="small muted">
          La caméra n'est pas disponible : tape le code dans le champ.
        </p>
      )}
      {typing && (
        <form
          className="row"
          onSubmit={(e) => {
            e.preventDefault();
            if (typed.trim()) onCode(typed.trim());
          }}
        >
          <input
            id="barcode"
            inputMode="numeric"
            placeholder={
              cameraError ? "Tape le code-barres" : "Ou tape le code-barres"
            }
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
          />
          <button className="primary">Chercher</button>
        </form>
      )}
      <button type="button" onClick={onClose}>
        Fermer le scanner
      </button>
    </div>
  );
}
