import { useState, useRef, useEffect, useMemo, useCallback } from "react";

/* ============================================================================
   ZIP — procedural puzzle generator + player (prototype)

   Generation is guaranteed solvable by construction:
     1. build a full Hamiltonian path that covers every cell (Warnsdorff + backtracking,
        with a boustrophedon "snake" fallback that always exists)
     2. place numbered checkpoints ALONG that path in ascending order
     3. add walls only on edges the solution path never uses (so the solution stays valid)
   The stored path is a concrete solution, so the board can never be unsolvable.

   These generator functions are pure and portable — lift them straight into the
   real build as the Zip mechanic's procedural generator.
============================================================================ */

// seeded RNG so a board is reproducible from its seed
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const edgeKey = (a, b) => (a < b ? a + "-" + b : b + "-" + a);

function generateHamPath(rows, cols, rng) {
  const total = rows * cols;
  const start = Math.floor(rng() * total);
  const path = [start];
  const visited = new Uint8Array(total);
  visited[start] = 1;
  let budget = 300000;
  const neigh = (i) => {
    const r = (i / cols) | 0, c = i % cols, out = [];
    if (r > 0) out.push(i - cols);
    if (r < rows - 1) out.push(i + cols);
    if (c > 0) out.push(i - 1);
    if (c < cols - 1) out.push(i + 1);
    return out;
  };
  const openCount = (i) => neigh(i).reduce((n, x) => n + (visited[x] ? 0 : 1), 0);
  function dfs() {
    if (budget-- <= 0) return false;
    if (path.length === total) return true;
    const cur = path[path.length - 1];
    let opts = neigh(cur).filter((x) => !visited[x]);
    for (let k = opts.length - 1; k > 0; k--) {
      const j = Math.floor(rng() * (k + 1));
      [opts[k], opts[j]] = [opts[j], opts[k]];
    }
    opts.sort((a, b) => openCount(a) - openCount(b)); // Warnsdorff heuristic
    for (const nx of opts) {
      visited[nx] = 1; path.push(nx);
      if (dfs()) return true;
      path.pop(); visited[nx] = 0;
    }
    return false;
  }
  return dfs() ? path : null;
}

function snakePath(rows, cols) {
  const p = [];
  for (let r = 0; r < rows; r++) {
    if (r % 2 === 0) for (let c = 0; c < cols; c++) p.push(r * cols + c);
    else for (let c = cols - 1; c >= 0; c--) p.push(r * cols + c);
  }
  return p;
}

function placeCheckpoints(path, k) {
  const total = path.length;
  k = Math.max(2, Math.min(k, total));
  const posSet = new Set([0, total - 1]);
  for (let m = 1; m < k - 1; m++) {
    let pos = Math.round((m * (total - 1)) / (k - 1));
    while (posSet.has(pos) && pos < total - 1) pos++;
    while (posSet.has(pos) && pos > 0) pos--;
    posSet.add(pos);
  }
  const positions = [...posSet].sort((a, b) => a - b);
  const map = new Map();
  positions.forEach((pos, i) => map.set(path[pos], i + 1));
  return map;
}

function buildWalls(path, rows, cols, density, rng) {
  const used = new Set();
  for (let i = 0; i < path.length - 1; i++) used.add(edgeKey(path[i], path[i + 1]));
  const cand = [];
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++) {
      const i = r * cols + c;
      if (c < cols - 1) { const k = edgeKey(i, i + 1); if (!used.has(k)) cand.push(k); }
      if (r < rows - 1) { const k = edgeKey(i, i + cols); if (!used.has(k)) cand.push(k); }
    }
  for (let k = cand.length - 1; k > 0; k--) {
    const j = Math.floor(rng() * (k + 1));
    [cand[k], cand[j]] = [cand[j], cand[k]];
  }
  return new Set(cand.slice(0, Math.floor(cand.length * density)));
}

const DIFF = {
  easy: { size: 5, density: 0.12, label: "Easy", grid: "5×5" },
  medium: { size: 6, density: 0.22, label: "Medium", grid: "6×6" },
  hard: { size: 7, density: 0.34, label: "Hard", grid: "7×7" },
};

function generatePuzzle(diff, seed) {
  const { size, density } = DIFF[diff];
  const rows = size, cols = size, total = rows * cols;
  const rng = mulberry32(seed >>> 0);
  const path = generateHamPath(rows, cols, rng) || snakePath(rows, cols);
  const k = Math.max(5, Math.min(14, Math.round(total / 4)));
  const checkpoints = placeCheckpoints(path, k);
  const walls = buildWalls(path, rows, cols, density, rng);
  return { rows, cols, total, checkpoints, walls, solution: path, diff };
}

