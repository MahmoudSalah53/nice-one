"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { RoomEvent, Track } from "livekit-client";
import { useRoomContext, useVoiceAssistant } from "@livekit/components-react";
import { EmbedErrorDetails } from "@/lib/types";
import { ICON_DATA_URI } from "./icon-data-uri";

interface TriggerProps {
  error: EmbedErrorDetails | null;
  popupOpen: boolean;
  onToggle: () => void;
  isIframeMode?: boolean;
}

const SVW_CSS = `
/* Voice FAB — one element morphs from the face circle into the session pill */
.svw-root {
  --svw-accent: #c62828;
  --svw-accent-hover: #b71c1c;
  --svw-accent-soft: #fce8e8;
  --svw-accent-ink: #c62828;
  --svw-accent-glow: rgba(198, 40, 40, 0.35);
  --svw-accent-pulse: rgba(198, 40, 40, 0.2);
  --svw-on-accent: #ffffff;
  --svw-logo-filter: none;
  --svw-face-ring: rgba(255, 255, 255, 0.18);
  --svw-fg0: #000000;
  --svw-fg1: #3b3b3b;
  --svw-circle: 60px;
  --svw-tease: 168px;
  --svw-tease-text: 110px;
  --svw-open-w: 298px;
  --svw-open-h: 64px;
  --svw-face-open: 54px;
  --svw-gap: 10px;
  --svw-pad-start: 8px;
  --svw-pad-end: 10px;
  --svw-name-size: 14px;
  --svw-status-size: 12px;
  --svw-tease-size: 15px;
  --svw-spring: cubic-bezier(0.34, 1.36, 0.64, 1);
  --svw-ease-out: cubic-bezier(0.22, 1, 0.36, 1);
  --svw-bottom: 16px;
  direction: rtl;
  font-family: "Cairo", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  box-sizing: border-box;
}

.svw-root[data-mobile="1"] {
  --svw-circle: 52px;
  --svw-tease: 148px;
  --svw-tease-text: 96px;
  --svw-open-w: 260px;
  --svw-open-h: 56px;
  --svw-face-open: 48px;
  --svw-gap: 8px;
  --svw-pad-start: 6px;
  --svw-pad-end: 8px;
  --svw-name-size: 13px;
  --svw-status-size: 11px;
  --svw-tease-size: 14px;
}

.svw-root *,
.svw-root *::before,
.svw-root *::after {
  box-sizing: border-box;
}

.svw-root button {
  font: inherit;
  letter-spacing: normal;
  text-transform: none;
  min-width: 0;
  min-height: 0;
  box-shadow: none;
  -webkit-appearance: none;
  appearance: none;
}

.svw-root p {
  margin: 0;
  padding: 0;
}

.svw-root img,
.svw-root svg {
  max-width: none;
  max-height: none;
}

/* ── Morphing shell ─────────────────────────────────── */
.svw-fab {
  position: fixed;
  right: 16px;
  bottom: var(--svw-bottom);
  z-index: 99999;
  width: var(--svw-circle);
  height: var(--svw-circle);
  overflow: hidden;
  border-radius: 9999px;
  transform-origin: bottom right;
  box-shadow:
    0 10px 15px -3px rgba(0, 0, 0, 0.1),
    0 4px 6px -4px rgba(0, 0, 0, 0.1);
  opacity: 0;
  transform: scale(0);
  animation: svw-spring-in 0.7s var(--svw-spring) forwards;
  transition:
    width 0.58s var(--svw-spring),
    height 0.58s var(--svw-spring),
    bottom 0.3s ease,
    box-shadow 0.3s ease;
}

.svw-root[data-phase="closed"][data-tease="1"] .svw-fab,
.svw-root[data-phase="closed"][data-hover="1"] .svw-fab {
  width: var(--svw-tease);
}

.svw-root:not([data-phase="closed"]) .svw-fab {
  width: var(--svw-open-w);
  height: var(--svw-open-h);
  box-shadow: 0 8px 28px rgba(15, 15, 15, 0.14);
}

/* Closed gradient fades out while the white pill fades in */
.svw-bg {
  position: absolute;
  inset: 0;
  border-radius: 9999px;
  transition: opacity 0.4s var(--svw-ease-out);
  pointer-events: none;
}

.svw-bg--closed {
  background: linear-gradient(
    90deg,
    var(--svw-accent-hover) 0%,
    var(--svw-accent) 55%,
    var(--svw-accent) 100%
  );
  opacity: 1;
}

.svw-bg--open {
  background: #ffffff;
  border: 1px solid rgba(0, 0, 0, 0.04);
  opacity: 0;
}

.svw-root:not([data-phase="closed"]) .svw-bg--closed {
  opacity: 0;
}

.svw-root:not([data-phase="closed"]) .svw-bg--open {
  opacity: 1;
}

.svw-strip {
  position: absolute;
  top: 0;
  bottom: 0;
  right: 0;
  z-index: 1;
  width: 4px;
  background: linear-gradient(180deg, var(--svw-accent-hover), var(--svw-accent));
  pointer-events: none;
  display: none;
}

.svw-root:not([data-phase="closed"]) .svw-strip {
  display: block;
}

/* ── Face disc (same element closed → open, shrinks slightly) ── */
.svw-face {
  position: absolute;
  z-index: 5;
  top: 0;
  right: 0;
  width: var(--svw-circle);
  height: var(--svw-circle);
  display: grid;
  place-items: center;
  border-radius: 9999px;
  background: var(--svw-accent);
  pointer-events: none;
  transform: translateY(0);
  box-shadow:
    0 5px 12px rgba(0, 0, 0, 0.32),
    0 2px 4px rgba(0, 0, 0, 0.2),
    -3px 3px 10px rgba(0, 0, 0, 0.18),
    inset 0 0 0 1px var(--svw-face-ring);
  transition:
    width 0.58s var(--svw-spring),
    height 0.58s var(--svw-spring),
    top 0.58s var(--svw-spring),
    right 0.58s var(--svw-spring),
    transform 0.58s var(--svw-spring),
    background-color 0.2s ease,
    box-shadow 0.3s ease;
}

.svw-root:not([data-phase="closed"]) .svw-face {
  top: 50%;
  right: 8px;
  width: var(--svw-face-open);
  height: var(--svw-face-open);
  transform: translateY(-50%);
  box-shadow:
    0 6px 18px var(--svw-accent-glow),
    inset 0 0 0 1px var(--svw-face-ring);
}

.svw-pulse {
  position: absolute;
  inset: 0;
  border-radius: 9999px;
  background: var(--svw-accent-pulse);
  opacity: 0;
  transition: opacity 0.2s ease;
}

.svw-root:not([data-phase="closed"])[data-speaking="1"] .svw-pulse {
  animation: svw-pulse 1.7s ease-in-out infinite;
}

.svw-face-inner {
  position: relative;
  z-index: 10;
  width: 100%;
  height: 100%;
  display: grid;
  place-items: center;
  overflow: hidden;
  border-radius: 9999px;
  background: var(--svw-accent);
  contain: paint;
  transition: background-color 0.2s ease;
}

.svw-logo-wrap {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  pointer-events: none;
}

.svw-logo {
  display: block;
  width: 140%;
  height: 140%;
  object-fit: contain;
  transform: translate(0, -8%);
  filter: var(--svw-logo-filter);
  transition: filter 0.2s ease;
  user-select: none;
  -webkit-user-drag: none;
}

/* MOUTH_LEFT 30%, MOUTH_W 40%; top/height include the curve fit (42.544% / 35.64%) */
.svw-mouth {
  position: absolute;
  left: 30%;
  top: 42.544%;
  width: 40%;
  height: 35.64%;
  pointer-events: none;
  overflow: visible;
}

.svw-mouth-path {
  fill: var(--svw-on-accent);
  stroke: var(--svw-on-accent);
  transition: fill 0.2s ease, stroke 0.2s ease;
}

/* ── Closed: invisible button over the circle + tease text ── */
.svw-open-btn {
  position: absolute;
  inset: 0;
  z-index: 20;
  display: flex;
  align-items: center;
  width: 100%;
  height: 100%;
  margin: 0;
  padding: 0;
  border: 0;
  background: transparent;
  cursor: pointer;
  direction: rtl;
  opacity: 1;
  transition: opacity 0.18s ease;
}

.svw-open-btn:focus {
  outline: none;
}

.svw-open-spacer {
  flex-shrink: 0;
  width: var(--svw-circle);
  height: var(--svw-circle);
}

.svw-tease-text {
  overflow: hidden;
  white-space: nowrap;
  max-width: 0;
  opacity: 0;
  padding-inline-start: 12px;
  padding-inline-end: 16px;
  font-weight: 700;
  font-size: var(--svw-tease-size);
  line-height: 1.4;
  color: var(--svw-on-accent);
  transition:
    max-width 0.28s var(--svw-ease-out),
    opacity 0.28s var(--svw-ease-out),
    color 0.2s ease;
}

.svw-root[data-phase="closed"][data-tease="1"] .svw-tease-text,
.svw-root[data-phase="closed"][data-hover="1"] .svw-tease-text {
  max-width: var(--svw-tease-text);
  opacity: 1;
}

.svw-root:not([data-phase="closed"]) .svw-open-btn {
  opacity: 0;
  pointer-events: none;
  visibility: hidden;
}

/* ── Open: session pill content ── */
.svw-session {
  position: absolute;
  inset: 0;
  z-index: 20;
  display: flex;
  align-items: center;
  gap: var(--svw-gap);
  padding-inline-start: var(--svw-pad-start);
  padding-inline-end: var(--svw-pad-end);
  opacity: 0;
  visibility: hidden;
  pointer-events: none;
  transition: opacity 0.28s ease;
}

.svw-root:not([data-phase="closed"]) .svw-session {
  opacity: 1;
  visibility: visible;
  pointer-events: auto;
}

.svw-root .svw-face-spacer,
.svw-root .svw-open-spacer {
  display: block !important;
}

.svw-face-spacer {
  flex-shrink: 0;
  margin-inline-start: 4px;
  width: var(--svw-face-open);
  height: var(--svw-face-open);
}

.svw-texts {
  flex: 1;
  min-width: 0;
  text-align: start;
}

.svw-name,
.svw-status {
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
  line-height: 1.25;
}

.svw-root .svw-name {
  font-size: var(--svw-name-size);
  font-weight: 700;
  letter-spacing: -0.025em;
  color: var(--svw-fg0);
}

.svw-root .svw-status {
  font-size: var(--svw-status-size);
  color: rgba(59, 59, 59, 0.9);
}

.svw-root[data-state="error"] .svw-mic-btn {
  display: none;
}

.svw-root[data-state="error"] .svw-status {
  color: #c62828;
  font-weight: 600;
  white-space: normal;
  line-height: 1.3;
}

.svw-actions {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  gap: 2px;
}

.svw-btn {
  display: grid;
  place-items: center;
  width: 36px;
  height: 36px;
  margin: 0;
  padding: 0;
  border: 0;
  border-radius: 9999px;
  background: transparent;
  cursor: pointer;
  transition:
    background-color 0.15s ease,
    color 0.15s ease,
    opacity 0.15s ease;
}

.svw-btn:focus {
  outline: none;
}

.svw-btn:disabled {
  cursor: not-allowed;
  opacity: 0.4;
}

.svw-btn svg {
  display: block;
  width: 17px;
  height: 17px;
}

.svw-close-btn svg {
  width: 16px;
  height: 16px;
}

.svw-mic-btn[data-mic="on"] {
  color: var(--svw-fg1);
}

.svw-mic-btn[data-mic="on"]:hover:not(:disabled) {
  background: rgba(0, 0, 0, 0.05);
  color: var(--svw-fg0);
}

.svw-mic-btn[data-mic="off"] {
  background: var(--svw-accent-soft);
  color: var(--svw-accent-ink);
}

.svw-close-btn {
  color: rgba(59, 59, 59, 0.7);
}

.svw-close-btn:hover {
  background: rgba(0, 0, 0, 0.05);
  color: var(--svw-fg0);
}

@keyframes svw-spring-in {
  0% {
    transform: scale(0);
    opacity: 0;
  }
  100% {
    transform: scale(1);
    opacity: 1;
  }
}

@keyframes svw-pulse {
  0%,
  100% {
    opacity: 0.22;
  }
  50% {
    opacity: 0.08;
  }
}

@media (prefers-reduced-motion: reduce) {
  .svw-fab {
    animation: none;
    opacity: 1;
    transform: none;
  }

  .svw-fab,
  .svw-face,
  .svw-bg,
  .svw-tease-text,
  .svw-open-btn,
  .svw-session {
    transition: none;
  }

  .svw-pulse {
    animation: none !important;
  }
}
`;

