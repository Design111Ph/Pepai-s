import QRCode from 'qrcode';
import { Ingredient } from '../types';

/**
 * Encodes an ingredient into a standard structured QR payload
 */
export function formatIngredientQRPayload(ingredient: Ingredient): string {
  return JSON.stringify({
    schema: 'pepai-kitchen-os-v1',
    id: ingredient.id,
    sku: `PEPAI-${ingredient.id.toUpperCase()}`,
    name: ingredient.name,
    category: ingredient.category,
    unit: ingredient.unit,
  });
}

/**
 * Generates a high-contrast black/white Data URL QR code for a given text
 */
export async function generateQRDataUrl(text: string, size = 240): Promise<string> {
  try {
    return await QRCode.toDataURL(text, {
      width: size,
      margin: 1,
      color: {
        dark: '#171717', // neutral-900
        light: '#ffffff',
      },
      errorCorrectionLevel: 'M',
    });
  } catch (err) {
    console.error('Failed to generate QR data URL:', err);
    return '';
  }
}

/**
 * Generates an SVG string for sharp vector rendering & printing
 */
export async function generateQRSvg(text: string, size = 180): Promise<string> {
  try {
    return await QRCode.toString(text, {
      type: 'svg',
      width: size,
      margin: 1,
      color: {
        dark: '#171717',
        light: '#ffffff',
      },
      errorCorrectionLevel: 'M',
    });
  } catch (err) {
    console.error('Failed to generate QR SVG:', err);
    return '';
  }
}

/**
 * Smart QR parser that matches an ingredient by ID, JSON payload, SKU, or Name
 */
export function parseScannedQRData(qrText: string, ingredients: Ingredient[]): Ingredient | null {
  if (!qrText || typeof qrText !== 'string') return null;
  const trimmed = qrText.trim();

  // 1. Try parsing JSON payload
  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    try {
      const parsed = JSON.parse(trimmed);
      if (parsed.id) {
        const found = ingredients.find((i) => i.id === parsed.id);
        if (found) return found;
      }
      if (parsed.name) {
        const found = ingredients.find(
          (i) => i.name.toLowerCase() === parsed.name.toLowerCase()
        );
        if (found) return found;
      }
    } catch {
      // Continue to next checks
    }
  }

  // 2. Direct ID match (e.g. "ing-1")
  const directMatch = ingredients.find((i) => i.id.toLowerCase() === trimmed.toLowerCase());
  if (directMatch) return directMatch;

  // 3. SKU or Prefix match (e.g. "PEPAI-ING-1" or "ING-1")
  const skuNormalized = trimmed.toUpperCase().replace(/^PEPAI-/, '');
  const skuMatch = ingredients.find(
    (i) => i.id.toUpperCase() === skuNormalized || `PEPAI-${i.id.toUpperCase()}` === trimmed.toUpperCase()
  );
  if (skuMatch) return skuMatch;

  // 4. URL format (e.g. "https://kitchen.pepai/ingredients/ing-1" or "pepai://ing/ing-1")
  const urlIdMatch = trimmed.match(/\/ing(?:redients)?\/([a-zA-Z0-9_-]+)/i);
  if (urlIdMatch && urlIdMatch[1]) {
    const urlId = urlIdMatch[1];
    const found = ingredients.find((i) => i.id.toLowerCase() === urlId.toLowerCase());
    if (found) return found;
  }

  // 5. Name fuzzy substring match
  const lowerTrimmed = trimmed.toLowerCase();
  const nameMatch = ingredients.find(
    (i) =>
      i.name.toLowerCase() === lowerTrimmed ||
      i.name.toLowerCase().includes(lowerTrimmed) ||
      lowerTrimmed.includes(i.name.toLowerCase())
  );
  if (nameMatch) return nameMatch;

  return null;
}

/**
 * Synthetic Web Audio API beep feedback for instant scanner confirmation
 */
export function playScannerSuccessBeep(): void {
  try {
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;

    const ctx = new AudioContextClass();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, ctx.currentTime); // A5 note
    osc.frequency.exponentialRampToValueAtTime(1760, ctx.currentTime + 0.08); // A6 chirp

    gain.gain.setValueAtTime(0.2, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + 0.13);
  } catch (e) {
    // AudioContext might be restricted until user gesture; ignore silently
  }
}

/**
 * Haptic feedback
 */
export function triggerScannerHaptic(): void {
  try {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate([45, 30, 45]);
    }
  } catch {
    // Ignore haptic failures
  }
}
