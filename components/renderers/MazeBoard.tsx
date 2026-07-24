'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  canEnter,
  cell,
  idx,
  wallSet,
  type MazeAnswer,
  type MazeContent,
} from '@/lib/mechanics/maze';
import type { RendererProps } from '@/lib/mechanics/types';

/**
 * Maze player. Drag from Start through the corridors to End; illegal moves
 * (through a wall, a jump, or a revisit) are refused as you draw, so the
 * submitted path is always well-formed. The answer is set once the path reaches
 * End.
 */
const UNIT = 48;

export default function MazeBoard({
  instance,
  onAnswerChange,
  locked,
}: RendererProps<MazeContent, MazeAnswer>) {
  const content = instance.content;
  const { rows, cols } = content;
  const boardW = cols * UNIT;
  const boardH = rows * UNIT;
  const startId = idx(cols, content.start[0], content.start[1]);
  const endId = idx(cols, content.end[0], content.end[1]);

  const [path, setPath] = useState<number[]>([]);
  const pathRef = useRef<number[]>([]);
  const drawingRef = useRef(false);
  const lastRef = useRef<number | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);

  const commit = useCallback(
    (next: number[]) => {
      pathRef.current = next;
      setPath(next);
      const reachedEnd = next.length > 0 && next[next.length - 1] === endId;
      onAnswerChange(reachedEnd ? next.map((i) => cell(cols, i)) : null);
    },
    [cols, endId, onAnswerChange],
  );

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

  const apply = useCallback(
    (target: number) => {
      if (locked) return;
      const p = pathRef.current;
      if (p.length === 0) {
        if (target === startId) commit([startId]);
        return;
      }
      const end = p[p.length - 1];
      if (target === end) return;
      if (p.length >= 2 && target === p[p.length - 2]) {
        commit(p.slice(0, -1));
        return;
      }
      if (canEnter(content, p, target)) commit([...p, target]);
    },
    [commit, content, locked, startId],
  );

  const cellFromEvent = (e: React.PointerEvent<SVGSVGElement>): number | null => {
    const svg = svgRef.current;
    if (!svg) return null;
    const rect = svg.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * boardW;
    const y = ((e.clientY - rect.top) / rect.height) * boardH;
    if (x < 0 || y < 0 || x >= boardW || y >= boardH) return null;
    return idx(cols, Math.min(rows - 1, Math.floor(y / UNIT)), Math.min(cols - 1, Math.floor(x / UNIT)));
  };

  const onDown = (e: React.PointerEvent<SVGSVGElement>) => {
    if (locked) return;
    const c = cellFromEvent(e);
    if (c == null) return;
    e.preventDefault();
    drawingRef.current = true;
    lastRef.current = c;
    apply(c);
  };
  const onMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!drawingRef.current || locked) return;
    const c = cellFromEvent(e);
    if (c == null || c === lastRef.current) return;
    lastRef.current = c;
    apply(c);
  };

  const center = (i: number) => ({ x: ((i % cols) + 0.5) * UNIT, y: (Math.floor(i / cols) + 0.5) * UNIT });
  const poly = path.map((i) => `${center(i).x},${center(i).y}`).join(' ');
  const solved = path.length > 0 && path[path.length - 1] === endId;

  const wallSegs: { x1: number; y1: number; x2: number; y2: number }[] = [];
  wallSet(content).forEach((key) => {
    const [a, b] = key.split('-').map(Number);
    const ra = Math.floor(a / cols);
    const ca = a % cols;
    if (b === a + 1) {
      const x = (ca + 1) * UNIT;
      wallSegs.push({ x1: x, y1: ra * UNIT, x2: x, y2: (ra + 1) * UNIT });
    } else {
      const y = (ra + 1) * UNIT;
      wallSegs.push({ x1: ca * UNIT, y1: y, x2: (ca + 1) * UNIT, y2: y });
    }
  });

  const clear = () => commit([]);

  return (
    <div className="flex flex-col gap-4">
      <div
        role="application"
        aria-label="Maze. Drag from Start to End without crossing a wall."
        tabIndex={0}
        className="ring-accent overflow-hidden rounded-2xl border border-line bg-[#0b0c10] outline-none"
      >
        <svg
          ref={svgRef}
          viewBox={`0 0 ${boardW} ${boardH}`}
          className="block w-full touch-none select-none"
          style={{ maxWidth: boardW }}
          onPointerDown={onDown}
          onPointerMove={onMove}
        >
          <rect x="0" y="0" width={boardW} height={boardH} fill="#0b0c10" />

          {/* visited tint */}
          {path.map((i) => (
            <rect
              key={`t${i}`}
              x={(i % cols) * UNIT + 2}
              y={Math.floor(i / cols) * UNIT + 2}
              width={UNIT - 4}
              height={UNIT - 4}
              rx="6"
              fill={solved ? 'rgba(190,242,100,.12)' : 'rgba(52,224,234,.08)'}
            />
          ))}

          {/* the drawn path */}
          {path.length >= 2 && (
            <polyline
              points={poly}
              fill="none"
              stroke={solved ? '#bef264' : '#34e0ea'}
              strokeWidth="9"
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          )}

          {/* start & end markers */}
          {(() => {
            const s = center(startId);
            const e = center(endId);
            return (
              <>
                <circle cx={s.x} cy={s.y} r="12" fill="#bef264" />
                <text x={s.x} y={s.y} dy="0.35em" textAnchor="middle" className="fill-[#0b0c10] font-mono text-[13px] font-bold">S</text>
                <rect x={e.x - 12} y={e.y - 12} width="24" height="24" rx="5" fill="none" stroke="#34e0ea" strokeWidth="3" />
                <text x={e.x} y={e.y} dy="0.35em" textAnchor="middle" className="fill-cyan font-mono text-[13px] font-bold">E</text>
              </>
            );
          })()}

          {/* outer border + walls */}
          <rect x="0" y="0" width={boardW} height={boardH} fill="none" stroke="#333949" strokeWidth="4" />
          {wallSegs.map((w, i) => (
            <line key={`w${i}`} x1={w.x1} y1={w.y1} x2={w.x2} y2={w.y2} stroke="#333949" strokeWidth="4" strokeLinecap="round" />
          ))}
        </svg>
      </div>

      <div className="flex items-center justify-between">
        <span className="font-mono text-xs text-faint">
          {solved ? 'reached the end' : 'drag from S to E'}
        </span>
        <button
          type="button"
          onClick={clear}
          disabled={locked || path.length === 0}
          className="min-h-9 rounded-lg border border-line bg-surface-2 px-3 text-xs font-semibold text-muted disabled:opacity-40"
        >
          Clear
        </button>
      </div>
    </div>
  );
}