/* ── Talking mouth math (identical to salla / eracoda / zid-plugin) ── */
const MOUTH_STROKE = 6;
const MOUTH_SCALE = 1.5;
const MOUTH_CURVE = 1.5;
const MOUTH_REST = { open: 0, width: 0.55, round: 0.1 };

const SILENCE_HOLD_MS = 35;
const SILENCE_EXIT_MUL = 1.25;
const RMS_SILENCE = 0.016;

const TEASE_VISIBLE_MS = 3000;
const TEASE_GAP_MS = 60000;
const INTRO_DELAY_MS = 500;

interface Visemes {
  jawOpen: number;
  aa: number;
  ee: number;
  oo: number;
  consonant: number;
}

interface MouthShape {
  open: number;
  width: number;
  round: number;
}

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = clamp01((x - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
}

function mouthPath(shape: MouthShape): string {
  const s = MOUTH_SCALE;
  const o = clamp01(shape.open);

  const cx = 20;
  const cy = 16.5;
  const halfW = lerp(5.2, 11.0, shape.width) * s;
  const rx = halfW * (1 - shape.round * 0.4);
  const left = cx - rx;
  const right = cx + rx;

  const curve = Math.max(0.05, MOUTH_CURVE);
  const dip = rx * curve * 0.9;

  const restHalf = MOUTH_STROKE * 0.42;
  const jawUp = o * s * 3.4;
  const jawDown = o * s * 4.2;

  const topOff = restHalf * 0.45 + jawUp;
  const botOff = restHalf * 0.55 + jawDown + dip * 0.05 * o;
  const endY = cy + dip * 0.06 * o;

  const topCtrl = cy + dip - topOff;
  const botCtrl = cy + dip + botOff;

  return [
    "M " + left.toFixed(2) + " " + endY.toFixed(2),
    "Q " + cx + " " + topCtrl.toFixed(2) + " " + right.toFixed(2) + " " + endY.toFixed(2),
    "Q " + cx + " " + botCtrl.toFixed(2) + " " + left.toFixed(2) + " " + endY.toFixed(2),
    "Z",
  ].join(" ");
}

function shapeFromVisemes(v: Visemes): MouthShape {
  const energy = v.jawOpen + v.aa + v.ee + v.oo + v.consonant;
  if (energy < 0.05) return MOUTH_REST;

  const ooDom = clamp01(v.oo - Math.max(v.aa, v.ee) * 0.55);

  const open = clamp01(
    v.jawOpen * 0.52 + v.aa * 0.72 + v.ee * 0.3 + v.oo * 0.2 + v.consonant * 0.12,
  );
  const width = clamp01(
    0.52 + v.aa * 0.22 + v.ee * 0.28 - ooDom * 0.22 + v.consonant * 0.06,
  );
  const round = clamp01(ooDom * 0.55 - v.ee * 0.15 - v.aa * 0.05);

  return { open, width, round };
}

function restVisemes(): Visemes {
  return { jawOpen: 0, aa: 0, ee: 0, oo: 0, consonant: 0 };
}

function peakHz(
  freq: Uint8Array,
  binHz: number,
  loHz: number,
  hiHz: number,
  minAvg = 20,
): number {
  const loBin = Math.max(1, Math.floor(loHz / binHz));
  const hiBin = Math.min(freq.length - 1, Math.floor(hiHz / binHz));
  let bestBin = -1;
  let bestVal = 0;
  for (let i = loBin; i <= hiBin; i++) {
    let sum = 0;
    for (let k = -2; k <= 2; k++) {
      const j = i + k;
      if (j >= loBin && j <= hiBin) sum += freq[j];
    }
    const avg = sum / 5;
    if (avg > bestVal) {
      bestVal = avg;
      bestBin = i;
    }
  }
  if (bestVal < minAvg) return 0;
  return bestBin * binHz;
}

function createVisemeTracker(mediaTrack: MediaStreamTrack, out: Visemes): () => void {
  const win = window as unknown as {
    AudioContext?: typeof AudioContext;
    webkitAudioContext?: typeof AudioContext;
    __svwAudioCtx?: AudioContext;
  };
  const AC = win.AudioContext || win.webkitAudioContext;
  if (!AC || !mediaTrack) return () => {};
  const ctx = win.__svwAudioCtx || new AC();
  win.__svwAudioCtx = ctx;
  if (ctx.state === "suspended") {
    ctx.resume().catch(() => {});
  }

  const analyser = ctx.createAnalyser();
  analyser.fftSize = 2048;
  analyser.smoothingTimeConstant = 0.7;
  analyser.minDecibels = -90;
  analyser.maxDecibels = -30;
  const source = ctx.createMediaStreamSource(new MediaStream([mediaTrack]));
  source.connect(analyser);

  const freq = new Uint8Array(analyser.frequencyBinCount);
  const time = new Uint8Array(analyser.fftSize);
  const binHz = ctx.sampleRate / 2 / freq.length;

  let smoothF1 = 0;
  let smoothF2 = 0;
  let silentFor = 0;
  let silenceSinceMs: number | null = null;
  let lastHeld: Visemes | null = null;
  let last = performance.now();
  let raf = 0;
  let stopped = false;

  function assign(next: Visemes) {
    out.jawOpen = next.jawOpen;
    out.aa = next.aa;
    out.ee = next.ee;
    out.oo = next.oo;
    out.consonant = next.consonant;
  }

  function tick(now: number) {
    if (stopped) return;
    const dt = Math.max(0.001, Math.min(0.08, (now - last) / 1000));
    last = now;

    analyser.getByteFrequencyData(freq);
    analyser.getByteTimeDomainData(time);

    let sumSq = 0;
    for (let i = 0; i < time.length; i++) {
      const tv = time[i] / 128 - 1;
      sumSq += tv * tv;
    }
    const rms = Math.sqrt(sumSq / time.length);

    let total = 0;
    let weighted = 0;
    let low = 0;
    let mid = 0;
    let high = 0;
    for (let b = 0; b < freq.length; b++) {
      const e = freq[b] / 255;
      const hz = b * binHz;
      total += e;
      weighted += hz * e;
      if (hz < 500) low += e;
      else if (hz < 2000) mid += e;
      else if (hz < 8000) high += e;
    }
    const centroid = total > 0 ? weighted / total : 0;
    const lowMid = low + mid;
    const voiced = rms > 0.02 && lowMid > high * 1.2 && lowMid > 1;
    const voicingGate = voiced ? 1 : smoothstep(0.02, 0.05, rms);

    const inSilence = silenceSinceMs !== null;
    const exitThr = RMS_SILENCE * SILENCE_EXIT_MUL;
    const isSilent = inSilence ? rms < exitThr : rms < RMS_SILENCE;
    if (isSilent) {
      if (silenceSinceMs === null) {
        silenceSinceMs = now;
        lastHeld = {
          jawOpen: out.jawOpen,
          aa: out.aa,
          ee: out.ee,
          oo: out.oo,
          consonant: out.consonant,
        };
      }
      if (now - silenceSinceMs < SILENCE_HOLD_MS && lastHeld) {
        const holdA = 1 - Math.exp(-dt / 0.03);
        assign({
          jawOpen: lerp(out.jawOpen, lastHeld.jawOpen * 0.85, holdA),
          aa: lerp(out.aa, lastHeld.aa * 0.75, holdA),
          ee: lerp(out.ee, lastHeld.ee * 0.75, holdA),
          oo: lerp(out.oo, lastHeld.oo * 0.75, holdA),
          consonant: lerp(out.consonant, 0, holdA),
        });
        raf = requestAnimationFrame(tick);
        return;
      }
    } else {
      silenceSinceMs = null;
      lastHeld = null;
    }

    const jawTarget = clamp01(voicingGate * Math.min(1, rms * 6.5));
    const fricRatio = high / (low + mid + high + 0.001);
    const brightness = clamp01((centroid - 1500) / 2500);
    const consonantTarget = clamp01(
      voicingGate * (0.55 * brightness + 0.7 * fricRatio),
    );

    const f1Hz = peakHz(freq, binHz, 200, 950);
    const f2Lo = f1Hz > 0 ? Math.max(700, f1Hz + 200) : 800;
    const f2Hz = peakHz(freq, binHz, f2Lo, 3200);

    if (voicingGate > 0.5 && f1Hz > 0 && f2Hz > 0) {
      silentFor = 0;
      const a = 1 - Math.exp(-dt / 0.032);
      smoothF1 = smoothF1 ? lerp(smoothF1, f1Hz, a) : f1Hz;
      smoothF2 = smoothF2 ? lerp(smoothF2, f2Hz, a) : f2Hz;
    } else {
      silentFor += dt;
      if (silentFor > 0.25) {
        smoothF1 = 0;
        smoothF2 = 0;
      }
    }

    const vowelMass = clamp01(voicingGate * (1 - consonantTarget * 0.85));
    let aa = 0;
    let ee = 0;
    let oo = 0;
    if (vowelMass > 0.1 && smoothF1 > 0 && smoothF2 > 0) {
      const sF1 = smoothF1;
      const sF2 = smoothF2;
      const sep = sF2 - sF1;

      aa = smoothstep(520, 820, sF1);
      const f1Low = 1 - smoothstep(320, 580, sF1);
      ee = f1Low * smoothstep(1750, 2450, sF2) * smoothstep(900, 1600, sep);
      const f2Low = 1 - smoothstep(900, 1350, sF2);
      const sepTight = 1 - smoothstep(450, 1100, sep);
      oo = f1Low * f2Low * sepTight;
      oo *= oo;

      aa = aa * aa;
      ee = ee * ee;

      const sum = aa + ee + oo + 0.001;
      aa = (aa / sum) * vowelMass;
      ee = (ee / sum) * vowelMass;
      oo = (oo / sum) * vowelMass;
    }

    const vA = 1 - Math.exp(-dt / 0.032);
    const cA = 1 - Math.exp(-dt / 0.028);
    assign({
      jawOpen: lerp(out.jawOpen, jawTarget, vA),
      aa: lerp(out.aa, aa, vA),
      ee: lerp(out.ee, ee, vA),
      oo: lerp(out.oo, oo, vA),
      consonant: lerp(out.consonant, consonantTarget, cA),
    });

    raf = requestAnimationFrame(tick);
  }

  raf = requestAnimationFrame(tick);

  return function stop() {
    stopped = true;
    cancelAnimationFrame(raf);
    try {
      source.disconnect();
    } catch {
      // ignore
    }
    assign(restVisemes());
  };
}

function unlockAudio(): void {
  try {
    const win = window as unknown as {
      AudioContext?: typeof AudioContext;
      webkitAudioContext?: typeof AudioContext;
      __svwAudioCtx?: AudioContext;
    };
    const AC = win.AudioContext || win.webkitAudioContext;
    if (AC) {
      if (!win.__svwAudioCtx) {
        win.__svwAudioCtx = new AC();
      }
      const ctx = win.__svwAudioCtx;
      if (ctx.state === "suspended") {
        ctx.resume().catch(() => {});
      }
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      gain.gain.value = 0;
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(0);
      osc.stop(0.01);
    }
  } catch {
    // ignore
  }
}

function MicSvg() {
  return (
    <svg viewBox="0 0 256 256" fill="currentColor" aria-hidden="true">
      <path d="M128,180a52.06,52.06,0,0,0,52-52V64A52,52,0,0,0,76,64v64A52.06,52.06,0,0,0,128,180ZM100,64a28,28,0,0,1,56,0v64a28,28,0,0,1-56,0Zm40,155.22V240a12,12,0,0,1-24,0V219.22A92.14,92.14,0,0,1,36,128a12,12,0,0,1,24,0,68,68,0,0,0,136,0,12,12,0,0,1,24,0A92.14,92.14,0,0,1,140,219.22Z" />
    </svg>
  );
}

function MicSlashSvg() {
  return (
    <svg viewBox="0 0 256 256" fill="currentColor" aria-hidden="true">
      <path d="M56.88,39.93A12,12,0,1,0,39.12,56.07L76,96.64V128a52,52,0,0,0,72.11,48l11.26,12.39A67.34,67.34,0,0,1,128,196a68.07,68.07,0,0,1-68-68,12,12,0,0,0-24,0,92.14,92.14,0,0,0,80,91.22V240a12,12,0,0,0,24,0V219.23a90.39,90.39,0,0,0,35.92-12.68l23.2,25.52a12,12,0,0,0,17.76-16.14ZM128,156a28,28,0,0,1-28-28v-5l29.9,32.89C129.27,156,128.64,156,128,156Zm63-2.42A67.63,67.63,0,0,0,196,128a12,12,0,0,1,24,0,91.48,91.48,0,0,1-6.74,34.61,12,12,0,0,1-22.23-9ZM85.7,33.75A52,52,0,0,1,180,64v56.54a12,12,0,0,1-24,0V64a28,28,0,0,0-50.79-16.28,12,12,0,0,1-19.51-14Z" />
    </svg>
  );
}

function CloseSvg() {
  return (
    <svg viewBox="0 0 256 256" fill="currentColor" aria-hidden="true">
      <path d="M208.49,191.51a12,12,0,0,1-17,17L128,145,64.49,208.49a12,12,0,0,1-17-17L111,128,47.51,64.49a12,12,0,0,1,17-17L128,111l63.51-63.52a12,12,0,0,1,17,17L145,128Z" />
    </svg>
  );
}

export function Trigger({
  error = null,
  popupOpen,
  onToggle,
}: TriggerProps) {
  const room = useRoomContext();
  const { state: agentState, audioTrack } = useVoiceAssistant();

  const rootRef = useRef<HTMLDivElement>(null);
  const mouthPathRef = useRef<SVGPathElement>(null);
  const voiceOpenedOnceRef = useRef(false);

  const [roomConnected, setRoomConnected] = useState(
    () => room.state === "connected",
  );
  const [micOn, setMicOn] = useState(true);
  const [tease, setTease] = useState(false);
  const [hover, setHover] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  // Inject Cairo Google Font once
  useEffect(() => {
    if (typeof document === "undefined") return;
    if (!document.querySelector("link[data-svw-font]")) {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href =
        "https://fonts.googleapis.com/css2?family=Cairo:wght@400;500;600;700&display=swap";
      link.setAttribute("data-svw-font", "1");
      document.head.appendChild(link);
    }
  }, []);

  // Detect mobile screen (works inside compact iframe via window.screen.width)
  useEffect(() => {
    if (typeof window === "undefined") return;
    const checkMobile = () => {
      const w =
        window.parent === window
          ? window.innerWidth
          : window.screen?.width || window.innerWidth;
      setIsMobile(w <= 767);
    };
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  // Track room connection & microphone state
  useEffect(() => {
    const syncRoomState = () => {
      const connected = room.state === "connected";
      setRoomConnected(connected);
      if (connected) {
        setMicOn(room.localParticipant.isMicrophoneEnabled);
      }
    };

    syncRoomState();

    room.on(RoomEvent.Connected, syncRoomState);
    room.on(RoomEvent.Reconnected, syncRoomState);
    room.on(RoomEvent.Reconnecting, syncRoomState);
    room.on(RoomEvent.Disconnected, syncRoomState);
    room.on(RoomEvent.ConnectionStateChanged, syncRoomState);
    room.on(RoomEvent.LocalTrackPublished, syncRoomState);
    room.on(RoomEvent.LocalTrackUnpublished, syncRoomState);
    room.on(RoomEvent.TrackMuted, syncRoomState);
    room.on(RoomEvent.TrackUnmuted, syncRoomState);

    return () => {
      room.off(RoomEvent.Connected, syncRoomState);
      room.off(RoomEvent.Reconnected, syncRoomState);
      room.off(RoomEvent.Reconnecting, syncRoomState);
      room.off(RoomEvent.Disconnected, syncRoomState);
      room.off(RoomEvent.ConnectionStateChanged, syncRoomState);
      room.off(RoomEvent.LocalTrackPublished, syncRoomState);
      room.off(RoomEvent.LocalTrackUnpublished, syncRoomState);
      room.off(RoomEvent.TrackMuted, syncRoomState);
      room.off(RoomEvent.TrackUnmuted, syncRoomState);
    };
  }, [room]);

  // Reset mic visual when closed
  useEffect(() => {
    if (!popupOpen) {
      setMicOn(true);
    } else {
      voiceOpenedOnceRef.current = true;
      setHover(false);
      setTease(false);
    }
  }, [popupOpen]);

  // Compute widget state & phase
  const widgetState: "idle" | "connecting" | "connected" | "error" = !popupOpen
    ? "idle"
    : error
      ? "error"
      : roomConnected
        ? "connected"
        : "connecting";

  const phase = widgetState === "idle" ? "closed" : widgetState;

  // Periodic tease cycle when closed («اسأل نورة»: 3s visible, then every minute)
  useEffect(() => {
    if (phase !== "closed") {
      setTease(false);
      return;
    }

    const timers: Array<ReturnType<typeof setTimeout>> = [];

    const runTeaseCycle = () => {
      setTease(true);
      timers.push(
        setTimeout(() => {
          setTease(false);
          timers.push(setTimeout(runTeaseCycle, TEASE_GAP_MS));
        }, TEASE_VISIBLE_MS),
      );
    };

    timers.push(
      setTimeout(
        runTeaseCycle,
        voiceOpenedOnceRef.current ? TEASE_GAP_MS : INTRO_DELAY_MS,
      ),
    );

    return () => {
      timers.forEach((t) => clearTimeout(t));
      setTease(false);
    };
  }, [phase]);

  // Notify parent iframe wrapper immediately when widget size state changes
  useEffect(() => {
    if (typeof window === "undefined" || window.parent === window) return;
    let width = 104;
    let height = 104;
    if (phase !== "closed") {
      width = 356;
      height = 112;
    } else if (tease || hover) {
      width = 224;
      height = 104;
    }
    window.parent.postMessage({ type: "lk-embed-resize", width, height }, "*");
  }, [phase, tease, hover]);

  // Mouth viseme animation loop driven by agent's remote audio track
  useEffect(() => {
    const visemes = restVisemes();
    let stopVisemeTracker: (() => void) | null = null;
    let mouthShape: MouthShape = {
      open: 0,
      width: MOUTH_REST.width,
      round: MOUTH_REST.round,
    };
    let mouthRaf = 0;
    let mouthLast = 0;
    let activeTrack: MediaStreamTrack | null = null;

    const mouthTick = (now: number) => {
      const dt = Math.min(48, now - mouthLast);
      mouthLast = now;

      const tgt = shapeFromVisemes(visemes);
      const cur = mouthShape;
      const opening = tgt.open > cur.open;
      const k = 1 - Math.exp(-dt / (opening ? 12 : 36));
      const kW = 1 - Math.exp(-dt / (opening ? 36 : 56));
      const next: MouthShape = {
        open: lerp(cur.open, tgt.open, k),
        width: lerp(cur.width, tgt.width, kW),
        round: lerp(cur.round, tgt.round, kW),
      };
      if (tgt.open < 0.02 && next.open < 0.012) {
        next.open = 0;
        next.width = lerp(next.width, MOUTH_REST.width, 0.3);
        next.round = lerp(next.round, MOUTH_REST.round, 0.3);
      }
      mouthShape = next;
      if (mouthPathRef.current) {
        mouthPathRef.current.setAttribute("d", mouthPath(next));
      }

      const rootEl = rootRef.current;
      if (rootEl) {
        const speaking =
          rootEl.getAttribute("data-state") === "connected" &&
          (visemes.jawOpen > 0.08 || visemes.aa + visemes.ee + visemes.oo > 0.08);
        if (speaking !== (rootEl.getAttribute("data-speaking") === "1")) {
          if (speaking) rootEl.setAttribute("data-speaking", "1");
          else rootEl.removeAttribute("data-speaking");
        }
      }

      const atRest =
        next.open === 0 &&
        Math.abs(next.width - MOUTH_REST.width) < 0.002 &&
        Math.abs(next.round - MOUTH_REST.round) < 0.002;
      if (!stopVisemeTracker && atRest) {
        mouthRaf = 0;
        if (rootRef.current) {
          rootRef.current.removeAttribute("data-speaking");
        }
        return;
      }
      mouthRaf = requestAnimationFrame(mouthTick);
    };

    const ensureMouthLoop = () => {
      if (mouthRaf) return;
      mouthLast = performance.now();
      mouthRaf = requestAnimationFrame(mouthTick);
    };

    const stopVisemes = () => {
      if (stopVisemeTracker) {
        stopVisemeTracker();
        stopVisemeTracker = null;
      }
      activeTrack = null;
      visemes.jawOpen = 0;
      visemes.aa = 0;
      visemes.ee = 0;
      visemes.oo = 0;
      visemes.consonant = 0;
      ensureMouthLoop();
    };

    const startVisemes = (mediaTrack: MediaStreamTrack | null | undefined) => {
      if (!mediaTrack) {
        stopVisemes();
        return;
      }
      if (activeTrack === mediaTrack && stopVisemeTracker) return;
      stopVisemes();
      try {
        activeTrack = mediaTrack;
        stopVisemeTracker = createVisemeTracker(mediaTrack, visemes);
        ensureMouthLoop();
      } catch (e) {
        stopVisemeTracker = null;
        activeTrack = null;
        console.warn("[SVW] mouth analyser unavailable", e);
      }
    };

    const findRemoteAgentMediaTrack = (): MediaStreamTrack | null => {
      if (audioTrack?.publication?.track?.mediaStreamTrack) {
        return audioTrack.publication.track.mediaStreamTrack;
      }
      let found: MediaStreamTrack | null = null;
      room.remoteParticipants.forEach((participant) => {
        if (found) return;
        if (/^voice_assistant_user_/i.test(participant.identity || "")) return;
        participant.trackPublications.forEach((pub) => {
          if (found) return;
          if (
            pub.track &&
            pub.track.kind === Track.Kind.Audio &&
            pub.track.mediaStreamTrack
          ) {
            found = pub.track.mediaStreamTrack;
          }
        });
      });
      return found;
    };

    const syncAudioTrack = () => {
      if (!popupOpen || room.state !== "connected") {
        stopVisemes();
        return;
      }
      startVisemes(findRemoteAgentMediaTrack());
    };

    syncAudioTrack();

    room.on(RoomEvent.TrackSubscribed, syncAudioTrack);
    room.on(RoomEvent.TrackUnsubscribed, syncAudioTrack);
    room.on(RoomEvent.Connected, syncAudioTrack);
    room.on(RoomEvent.Disconnected, stopVisemes);

    return () => {
      room.off(RoomEvent.TrackSubscribed, syncAudioTrack);
      room.off(RoomEvent.TrackUnsubscribed, syncAudioTrack);
      room.off(RoomEvent.Connected, syncAudioTrack);
      room.off(RoomEvent.Disconnected, stopVisemes);
      if (stopVisemeTracker) {
        stopVisemeTracker();
        stopVisemeTracker = null;
      }
      if (mouthRaf) {
        cancelAnimationFrame(mouthRaf);
      }
    };
  }, [room, popupOpen, audioTrack]);

  const handleOpenClick = useCallback(() => {
    if (widgetState === "idle") {
      unlockAudio();
      onToggle();
    }
  }, [widgetState, onToggle]);

  const handleCloseClick = useCallback(() => {
    if (popupOpen) {
      onToggle();
    }
  }, [popupOpen, onToggle]);

  const handleMicClick = useCallback(
    async (e: React.MouseEvent<HTMLButtonElement>) => {
      e.stopPropagation();
      if (widgetState !== "connected") return;
      const enabled = room.localParticipant.isMicrophoneEnabled;
      const next = !enabled;
      setMicOn(next);
      try {
        await room.localParticipant.setMicrophoneEnabled(next);
        setMicOn(room.localParticipant.isMicrophoneEnabled);
      } catch (err) {
        console.warn("[SVW] mic toggle failed", err);
        setMicOn(room.localParticipant.isMicrophoneEnabled);
      }
    },
    [room, widgetState],
  );

  const assistantName = "نورة";
  const teaseLabel = "اسأل نورة";

  let statusText = "";
  if (widgetState === "connecting") {
    statusText = "جاري الاتصال…";
  } else if (widgetState === "error") {
    statusText = "تعذّر الاتصال حالياً، حاول مرة أخرى";
  } else if (widgetState === "connected") {
    statusText = !micOn ? "الميكروفون مقفول" : "متصل الآن";
  }

  const isAgentSpeaking =
    widgetState === "connected" && agentState === "speaking";

  return (
    <>
      <style data-svw="1" dangerouslySetInnerHTML={{ __html: SVW_CSS }} />
      <div
        ref={rootRef}
        className="svw-root"
        dir="rtl"
        data-state={widgetState}
        data-phase={phase}
        data-tease={tease ? "1" : undefined}
        data-hover={hover ? "1" : undefined}
        data-speaking={isAgentSpeaking ? "1" : undefined}
        data-mobile={isMobile ? "1" : undefined}
        data-svw-root="1"
      >
        <div
          className="svw-fab"
          aria-label="Voice assistant controls"
          onMouseEnter={() => {
            if (phase === "closed") {
              setHover(true);
            }
          }}
          onMouseLeave={() => {
            setHover(false);
          }}
        >
          <span className="svw-bg svw-bg--closed" aria-hidden="true" />
          <span className="svw-bg svw-bg--open" aria-hidden="true" />
          <span className="svw-strip" aria-hidden="true" />
          <div className="svw-face" aria-hidden="true">
            <span className="svw-pulse" />
            <div className="svw-face-inner">
              <div className="svw-logo-wrap">
                <img
                  className="svw-logo"
                  alt=""
                  draggable={false}
                  decoding="async"
                  src={ICON_DATA_URI}
                />
              </div>
              <svg className="svw-mouth" viewBox="0 0 40 40" fill="none">
                <path
                  ref={mouthPathRef}
                  className="svw-mouth-path"
                  fill="#ffffff"
                  stroke="#ffffff"
                  strokeWidth="0.35"
                  strokeLinejoin="round"
                  strokeLinecap="round"
                  d={mouthPath(MOUTH_REST)}
                />
              </svg>
            </div>
          </div>
          <button
            type="button"
            className="svw-open-btn"
            aria-label={teaseLabel}
            onClick={handleOpenClick}
          >
            <span className="svw-open-spacer" aria-hidden="true" />
            <span className="svw-tease-text">{teaseLabel}</span>
          </button>
          <div
            className="svw-session"
            role="dialog"
            aria-label="جلسة المساعد الصوتي"
          >
            <div className="svw-face-spacer" aria-hidden="true" />
            <div className="svw-texts">
              <p className="svw-name">{assistantName}</p>
              <p className="svw-status">{statusText}</p>
            </div>
            <div className="svw-actions">
              <button
                type="button"
                className="svw-btn svw-mic-btn"
                data-mic={micOn ? "on" : "off"}
                disabled={widgetState !== "connected"}
                aria-label={micOn ? "كتم الميكروفون" : "تشغيل الميكروفون"}
                aria-pressed={micOn}
                onClick={handleMicClick}
              >
                <span className="svw-mic-icon">
                  {micOn ? <MicSvg /> : <MicSlashSvg />}
                </span>
              </button>
              <button
                type="button"
                className="svw-btn svw-close-btn"
                aria-label="إغلاق المساعد"
                onClick={handleCloseClick}
              >
                <CloseSvg />
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