/* ============================================================================ */

const CELL = 64;
const C = {
  canvas: "#EEF2F7", ink: "#182031", sub: "#5B6675", faint: "#8A94A6",
  line: "#E4E9F1", cell: "#FFFFFF", accent: "#6366F1", accent2: "#22D3EE",
  wall: "#0F172A", good: "#10B981", good2: "#34D399", ring: "#C7CBFF",
};
const fmt = (ms) => {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

export default function ZipPrototype() {
  const [diff, setDiff] = useState("medium");
  const [seed, setSeed] = useState(() => (Date.now() >>> 0));
  const puzzle = useMemo(() => generatePuzzle(diff, seed), [diff, seed]);
  const { rows, cols, total, checkpoints, walls, solution } = puzzle;
  const boardW = cols * CELL, boardH = rows * CELL;

  const cellByNum = useMemo(() => {
    const m = new Map();
    checkpoints.forEach((n, cell) => m.set(n, cell));
    return m;
  }, [checkpoints]);
  const cp1 = cellByNum.get(1);

  const [path, setPath] = useState([]);
  const [viewMode, setViewMode] = useState("play"); // 'play' | 'solution'
  const [solved, setSolved] = useState(false);
  const [running, setRunning] = useState(false);
  const [endTs, setEndTs] = useState(null);
  const [nowTick, setNowTick] = useState(0);

  // refs read synchronously inside pointer handlers (avoid stale closures on fast drags)
  const pathRef = useRef([]);
  const drawingRef = useRef(false);
  const lastRef = useRef(null);
  const solvedRef = useRef(false);
  const runningRef = useRef(false);
  const startTsRef = useRef(null);
  const svgRef = useRef(null);
  const boardRef = useRef(null);
  const [announce, setAnnounce] = useState("");

  const resetTimer = () => {
    runningRef.current = false; setRunning(false);
    startTsRef.current = null; setEndTs(null); setNowTick(0);
  };
  const commit = (arr) => { pathRef.current = arr; setPath(arr); };

  // reset play state whenever the puzzle changes
  useEffect(() => {
    commit([]); solvedRef.current = false; setSolved(false);
    setViewMode("play"); setAnnounce(""); resetTimer();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [diff, seed]);

  useEffect(() => {
    const up = () => { drawingRef.current = false; };
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
    return () => { window.removeEventListener("pointerup", up); window.removeEventListener("pointercancel", up); };
  }, []);

  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => setNowTick(Date.now()), 200);
    return () => clearInterval(t);
  }, [running]);

  const ensureRunning = () => {
    if (!runningRef.current && !solvedRef.current) {
      runningRef.current = true; startTsRef.current = Date.now();
      setRunning(true); setEndTs(null); setNowTick(Date.now());
    }
  };
  const adjacent = (a, b) => {
    const ra = (a / cols) | 0, ca = a % cols, rb = (b / cols) | 0, cb = b % cols;
    return Math.abs(ra - rb) + Math.abs(ca - cb) === 1;
  };
  const canEnter = (target, p) => {
    if (p.includes(target)) return false;
    const end = p[p.length - 1];
    if (!adjacent(end, target)) return false;
    if (walls.has(edgeKey(end, target))) return false;
    const num = checkpoints.get(target);
    if (num !== undefined) {
      const hit = p.reduce((n, c) => n + (checkpoints.has(c) ? 1 : 0), 0);
      if (num !== hit + 1) return false;
    }
    return true;
  };

  const applyCell = useCallback((target) => {
    if (solvedRef.current) return;
    const p = pathRef.current;
    if (p.length === 0) {
      if (target === cp1) { commit([cp1]); ensureRunning(); }
      return;
    }
    const end = p[p.length - 1];
    if (target === end) return;
    if (p.length >= 2 && target === p[p.length - 2]) { commit(p.slice(0, -1)); return; }
    if (canEnter(target, p)) {
      const np = [...p, target];
      commit(np); ensureRunning();
      if (np.length === total) {
        solvedRef.current = true; setSolved(true);
        runningRef.current = false; setRunning(false); setEndTs(Date.now());
        setAnnounce("Solved! Every cell filled and all numbers hit in order.");
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cp1, checkpoints, walls, total, cols]);

  const cellFromEvent = (e) => {
    const svg = svgRef.current; if (!svg) return null;
    const rect = svg.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * boardW;
    const y = ((e.clientY - rect.top) / rect.height) * boardH;
    if (x < 0 || y < 0 || x >= boardW || y >= boardH) return null;
    const c = Math.min(cols - 1, Math.floor(x / CELL));
    const r = Math.min(rows - 1, Math.floor(y / CELL));
    return r * cols + c;
  };

  const onPointerDown = (e) => {
    if (viewMode !== "play" || solvedRef.current) return;
    const cell = cellFromEvent(e); if (cell == null) return;
    e.preventDefault();
    drawingRef.current = true; lastRef.current = cell;
    applyCell(cell);
  };
  const onPointerMove = (e) => {
    if (!drawingRef.current || viewMode !== "play") return;
    const cell = cellFromEvent(e);
    if (cell == null || cell === lastRef.current) return;
    lastRef.current = cell;
    applyCell(cell);
  };

  const onKeyDown = (e) => {
    if (viewMode !== "play" || solvedRef.current) return;
    const p = pathRef.current;
    if (e.key === "Backspace") { e.preventDefault(); if (p.length) { commit(p.slice(0, -1)); if (p.length === 1) resetTimer(); } return; }
    const dirs = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] };
    if (!dirs[e.key]) return;
    e.preventDefault();
    if (p.length === 0) { if (cp1 != null) { commit([cp1]); ensureRunning(); } return; }
    const end = p[p.length - 1], r = (end / cols) | 0, c = end % cols;
    const [dr, dc] = dirs[e.key], nr = r + dr, nc = c + dc;
    if (nr < 0 || nc < 0 || nr >= rows || nc >= cols) return;
    applyCell(nr * cols + nc);
  };

  const newPuzzle = () => setSeed((Date.now() ^ (Math.random() * 1e9)) >>> 0);
  const clearPath = () => { if (solvedRef.current) return; commit([]); solvedRef.current = false; setSolved(false); resetTimer(); };
  const undo = () => { const p = pathRef.current; if (p.length) { commit(p.slice(0, -1)); if (p.length === 1) resetTimer(); } };

  // ---- derived render data ----
  const center = (i) => ({ x: ((i % cols) + 0.5) * CELL, y: (((i / cols) | 0) + 0.5) * CELL });
  const drawn = viewMode === "solution" ? solution : path;
  const polyPts = drawn.map((i) => { const p = center(i); return `${p.x},${p.y}`; }).join(" ");
  const hitCount = path.reduce((n, c) => n + (checkpoints.has(c) ? 1 : 0), 0);
  const nextNum = hitCount + 1;
  const nextCell = viewMode === "play" && !solved ? cellByNum.get(nextNum) : undefined;
  const displayMs = startTsRef.current ? Math.max(0, (endTs ?? nowTick) - startTsRef.current) : 0;

  const wallSegs = [];
  walls.forEach((key) => {
    const [a, b] = key.split("-").map(Number);
    const ra = (a / cols) | 0, ca = a % cols;
    const INS = 5;
    if (b === a + 1) {
      const x = (ca + 1) * CELL;
      wallSegs.push({ x1: x, y1: ra * CELL + INS, x2: x, y2: (ra + 1) * CELL - INS });
    } else {
      const y = (ra + 1) * CELL;
      wallSegs.push({ x1: ca * CELL + INS, y1: y, x2: (ca + 1) * CELL - INS, y2: y });
    }
  });

  const stroke = solved ? "url(#gGood)" : "url(#gPath)";

  return (
    <div style={S.wrap}>
      <style>{`
        .zipbtn{transition:background .15s ease,border-color .15s ease,color .15s ease}
        .zipbtn:hover{background:#F2F4F9}
        .zipbtn:active{transform:translateY(1px)}
        .zipseg{transition:color .15s ease}
        .zipboard:focus{outline:none}
        .zipboard:focus-visible{outline:2px solid ${C.accent};outline-offset:5px;border-radius:22px}
        .zipsolved{animation:pop .45s cubic-bezier(.2,.9,.3,1.2)}
        @keyframes pop{0%{transform:scale(.96)}60%{transform:scale(1.015)}100%{transform:scale(1)}}
        @media (prefers-reduced-motion: reduce){.zipsolved{animation:none}.zipbtn{transition:none}}
      `}</style>

      <div style={S.shell}>
        <header style={S.head}>
          <div>
            <div style={S.eyebrow}>PATH PUZZLE · GENERATED &amp; VERIFIED SOLVABLE</div>
            <h1 style={S.title}>Zip</h1>
          </div>
          <div style={S.seg} role="group" aria-label="Difficulty">
            {Object.keys(DIFF).map((d) => {
              const on = d === diff;
              return (
                <button key={d} className="zipseg" onClick={() => setDiff(d)}
                  aria-pressed={on}
                  style={{ ...S.segBtn, ...(on ? S.segOn : null) }}>
                  <span style={{ fontWeight: 650 }}>{DIFF[d].label}</span>
                  <span style={{ ...S.segGrid, color: on ? "rgba(255,255,255,.7)" : C.faint }}>{DIFF[d].grid}</span>
                </button>
              );
            })}
          </div>
        </header>

        <p style={S.how}>
          Start on <b style={{ color: C.ink }}>1</b>, then draw one continuous line that fills every cell and
          reaches the numbers in order. Move up/down/left/right — never through a wall.
        </p>

        <div
          ref={boardRef}
          className={`zipboard${solved ? " zipsolved" : ""}`}
          tabIndex={0}
          role="application"
          aria-label="Zip board. Use arrow keys to draw the path, Backspace to undo."
          onKeyDown={onKeyDown}
          style={S.boardWrap}
        >
          <svg
            ref={svgRef}
            viewBox={`0 0 ${boardW} ${boardH}`}
            width="100%"
            style={{ display: "block", maxWidth: boardW, margin: "0 auto", touchAction: "none", userSelect: "none" }}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
          >
            <defs>
              <linearGradient id="gPath" x1="0" y1="0" x2={boardW} y2={boardH} gradientUnits="userSpaceOnUse">
                <stop offset="0" stopColor={C.accent} />
                <stop offset="1" stopColor={C.accent2} />
              </linearGradient>
              <linearGradient id="gGood" x1="0" y1="0" x2={boardW} y2={boardH} gradientUnits="userSpaceOnUse">
                <stop offset="0" stopColor={C.good} />
                <stop offset="1" stopColor={C.good2} />
              </linearGradient>
            </defs>

            {/* board surface */}
            <rect x="0" y="0" width={boardW} height={boardH} rx="18" fill={C.cell} stroke={C.line} strokeWidth="2" />

            {/* grid lines */}
            {Array.from({ length: cols - 1 }, (_, i) => (
              <line key={"v" + i} x1={(i + 1) * CELL} y1="8" x2={(i + 1) * CELL} y2={boardH - 8} stroke={C.line} strokeWidth="1.5" />
            ))}
            {Array.from({ length: rows - 1 }, (_, i) => (
              <line key={"h" + i} x1="8" y1={(i + 1) * CELL} x2={boardW - 8} y2={(i + 1) * CELL} stroke={C.line} strokeWidth="1.5" />
            ))}

            {/* visited tint */}
            {drawn.map((i) => {
              const c = i % cols, r = (i / cols) | 0;
              return <rect key={"t" + i} x={c * CELL + 3} y={r * CELL + 3} width={CELL - 6} height={CELL - 6} rx="10"
                fill={solved ? "rgba(16,185,129,.10)" : "rgba(99,102,241,.09)"} />;
            })}

            {/* path: under-glow + main cable */}
            {drawn.length >= 2 && (
              <>
                <polyline points={polyPts} fill="none" stroke={stroke} strokeOpacity="0.18"
                  strokeWidth="30" strokeLinejoin="round" strokeLinecap="round" />
                <polyline points={polyPts} fill="none" stroke={stroke}
                  strokeWidth="15" strokeLinejoin="round" strokeLinecap="round" />
              </>
            )}
            {drawn.length >= 1 && (() => { const p = center(drawn[0]); return <circle cx={p.x} cy={p.y} r="8" fill={stroke} />; })()}

            {/* walls */}
            {wallSegs.map((w, i) => (
              <line key={"w" + i} x1={w.x1} y1={w.y1} x2={w.x2} y2={w.y2}
                stroke={C.wall} strokeWidth="8" strokeLinecap="round" />
            ))}

            {/* checkpoints */}
            {[...checkpoints.entries()].map(([cell, num]) => {
              const p = center(cell);
              const isNext = cell === nextCell;
              return (
                <g key={"c" + cell}>
                  {isNext && <circle cx={p.x} cy={p.y} r="26" fill="none" stroke={C.accent} strokeWidth="3" strokeDasharray="4 5" opacity="0.9" />}
                  <circle cx={p.x} cy={p.y} r="21" fill={C.ink} />
                  <text x={p.x} y={p.y} dy="0.35em" textAnchor="middle"
                    style={{ font: "700 26px ui-monospace, SFMono-Regular, Menlo, monospace", fill: "#fff" }}>{num}</text>
                </g>
              );
            })}
          </svg>
        </div>

        {/* status + controls */}
        <div style={S.statusRow}>
          <div style={S.stat}>
            <span style={S.statNum}>{path.length}<span style={S.statDen}>/{total}</span></span>
            <span style={S.statLbl}>cells filled</span>
          </div>
          <div style={S.stat}>
            <span style={S.statNum}>{Math.min(nextNum, checkpoints.size)}<span style={S.statDen}>/{checkpoints.size}</span></span>
            <span style={S.statLbl}>numbers reached</span>
          </div>
          <div style={S.stat}>
            <span style={{ ...S.statNum, fontVariantNumeric: "tabular-nums" }}>{fmt(displayMs)}</span>
            <span style={S.statLbl}>time</span>
          </div>
        </div>

        {solved && (
          <div style={S.win} role="status">
            <span style={{ fontSize: 18 }}>✓</span>
            <span><b>Solved</b> in {fmt(displayMs)} — one line, every cell, numbers in order.</span>
          </div>
        )}

        <div style={S.controls}>
          <button className="zipbtn" style={S.primary} onClick={newPuzzle}>New puzzle</button>
          <button className="zipbtn" style={S.btn} onClick={undo} disabled={solved || path.length === 0}>Undo</button>
          <button className="zipbtn" style={S.btn} onClick={clearPath} disabled={solved || path.length === 0}>Clear path</button>
          <button className="zipbtn" style={S.btn} onClick={() => setViewMode((v) => (v === "play" ? "solution" : "play"))}>
            {viewMode === "play" ? "Peek at solution" : "Back to play"}
          </button>
        </div>

        <p style={S.foot}>
          Every board is built from a real Hamiltonian path, so a valid solution is guaranteed before you ever
          see it. Walls sit only on edges the solution doesn’t use. Drag to draw, or click the board and use the arrow keys.
        </p>
      </div>

      <span aria-live="polite" style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0 0 0 0)" }}>{announce}</span>
    </div>
  );
}

