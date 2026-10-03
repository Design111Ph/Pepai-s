import React, { useState, useEffect, useRef, useCallback } from 'react';
import jsQR from 'jsqr';
import {
  Camera,
  X,
  Zap,
  ZapOff,
  RefreshCw,
  Volume2,
  VolumeX,
  AlertCircle,
  CheckCircle2,
  Scan,
  Plus,
  Minus,
  Sparkles,
  ArrowRight,
  Package,
  Layers,
  History,
  Tag,
  Printer,
  ChevronDown,
} from 'lucide-react';
import { Ingredient, Location, User } from '../types';
import {
  parseScannedQRData,
  playScannerSuccessBeep,
  triggerScannerHaptic,
  formatIngredientQRPayload,
  generateQRDataUrl,
} from '../utils/qrCodeUtils';
import { StorageService } from '../utils/storage';

interface IngredientQRScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  ingredients: Ingredient[];
  locations: Location[];
  activeLocationId: string;
  currentUser: User;
  onUpdateStock: (ingredientId: string, locationId: string, newQty: number, reason?: string) => void;
  onShowNotice?: (msg: string) => void;
}

type UpdateMode = 'exact' | 'add' | 'deduct';

export const IngredientQRScannerModal: React.FC<IngredientQRScannerModalProps> = ({
  isOpen,
  onClose,
  ingredients,
  locations,
  activeLocationId,
  currentUser,
  onUpdateStock,
  onShowNotice,
}) => {
  // Video and Canvas refs
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  // Camera state
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [torchSupported, setTorchSupported] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);

  // Scanned item state
  const [scannedIngredient, setScannedIngredient] = useState<Ingredient | null>(null);
  const [rawScannedText, setRawScannedText] = useState<string | null>(null);
  const [scanTimestamp, setScanTimestamp] = useState<string | null>(null);

  // Adjustment form state
  const [updateMode, setUpdateMode] = useState<UpdateMode>('exact');
  const [inputQuantity, setInputQuantity] = useState<string>('');
  const [adjustmentReason, setAdjustmentReason] = useState<string>('Routine QR Stock Count');
  const [customReason, setCustomReason] = useState<string>('');
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccessAnim, setSaveSuccessAnim] = useState(false);

  // Session stats
  const [sessionCountSuccesses, setSessionCountSuccesses] = useState<number>(0);
  const [recentScanLog, setRecentScanLog] = useState<
    { id: string; name: string; oldQty: number; newQty: number; unit: string; time: string }[]
  >([]);

  // Simulator drawer for desktop testing
  const [showSimulator, setShowSimulator] = useState(false);
  // Label printer modal toggle
  const [showLabelPreview, setShowLabelPreview] = useState(false);
  const [previewQRUrls, setPreviewQRUrls] = useState<Record<string, string>>({});

  // Active location helper
  const currentLocation =
    locations.find((l) => l.id === activeLocationId) || locations[0] || {
      id: 'loc-1',
      name: "Pepai's BGC High Street",
    };

  // Stop camera media stream
  const stopCamera = useCallback(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
    setTorchOn(false);
  }, []);

  // Initialize camera
  const startCamera = useCallback(async () => {
    stopCamera();
    setCameraError(null);

    // Guard if browser doesn't support mediaDevices
    if (
      typeof navigator === 'undefined' ||
      !navigator.mediaDevices ||
      !navigator.mediaDevices.getUserMedia
    ) {
      setCameraError('Camera access is not supported by your browser environment.');
      return;
    }

    try {
      const constraints: MediaStreamConstraints = {
        video: {
          facingMode: { ideal: facingMode },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.setAttribute('playsinline', 'true'); // Required for iOS Safari
        await videoRef.current.play();
      }

      setCameraActive(true);

      // Check torch capability
      const videoTrack = stream.getVideoTracks()[0];
      if (videoTrack) {
        const capabilities = (videoTrack.getCapabilities?.() || {}) as unknown as { torch?: boolean };
        setTorchSupported(Boolean(capabilities.torch));
      }
    } catch (err: unknown) {
      const errorMsg =
        err instanceof Error ? err.message : 'Unable to access camera. Check device permissions.';
      console.warn('Camera start warning:', errorMsg);
      setCameraError(
        'Camera unavailable or permission denied. You can still scan instantly using the Quick Barcode Simulator below!'
      );
      setCameraActive(false);
    }
  }, [facingMode, stopCamera]);

  // Toggle torch/flashlight
  const toggleTorch = async () => {
    if (!streamRef.current || !torchSupported) return;
    const track = streamRef.current.getVideoTracks()[0];
    if (!track) return;

    try {
      const nextTorch = !torchOn;
      await (track as any).applyConstraints({
        advanced: [{ torch: nextTorch }],
      });
      setTorchOn(nextTorch);
    } catch (err) {
      console.error('Torch toggle failed:', err);
    }
  };

  // Flip camera (front / back)
  const flipCamera = () => {
    setFacingMode((prev) => (prev === 'environment' ? 'user' : 'environment'));
  };

  // Select an ingredient and initialize its adjustment form
  const handleIngredientDetected = useCallback(
    (ingredient: Ingredient, rawText?: string) => {
      // Audio & haptic feedback
      if (soundEnabled) {
        playScannerSuccessBeep();
      }
      triggerScannerHaptic();

      setScannedIngredient(ingredient);
      setRawScannedText(rawText || formatIngredientQRPayload(ingredient));
      setScanTimestamp(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));

      // Pre-fill input quantity with current on-hand stock
      const currentStock = ingredient.stockByLocation[activeLocationId]?.quantity || 0;
      setInputQuantity(currentStock.toString());
      setUpdateMode('exact');
      setAdjustmentReason('Routine QR Stock Count');
      setCustomReason('');
    },
    [soundEnabled, activeLocationId]
  );

  // Scan frame loop
  useEffect(() => {
    if (!cameraActive || scannedIngredient) return;

    let isScanning = true;

    const scanFrame = () => {
      if (!isScanning) return;

      const video = videoRef.current;
      const canvas = canvasRef.current;

      if (video && canvas && video.readyState === video.HAVE_ENOUGH_DATA) {
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (ctx) {
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const code = jsQR(imageData.data, imageData.width, imageData.height, {
            inversionAttempts: 'dontInvert',
          });

          if (code && code.data) {
            const matched = parseScannedQRData(code.data, ingredients);
            if (matched) {
              handleIngredientDetected(matched, code.data);
              return; // Stop scanning loop while editing
            }
          }
        }
      }

      animationFrameRef.current = requestAnimationFrame(scanFrame);
    };

    animationFrameRef.current = requestAnimationFrame(scanFrame);

    return () => {
      isScanning = false;
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [cameraActive, scannedIngredient, ingredients, handleIngredientDetected]);

  // Lifecycle: start on open, stop on close
  useEffect(() => {
    if (isOpen) {
      startCamera();
    } else {
      stopCamera();
      setScannedIngredient(null);
    }
    return () => {
      stopCamera();
    };
  }, [isOpen, startCamera, stopCamera]);

  // Generate QR preview data URLs for label printing
  useEffect(() => {
    if (showLabelPreview) {
      ingredients.forEach(async (ing) => {
        if (!previewQRUrls[ing.id]) {
          const payload = formatIngredientQRPayload(ing);
          const dataUrl = await generateQRDataUrl(payload, 180);
          setPreviewQRUrls((prev) => ({ ...prev, [ing.id]: dataUrl }));
        }
      });
    }
  }, [showLabelPreview, ingredients, previewQRUrls]);

  if (!isOpen) return null;

  // Stock calculations for the scanned item
  const currentStock = scannedIngredient
    ? scannedIngredient.stockByLocation[activeLocationId]?.quantity || 0
    : 0;

  const parsedInput = parseFloat(inputQuantity) || 0;

  let calculatedNewStock = currentStock;
  if (updateMode === 'exact') {
    calculatedNewStock = parsedInput;
  } else if (updateMode === 'add') {
    calculatedNewStock = currentStock + parsedInput;
  } else if (updateMode === 'deduct') {
    calculatedNewStock = Math.max(0, currentStock - parsedInput);
  }
  calculatedNewStock = Math.round(calculatedNewStock * 100) / 100;

  // Delta display
  const stockDelta = Math.round((calculatedNewStock - currentStock) * 100) / 100;

  // Increment / Decrement helper
  const handleQuickAdjust = (amount: number) => {
    if (updateMode === 'exact') {
      const next = Math.max(0, Math.round((parsedInput + amount) * 100) / 100);
      setInputQuantity(next.toString());
    } else {
      const next = Math.max(0, Math.round((parsedInput + amount) * 100) / 100);
      setInputQuantity(next.toString());
    }
  };

  // Save stock update
  const handleCommitStockUpdate = (continueScanning = true) => {
    if (!scannedIngredient) return;
    setIsSaving(true);

    const finalReason =
      customReason.trim() ||
      `${adjustmentReason} via Camera QR Scan [${currentLocation.name}]`;

    // 1. Trigger parent stock update
    onUpdateStock(scannedIngredient.id, activeLocationId, calculatedNewStock, finalReason);

    // 2. Add detailed audit log entry
    StorageService.addAuditLog({
      userName: currentUser.name,
      userRole: currentUser.role,
      locationId: activeLocationId,
      locationName: currentLocation.name,
      category: 'inventory',
      action: 'QR Code Stock Audit',
      details: `Scanned QR for ${scannedIngredient.name}: ${currentStock} ${scannedIngredient.unit} -> ${calculatedNewStock} ${scannedIngredient.unit} (${stockDelta >= 0 ? '+' : ''}${stockDelta} ${scannedIngredient.unit}). Reason: ${finalReason}.`,
    });

    // 3. Track session log
    setRecentScanLog((prev) => [
      {
        id: scannedIngredient.id + '-' + Date.now(),
        name: scannedIngredient.name,
        oldQty: currentStock,
        newQty: calculatedNewStock,
        unit: scannedIngredient.unit,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      },
      ...prev.slice(0, 7),
    ]);
    setSessionCountSuccesses((prev) => prev + 1);

    // 4. Feedback
    if (soundEnabled) playScannerSuccessBeep();
    triggerScannerHaptic();
    setSaveSuccessAnim(true);

    setTimeout(() => {
      setIsSaving(false);
      setSaveSuccessAnim(false);

      if (continueScanning) {
        // Reset card and resume scanning immediately
        setScannedIngredient(null);
        setRawScannedText(null);
        setInputQuantity('');
        onShowNotice?.(`Updated ${scannedIngredient.name} to ${calculatedNewStock} ${scannedIngredient.unit}`);
      } else {
        onClose();
        onShowNotice?.(`Updated ${scannedIngredient.name} to ${calculatedNewStock} ${scannedIngredient.unit}`);
      }
    }, 450);
  };

  // Cancel current item and resume scanning
  const handleCancelScannedItem = () => {
    setScannedIngredient(null);
    setRawScannedText(null);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-4xl bg-white dark:bg-neutral-900 rounded-3xl border border-neutral-200 dark:border-neutral-800 shadow-2xl overflow-hidden flex flex-col max-h-[96vh]">
        {/* Top Header Bar */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3.5 border-b border-neutral-200 dark:border-neutral-800 bg-neutral-50/80 dark:bg-neutral-900/80 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold">
              <Scan className="w-4 h-4 stroke-[2.5]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm sm:text-base font-black text-neutral-900 dark:text-white">
                  QR Code Rapid Stock Scanner
                </h2>
                <span className="hidden sm:inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Live Camera Feed
                </span>
              </div>
              <p className="text-[11px] text-neutral-500 dark:text-neutral-400">
                Target unit: <strong className="text-neutral-800 dark:text-neutral-200">{currentLocation.name}</strong> • Point lens at shelf or container QR sticker
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Session count badge */}
            {sessionCountSuccesses > 0 && (
              <span className="hidden md:inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-purple-500/15 text-purple-700 dark:text-purple-300 font-bold text-xs border border-purple-500/20">
                <CheckCircle2 className="w-3.5 h-3.5 text-purple-500" />
                <span>{sessionCountSuccesses} updated this session</span>
              </span>
            )}

            {/* Print Labels Button */}
            <button
              type="button"
              onClick={() => setShowLabelPreview(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-neutral-200 hover:bg-neutral-300 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300 transition-colors"
              title="Generate & print QR code labels for shelf containers"
            >
              <Printer className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Print Labels</span>
            </button>

            {/* Close Button */}
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-xl hover:bg-neutral-200 dark:hover:bg-neutral-800 text-neutral-400 hover:text-neutral-700 dark:hover:text-white transition-colors"
              title="Close scanner"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Main Body */}
        <div className="flex-1 overflow-y-auto grid grid-cols-1 lg:grid-cols-12 min-h-0">
          {/* LEFT COLUMN: Camera Viewfinder / Scanner Area (lg:col-span-7) */}
          <div className="lg:col-span-7 bg-black flex flex-col relative min-h-[340px] sm:min-h-[420px] overflow-hidden">
            {/* Video Feed */}
            <div className="relative flex-1 flex items-center justify-center overflow-hidden bg-neutral-950">
              <video
                ref={videoRef}
                className="w-full h-full object-cover"
                muted
                playsInline
              />
              <canvas ref={canvasRef} className="hidden" />

              {/* Viewfinder Overlay with Reticle & Laser */}
              <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center">
                {/* Target box */}
                <div
                  className={`relative w-64 h-64 sm:w-72 sm:h-72 rounded-2xl border-2 transition-all duration-300 shadow-[0_0_0_9999px_rgba(0,0,0,0.55)] ${
                    scannedIngredient
                      ? 'border-emerald-500 scale-95 shadow-[0_0_25px_rgba(16,185,129,0.5)]'
                      : 'border-amber-400/80'
                  }`}
                >
                  {/* Corner Reticles */}
                  <div className="absolute -top-1 -left-1 w-6 h-6 border-t-4 border-l-4 border-amber-400 rounded-tl-lg" />
                  <div className="absolute -top-1 -right-1 w-6 h-6 border-t-4 border-r-4 border-amber-400 rounded-tr-lg" />
                  <div className="absolute -bottom-1 -left-1 w-6 h-6 border-b-4 border-l-4 border-amber-400 rounded-bl-lg" />
                  <div className="absolute -bottom-1 -right-1 w-6 h-6 border-b-4 border-r-4 border-amber-400 rounded-br-lg" />

                  {/* Animated Laser Scanning Line (when active and not frozen on ingredient) */}
                  {!scannedIngredient && cameraActive && (
                    <div className="absolute inset-x-0 h-0.5 bg-gradient-to-r from-transparent via-amber-400 to-transparent shadow-[0_0_12px_#fbbf24] animate-[bounce_2s_infinite]" />
                  )}

                  {/* Centered Guide Hint */}
                  {!scannedIngredient && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-[11px] font-bold text-white/70 bg-black/60 px-3 py-1 rounded-full backdrop-blur-sm">
                        Align QR Code Inside Box
                      </span>
                    </div>
                  )}

                  {/* Scanned Success Flash */}
                  {scannedIngredient && (
                    <div className="absolute inset-0 bg-emerald-500/20 backdrop-blur-[2px] rounded-2xl flex flex-col items-center justify-center text-white">
                      <CheckCircle2 className="w-12 h-12 text-emerald-400 animate-bounce" />
                      <span className="text-xs font-black uppercase tracking-wider mt-1 text-emerald-200">
                        Code Captured
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Camera Error / Permission Fallback Screen */}
              {cameraError && (
                <div className="absolute inset-0 bg-neutral-900/95 flex flex-col items-center justify-center p-6 text-center text-white z-20">
                  <div className="w-12 h-12 rounded-2xl bg-amber-500/20 border border-amber-500/40 text-amber-400 flex items-center justify-center mb-3">
                    <Camera className="w-6 h-6" />
                  </div>
                  <h3 className="text-sm font-black mb-1">Camera Feed Unavailable</h3>
                  <p className="text-xs text-neutral-400 max-w-sm mb-4 leading-relaxed">
                    {cameraError}
                  </p>
                  <div className="flex flex-wrap items-center justify-center gap-2">
                    <button
                      type="button"
                      onClick={() => startCamera()}
                      className="px-3.5 py-2 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-400 text-neutral-950 flex items-center gap-1.5 transition-colors"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span>Retry Camera</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowSimulator(true)}
                      className="px-3.5 py-2 rounded-xl text-xs font-bold bg-neutral-800 hover:bg-neutral-700 text-white flex items-center gap-1.5 transition-colors"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                      <span>Use Quick Test Barcode Bar</span>
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Bottom Controls Bar on Viewfinder */}
            <div className="p-3 bg-neutral-900/90 border-t border-neutral-800 flex items-center justify-between text-white shrink-0">
              <div className="flex items-center gap-1.5">
                {/* Torch Toggle */}
                {torchSupported && (
                  <button
                    type="button"
                    onClick={toggleTorch}
                    className={`p-2 rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 ${
                      torchOn
                        ? 'bg-amber-400 text-neutral-950'
                        : 'bg-neutral-800 hover:bg-neutral-700 text-neutral-300'
                    }`}
                    title="Toggle flashlight"
                  >
                    {torchOn ? <Zap className="w-4 h-4 fill-current" /> : <ZapOff className="w-4 h-4" />}
                    <span className="hidden sm:inline">{torchOn ? 'Torch On' : 'Torch'}</span>
                  </button>
                )}

                {/* Flip Camera */}
                <button
                  type="button"
                  onClick={flipCamera}
                  className="p-2 rounded-xl text-xs font-bold bg-neutral-800 hover:bg-neutral-700 text-neutral-300 transition-colors flex items-center gap-1.5"
                  title="Switch between front and back camera"
                >
                  <RefreshCw className="w-4 h-4" />
                  <span className="hidden sm:inline">Flip Lens</span>
                </button>

                {/* Sound Toggle */}
                <button
                  type="button"
                  onClick={() => setSoundEnabled(!soundEnabled)}
                  className={`p-2 rounded-xl text-xs font-bold transition-colors ${
                    soundEnabled
                      ? 'bg-neutral-800 text-emerald-400'
                      : 'bg-neutral-800 text-neutral-400'
                  }`}
                  title={soundEnabled ? 'Beep enabled' : 'Mute beep'}
                >
                  {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
                </button>
              </div>

              {/* Quick Barcode Simulator Toggle */}
              <button
                type="button"
                onClick={() => setShowSimulator(!showSimulator)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 ${
                  showSimulator
                    ? 'bg-purple-600 text-white shadow-xs'
                    : 'bg-neutral-800 hover:bg-neutral-700 text-purple-300'
                }`}
                title="Open fast test selector for desktop or instant scan simulation"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Test QR Selector</span>
              </button>
            </div>
          </div>

          {/* RIGHT COLUMN: Rapid Stock Adjustment Card (lg:col-span-5) */}
          <div className="lg:col-span-5 p-4 sm:p-6 bg-white dark:bg-neutral-900 flex flex-col justify-between overflow-y-auto">
            {scannedIngredient ? (
              <div className="space-y-4 animate-in slide-in-from-right-2 duration-200">
                {/* Captured Header */}
                <div className="flex items-start justify-between pb-3 border-b border-neutral-200 dark:border-neutral-800">
                  <div>
                    <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wider text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md mb-1">
                      <CheckCircle2 className="w-3 h-3" /> QR Match Confirmed
                    </span>
                    <h3 className="text-base font-black text-neutral-900 dark:text-white leading-tight">
                      {scannedIngredient.name}
                    </h3>
                    <p className="text-xs text-neutral-500 mt-0.5">
                      {scannedIngredient.category} • SKU: <span className="font-mono text-neutral-700 dark:text-neutral-300">PEPAI-{scannedIngredient.id.toUpperCase()}</span>
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleCancelScannedItem}
                    className="p-1 rounded-lg text-neutral-400 hover:text-neutral-600 dark:hover:text-white text-xs flex items-center gap-0.5"
                    title="Cancel and re-scan"
                  >
                    <X className="w-4 h-4" />
                    <span>Cancel</span>
                  </button>
                </div>

                {/* Current Stock vs Par Info Pill Grid */}
                <div className="grid grid-cols-3 gap-2 p-3 rounded-xl bg-neutral-50 dark:bg-neutral-800/60 border border-neutral-200 dark:border-neutral-700/60 text-xs">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-neutral-400 block">
                      Current On-Hand
                    </span>
                    <span className="text-sm font-black text-neutral-900 dark:text-white">
                      {currentStock} {scannedIngredient.unit}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-neutral-400 block">
                      Target Par
                    </span>
                    <span className="text-sm font-bold text-neutral-700 dark:text-neutral-300">
                      {scannedIngredient.parLevel} {scannedIngredient.unit}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-neutral-400 block">
                      Unit Cost
                    </span>
                    <span className="text-sm font-mono font-bold text-neutral-700 dark:text-neutral-300">
                      ₱{scannedIngredient.costPerUnit.toFixed(2)}
                    </span>
                  </div>
                </div>

                {/* Adjustment Mode Selector */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-neutral-500 uppercase tracking-wider block">
                    Update Mode:
                  </label>
                  <div className="grid grid-cols-3 gap-1.5 p-1 rounded-xl bg-neutral-100 dark:bg-neutral-800">
                    <button
                      type="button"
                      onClick={() => {
                        setUpdateMode('exact');
                        setInputQuantity(currentStock.toString());
                      }}
                      className={`py-1.5 px-2 rounded-lg text-xs font-bold transition-all ${
                        updateMode === 'exact'
                          ? 'bg-white dark:bg-neutral-700 text-neutral-900 dark:text-white shadow-xs'
                          : 'text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200'
                      }`}
                    >
                      Exact Count
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setUpdateMode('add');
                        setInputQuantity('1');
                      }}
                      className={`py-1.5 px-2 rounded-lg text-xs font-bold transition-all ${
                        updateMode === 'add'
                          ? 'bg-emerald-600 text-white shadow-xs'
                          : 'text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200'
                      }`}
                    >
                      + Inflow
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setUpdateMode('deduct');
                        setInputQuantity('1');
                      }}
                      className={`py-1.5 px-2 rounded-lg text-xs font-bold transition-all ${
                        updateMode === 'deduct'
                          ? 'bg-rose-600 text-white shadow-xs'
                          : 'text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200'
                      }`}
                    >
                      - Deduct
                    </button>
                  </div>
                </div>

                {/* Quantity Input & Tactile Increment Buttons */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-neutral-700 dark:text-neutral-300">
                      {updateMode === 'exact'
                        ? 'New Counted Physical Quantity:'
                        : updateMode === 'add'
                        ? 'Add Inflow Quantity:'
                        : 'Deduct Used Quantity:'}
                    </label>
                    <span className="text-[11px] font-bold text-neutral-400">
                      Unit: {scannedIngredient.unit}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleQuickAdjust(-1)}
                      className="w-10 h-10 rounded-xl bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-neutral-800 dark:text-white font-black text-sm flex items-center justify-center transition-colors active:scale-95"
                      title="Minus 1"
                    >
                      <Minus className="w-4 h-4 stroke-[3]" />
                    </button>

                    <div className="relative flex-1">
                      <input
                        type="number"
                        step="0.1"
                        min="0"
                        value={inputQuantity}
                        onChange={(e) => setInputQuantity(e.target.value)}
                        className="w-full text-center text-xl font-black py-2 rounded-xl bg-neutral-50 dark:bg-neutral-800 border-2 border-amber-500/50 text-neutral-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                        autoFocus
                      />
                      <span className="absolute right-3 top-3 text-xs font-bold text-neutral-400">
                        {scannedIngredient.unit}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleQuickAdjust(1)}
                      className="w-10 h-10 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-700 dark:text-amber-300 font-black text-sm flex items-center justify-center transition-colors active:scale-95"
                      title="Add 1"
                    >
                      <Plus className="w-4 h-4 stroke-[3]" />
                    </button>
                  </div>

                  {/* Fast Touch Increment Buttons (+0.5, +5, +10) */}
                  <div className="flex items-center justify-center gap-1.5 pt-1">
                    {[
                      { label: '+0.5', val: 0.5 },
                      { label: '+2', val: 2 },
                      { label: '+5', val: 5 },
                      { label: '+10', val: 10 },
                    ].map((btn) => (
                      <button
                        key={btn.label}
                        type="button"
                        onClick={() => handleQuickAdjust(btn.val)}
                        className="px-2.5 py-1 rounded-lg text-xs font-bold bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300 transition-colors"
                      >
                        {btn.label}
                      </button>
                    ))}
                  </div>

                  {/* Result Calculation Banner */}
                  <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/25 flex items-center justify-between text-xs">
                    <span className="text-neutral-600 dark:text-neutral-300 font-medium">
                      Calculated Final Stock:
                    </span>
                    <div className="flex items-center gap-1.5 font-black text-neutral-900 dark:text-white">
                      <span>{calculatedNewStock} {scannedIngredient.unit}</span>
                      <span
                        className={`text-[10px] px-1.5 py-0.5 rounded-md ${
                          stockDelta > 0
                            ? 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300'
                            : stockDelta < 0
                            ? 'bg-rose-500/20 text-rose-700 dark:text-rose-300'
                            : 'bg-neutral-200 dark:bg-neutral-700 text-neutral-600 dark:text-neutral-300'
                        }`}
                      >
                        {stockDelta > 0 ? `+${stockDelta}` : stockDelta} {scannedIngredient.unit}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Audit Reason Selector */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-neutral-500 uppercase tracking-wider block">
                    Reason / Audit Tag:
                  </label>
                  <select
                    value={adjustmentReason}
                    onChange={(e) => setAdjustmentReason(e.target.value)}
                    className="w-full text-xs font-medium py-1.5 px-3 rounded-xl bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-neutral-800 dark:text-neutral-200 focus:outline-none focus:ring-1 focus:ring-amber-500"
                  >
                    <option value="Routine QR Stock Count">Routine Physical Shelf Count</option>
                    <option value="Supplier Delivery Inflow">Supplier Delivery Restock (+ Inflow)</option>
                    <option value="Pre-Service Prep Pull">Pre-Service Kitchen Prep Pull (- Outflow)</option>
                    <option value="Shelf Audit Discrepancy">Physical Discrepancy Correction</option>
                    <option value="Damaged / Spoilage Deduction">Damaged / Expired Container Deduction</option>
                  </select>
                </div>

                {/* Action Commit Buttons */}
                <div className="pt-2 flex flex-col gap-2">
                  <button
                    type="button"
                    disabled={isSaving}
                    onClick={() => handleCommitStockUpdate(true)}
                    className="w-full py-2.5 px-4 rounded-xl text-xs font-black bg-amber-500 hover:bg-amber-400 text-neutral-950 shadow-md flex items-center justify-center gap-2 transition-all active:scale-98 disabled:opacity-50"
                  >
                    {isSaving ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <CheckCircle2 className="w-4 h-4" />
                    )}
                    <span>Save &amp; Scan Next Shelf QR</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>

                  <button
                    type="button"
                    disabled={isSaving}
                    onClick={() => handleCommitStockUpdate(false)}
                    className="w-full py-2 px-4 rounded-xl text-xs font-bold bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300 transition-colors"
                  >
                    Save &amp; Finish
                  </button>
                </div>
              </div>
            ) : (
              /* Idle Waiting State */
              <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-4">
                <div className="w-16 h-16 rounded-3xl bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 flex items-center justify-center text-neutral-400">
                  <Scan className="w-8 h-8 text-amber-500 animate-pulse" />
                </div>
                <div>
                  <h4 className="text-sm font-black text-neutral-900 dark:text-white">
                    Scanner Ready
                  </h4>
                  <p className="text-xs text-neutral-500 max-w-xs mt-1 leading-relaxed">
                    Point camera lens at any container QR label to immediately load inventory stats and record physical counts.
                  </p>
                </div>

                {/* Recent session activity preview */}
                {recentScanLog.length > 0 && (
                  <div className="w-full pt-4 border-t border-neutral-200 dark:border-neutral-800 text-left">
                    <span className="text-[10px] font-bold uppercase text-neutral-400 block mb-2">
                      Recent Updates in this Session:
                    </span>
                    <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                      {recentScanLog.map((log) => (
                        <div
                          key={log.id}
                          className="p-2 rounded-lg bg-neutral-50 dark:bg-neutral-800/60 border border-neutral-200 dark:border-neutral-700/60 text-[11px] flex items-center justify-between"
                        >
                          <span className="font-bold text-neutral-800 dark:text-neutral-200 truncate max-w-[140px]">
                            {log.name}
                          </span>
                          <div className="flex items-center gap-1.5 font-mono text-neutral-500">
                            <span>{log.oldQty} -&gt; <strong className="text-neutral-900 dark:text-white">{log.newQty} {log.unit}</strong></span>
                            <span className="text-[9px] text-neutral-400">{log.time}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* BOTTOM DRAWER: Quick Test Barcode Bar / Simulator */}
        {showSimulator && (
          <div className="p-3.5 bg-neutral-100 dark:bg-neutral-800/90 border-t border-neutral-200 dark:border-neutral-700 shrink-0 animate-in slide-in-from-bottom-2">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-purple-500" />
                <span className="text-xs font-black text-neutral-900 dark:text-white">
                  Quick Barcode Test Selector (Desktop Simulator)
                </span>
                <span className="text-[10px] text-neutral-500">
                  Click any ingredient to simulate an immediate camera QR scan
                </span>
              </div>
              <button
                type="button"
                onClick={() => setShowSimulator(false)}
                className="text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
              {ingredients.map((ing) => (
                <button
                  key={ing.id}
                  type="button"
                  onClick={() => handleIngredientDetected(ing, formatIngredientQRPayload(ing))}
                  className="px-3 py-1.5 rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 hover:border-amber-500 dark:hover:border-amber-400 text-left shrink-0 transition-all shadow-xs group"
                >
                  <span className="font-bold text-xs text-neutral-900 dark:text-white group-hover:text-amber-500 block truncate max-w-[150px]">
                    {ing.name}
                  </span>
                  <span className="text-[10px] text-neutral-400 font-mono">
                    {ing.stockByLocation[activeLocationId]?.quantity || 0} {ing.unit} on hand
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* MODAL: QR Code Label Sheet & Container Stickers */}
      {showLabelPreview && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md animate-in fade-in">
          <div className="w-full max-w-3xl bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800 shadow-2xl p-5 sm:p-6 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-neutral-200 dark:border-neutral-800">
              <div className="flex items-center gap-2">
                <Printer className="w-5 h-5 text-amber-500" />
                <h3 className="text-base font-black text-neutral-900 dark:text-white">
                  Kitchen QR Container Stickers &amp; Shelf Labels
                </h3>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="px-3 py-1.5 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-400 text-neutral-950 flex items-center gap-1.5 shadow-xs"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Print Sheet</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowLabelPreview(false)}
                  className="p-1 rounded-lg text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <p className="text-xs text-neutral-500 my-3">
              Standard commercial food safety label format. Stick these on cambros, prep tubs, walk-in shelves, or dry storage bins for instant camera inventory counting.
            </p>

            {/* Sticker Grid */}
            <div className="flex-1 overflow-y-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 p-1">
              {ingredients.map((ing) => {
                const qrUrl = previewQRUrls[ing.id];
                return (
                  <div
                    key={ing.id}
                    className="p-3 rounded-xl border-2 border-dashed border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800/40 flex flex-col justify-between"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className="text-[9px] uppercase font-black tracking-wider text-amber-600 dark:text-amber-400 block">
                          Pepai Kitchen OS
                        </span>
                        <h4 className="text-xs font-black text-neutral-900 dark:text-white leading-tight">
                          {ing.name}
                        </h4>
                        <span className="text-[10px] text-neutral-500">
                          {ing.category}
                        </span>
                      </div>
                      {qrUrl ? (
                        <img
                          src={qrUrl}
                          alt={ing.name}
                          className="w-16 h-16 rounded-md bg-white p-0.5 border border-neutral-200 shrink-0"
                        />
                      ) : (
                        <div className="w-16 h-16 rounded bg-neutral-200 dark:bg-neutral-700 animate-pulse" />
                      )}
                    </div>

                    <div className="mt-2 pt-2 border-t border-neutral-200 dark:border-neutral-700/60 flex items-center justify-between text-[10px] text-neutral-400 font-mono">
                      <span>SKU: PEPAI-{ing.id.toUpperCase()}</span>
                      <span>Par: {ing.parLevel} {ing.unit}</span>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="pt-3 border-t border-neutral-200 dark:border-neutral-800 flex justify-end">
              <button
                type="button"
                onClick={() => setShowLabelPreview(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
