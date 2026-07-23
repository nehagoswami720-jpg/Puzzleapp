'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  canEnter,
  checkpointMap,
  toCell,
  toIndex,
  wallSet,
  type ZipAnswer,
  type ZipContent,
} from '@/lib/mechanics/zip';
import type { RendererProps } from '@/lib/mechanics/types';

/**
 * Zip player. Drag or tap to draw, drag back over the previous cell to
 * backtrack, arrow keys as a keyboard path. The SVG is laid out in a fixed
 * user-space unit grid and scaled to 100% width, so the board is legible from
 * a 380px phone up.
 *
 * Illegal moves are refused as you draw (`canEnter`), so what you submit is
 * always well-formed; final correctness is still decided by `checkZipPath` in
 * the mechanic's `grade()`.
 */
const UNIT = 64;

export default function ZipBoard({
  instance,
  onAnswerChange,
  locked,
}: RendererProps<ZipContent, ZipAnswer>) {
  const content = instance.content;
  const { rows, cols } = content;
  const total = rows * cols;
  const boardW = cols * UNIT;
  const boardH = rows * UNIT;

  const walls = useMemo(() => wallSet(content), [content]);
  const checkpoints = useMemo(() => checkpointMap(content), [content]);
  const cellByNumber = useMemo(() => {
    const m = new Map<number, number>();
    checkpoints.forEach((n, cell) => m.set(n, cell));
    return m;
  }, [checkpoints]);
  const startCell = cellByNumber.get(1);

  const [path, setPath] = useState<number[]>([]);
  const [announce, setAnnounce] = useState('');

  // Read synchronously inside pointer handlers to avoid stale closures on fast drags.
  const pathRef = useRef<number[]>([]);
  const drawingRef = useRef(false);
  const lastRef = useRef<number | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);

  const commit = useCallback(
    (next: number[]) => {
      pathRef.current = next;
      setPath(next);
      // The answer is only submittable once the board is full; anything shorter
      // can't satisfy "visit every cell exactly once".
      onAnswerChange(next.length === total ? next.map((i) => toCell(cols, i)) : null);
      if (next.length === total) {
        setAnnounce('Every cell filled — submit to check your path.');
      }
    },
    [cols, onAnswerChange, total],
  );

  // No reset effect: PlayCard mounts this with a key derived from the instance
  // id, so a new puzzle gets a fresh board rather than one that has to unwind
  // the previous puzzle's path.

  useEffect(() => {
    const up = () => {
      drawingRef.current = false;
    };
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
    return () => {
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
    };
  }, []);

  const applyCell = useCallback(
    (target: number) => {
      if (locked) return;
      const p = pathRef.current;

      if (p.length === 0) {
        if (target === startCell && startCell !== undefined) commit([startCell]);
        return;
      }
      const end = p[p.length - 1];
      if (target === end) return;
      // Dragging back over the previous cell erases the last step.
      if (p.length >= 2 && target === p[p.length - 2]) {
        commit(p.slice(0, -1));
        return;
      }
      if (canEnter(content, p, target)) commit([...p, target]);
    },
    [commit, content, locked, startCell],
  );

  const cellFromEvent = (e: React.PointerEvent<SVGSVGElement>): number | null => {
    const svg = svgRef.current;
    if (!svg) return null;
    const rect = svg.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * boardW;
    const y = ((e.clientY - rect.top) / rect.height) * boardH;
    if (x < 0 || y < 0 || x >= boardW || y >= boardH) return null;
    const c = Math.min(cols - 1, Math.floor(x / UNIT));
    const r = Math.min(rows - 1, Math.floor(y / UNIT));
    return toIndex(cols, r, c);
  };

  const onPointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    if (locked) return;
    const cell = cellFromEvent(e);
    if (cell == null) return;
    e.preventDefault();
    drawingRef.current = true;
    lastRef.current = cell;
    applyCell(cell);
  };

  const onPointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!drawingRef.current || locked) return;
    const cell = cellFromEvent(e);
    if (cell == null || cell === lastRef.current) return;
    lastRef.current = cell;
    applyCell(cell);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (locked) return;
    const p = pathRef.current;

    if (e.key === 'Backspace') {
      e.preventDefault();
      if (p.length) commit(p.slice(0, -1));
      return;
    }
    const dirs: Record<string, [number, number]> = {
      ArrowUp: [-1, 0],
      ArrowDown: [1, 0],
      ArrowLeft: [0, -1],
      ArrowRight: [0, 1],
    };
    const dir = dirs[e.key];
    if (!dir) return;
    e.preventDefault();

    if (p.length === 0) {
      if (startCell !== undefined) commit([startCell]);
      return;
    }
    const [r, c] = toCell(cols, p[p.length - 1]);
    const nr = r + dir[0];
    const nc = c + dir[1];
    if (nr < 0 || nc < 0 || nr >= rows || nc >= cols) return;
    applyCell(toIndex(cols, nr, nc));
  };

  const undo = () => {
    const p = pathRef.current;
    if (p.length) commit(p.slice(0, -1));
  };
  const clear = () => commit([]);

  // ---- derived render data ----
  const center = (i: number) => ({
    x: ((i % cols) + 0.5) * UNIT,
    y: (Math.floor(i / cols) + 0.5) * UNIT,
  });
  const polyPoints = path.map((i) => `${center(i).x},${center(i).y}`).join(' ');
  const hits = path.reduce((n, cell) => n + (checkpoints.has(cell) ? 1 : 0), 0);
  const nextCell = cellByNumber.get(hits + 1);
  const complete = path.length === total;

  const wallSegments = useMemo(() => {
    const INSET = 5;
    const segs: { x1: number; y1: number; x2: number; y2: number }[] = [];
    walls.forEach((key) => {
      const [a, b] = key.split('-').map(Number);
      const ra = Math.floor(a / cols);
      const ca = a % cols;
      if (b === a + 1) {
        const x = (ca + 1) * UNIT;
        segs.push({ x1: x, y1: ra * UNIT + INSET, x2: x, y2: (ra + 1) * UNIT - INSET });
      } else {
        const y = (ra + 1) * UNIT;
        segs.push({ x1: ca * UNIT + INSET, y1: y, x2: (ca + 1) * UNIT - INSET, y2: y });
      }
    });
    return segs;
  }, [cols, walls]);

  const strokeUrl = complete ? 'url(#zipGood)' : 'url(#zipPath)';

  return (
    <div className="flex flex-col gap-4">
      <div
        role="application"
        aria-label="Zip board. Drag to draw the path, or use the arrow keys and Backspace."
        tabIndex={0}
        onKeyDown={onKeyDown}
        className="rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-4"
      >
        <svg
          ref={svgRef}
          viewBox={`0 0 ${boardW} ${boardH}`}
          className="block w-full touch-none select-none"
          style={{ maxWidth: boardW }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
        >
          <defs>
            <linearGradient
              id="zipPath"
              x1="0"
              y1="0"
              x2={boardW}
              y2={boardH}
              gradientUnits="userSpaceOnUse"
            >
              <stop offset="0" stopColor="#6366f1" />
              <stop offset="1" stopColor="#22d3ee" />
            </linearGradient>
            <linearGradient
              id="zipGood"
              x1="0"
              y1="0"
              x2={boardW}
              y2={boardH}
              gradientUnits="userSpaceOnUse"
            >
              <stop offset="0" stopColor="#10b981" />
              <stop offset="1" stopColor="#34d399" />
            </linearGradient>
          </defs>

          <rect
            x="0"
            y="0"
            width={boardW}
            height={boardH}
            rx="18"
            fill="#ffffff"
            stroke="#e4e9f1"
            strokeWidth="2"
          />

          {Array.from({ length: cols - 1 }, (_, i) => (
            <line
              key={`v${i}`}
              x1={(i + 1) * UNIT}
              y1="8"
              x2={(i + 1) * UNIT}
              y2={boardH - 8}
              stroke="#e4e9f1"
              strokeWidth="1.5"
            />
          ))}
          {Array.from({ length: rows - 1 }, (_, i) => (
            <line
              key={`h${i}`}
              x1="8"
              y1={(i + 1) * UNIT}
              x2={boardW - 8}
              y2={(i + 1) * UNIT}
              stroke="#e4e9f1"
              strokeWidth="1.5"
            />
          ))}

          {path.map((i) => (
            <rect
              key={`t${i}`}
              x={(i % cols) * UNIT + 3}
              y={Math.floor(i / cols) * UNIT + 3}
              width={UNIT - 6}
              height={UNIT - 6}
              rx="10"
              fill={complete ? 'rgba(16,185,129,.10)' : 'rgba(99,102,241,.09)'}
            />
          ))}

          {path.length >= 2 && (
            <>
              <polyline
                points={polyPoints}
                fill="none"
                stroke={strokeUrl}
                strokeOpacity="0.18"
                strokeWidth="30"
                strokeLinejoin="round"
                strokeLinecap="round"
              />
              <polyline
                points={polyPoints}
                fill="none"
                stroke={strokeUrl}
                strokeWidth="15"
                strokeLinejoin="round"
                strokeLinecap="round"
              />
            </>
          )}
          {path.length >= 1 && (
            <circle cx={center(path[0]).x} cy={center(path[0]).y} r="8" fill={strokeUrl} />
          )}

          {wallSegments.map((w, i) => (
            <line
              key={`w${i}`}
              x1={w.x1}
              y1={w.y1}
              x2={w.x2}
              y2={w.y2}
              stroke="#0f172a"
              strokeWidth="8"
              strokeLinecap="round"
            />
          ))}

          {[...checkpoints.entries()].map(([cell, n]) => {
            const p = center(cell);
            return (
              <g key={`c${cell}`}>
                {cell === nextCell && !locked && (
                  <circle
                    cx={p.x}
                    cy={p.y}
                    r="26"
                    fill="none"
                    stroke="#6366f1"
                    strokeWidth="3"
                    strokeDasharray="4 5"
                  />
                )}
                <circle cx={p.x} cy={p.y} r="21" fill="#182031" />
                <text
                  x={p.x}
                  y={p.y}
                  dy="0.35em"
                  textAnchor="middle"
                  className="fill-white font-mono text-[26px] font-bold"
                >
                  {n}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      <div className="flex items-center gap-3 text-sm text-slate-500">
        <span className="tabular-nums">
          <b className="text-slate-900">{path.length}</b>/{total} cells
        </span>
        <span className="tabular-nums">
          <b className="text-slate-900">{Math.min(hits, checkpoints.size)}</b>/
          {checkpoints.size} numbers
        </span>
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={undo}
          disabled={locked || path.length === 0}
          className="min-h-11 flex-1 rounded-xl border border-slate-200 bg-white px-4 font-semibold text-slate-900 disabled:opacity-40"
        >
          Undo
        </button>
        <button
          type="button"
          onClick={clear}
          disabled={locked || path.length === 0}
          className="min-h-11 flex-1 rounded-xl border border-slate-200 bg-white px-4 font-semibold text-slate-900 disabled:opacity-40"
        >
          Clear
        </button>
      </div>

      <span aria-live="polite" className="sr-only">
        {announce}
      </span>
    </div>
  );
}