const S = {
  wrap: { position: "relative", background: C.canvas, minHeight: "100%", padding: "28px 16px 40px", boxSizing: "border-box", fontFamily: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif", color: C.ink },
  shell: { maxWidth: 560, margin: "0 auto" },
  head: { display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 16, flexWrap: "wrap" },
  eyebrow: { font: "600 11px ui-monospace, SFMono-Regular, Menlo, monospace", letterSpacing: "0.12em", color: C.faint },
  title: { margin: "4px 0 0", fontSize: 44, fontWeight: 800, letterSpacing: "-0.03em", lineHeight: 1 },
  seg: { display: "inline-flex", background: "#fff", border: `1px solid ${C.line}`, borderRadius: 12, padding: 3, gap: 2 },
  segBtn: { display: "flex", flexDirection: "column", alignItems: "center", gap: 1, padding: "6px 12px", border: "none", background: "transparent", borderRadius: 9, cursor: "pointer", color: C.sub, fontSize: 13 },
  segOn: { background: C.ink, color: "#fff" },
  segGrid: { font: "500 10px ui-monospace, monospace" },
  how: { fontSize: 14.5, lineHeight: 1.55, color: C.sub, margin: "20px 0 16px" },
  boardWrap: { background: "transparent", borderRadius: 22, padding: 2 },
  statusRow: { display: "flex", gap: 10, marginTop: 20 },
  stat: { flex: 1, background: "#fff", border: `1px solid ${C.line}`, borderRadius: 14, padding: "12px 14px", display: "flex", flexDirection: "column", gap: 2 },
  statNum: { fontSize: 22, fontWeight: 750, letterSpacing: "-0.02em" },
  statDen: { fontSize: 14, fontWeight: 600, color: C.faint },
  statLbl: { fontSize: 11.5, color: C.faint, textTransform: "uppercase", letterSpacing: "0.05em" },
  win: { marginTop: 14, display: "flex", alignItems: "center", gap: 10, background: "rgba(16,185,129,.10)", border: `1px solid ${C.good}`, color: "#0B5B44", borderRadius: 14, padding: "12px 16px", fontSize: 14.5 },
  controls: { display: "flex", gap: 8, marginTop: 16, flexWrap: "wrap" },
  primary: { flex: "1 1 auto", padding: "12px 16px", border: "none", borderRadius: 12, background: C.accent, color: "#fff", fontWeight: 650, fontSize: 14.5, cursor: "pointer" },
  btn: { padding: "12px 16px", border: `1px solid ${C.line}`, borderRadius: 12, background: "#fff", color: C.ink, fontWeight: 600, fontSize: 14.5, cursor: "pointer" },
  foot: { marginTop: 18, fontSize: 12.5, lineHeight: 1.6, color: C.faint },
};
