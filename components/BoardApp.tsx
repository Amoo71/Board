'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { ChangeEvent, PointerEvent } from 'react';
import type { BoardImageItem, BoardItem, BoardPathItem, BoardState, BoardTextItem, Point } from '@/lib/board';
import { EMPTY_BOARD, sanitizeBoard } from '@/lib/board';
import { pointsToPath } from '@/lib/paths';

type Tool = 'select' | 'text' | 'pen' | 'eraser';
type DragKind = 'move' | 'resize' | 'rotate';
type EditableItem = BoardTextItem | BoardImageItem;
type Interaction =
  | { type: 'draw'; id: string; pointerId: number }
  | { type: DragKind; id: string; pointerId: number; start: Point; item: EditableItem }
  | null;

type BoardApiResponse = BoardState & {
  warning?: string;
  _storage?: { persistent?: boolean; mode?: string };
};

const LOCAL_KEY = 'amos-board:last-good-board:v4';
const WRITE_KEY = 'amos-board-write-key';
const uid = () => Math.random().toString(36).slice(2) + Date.now().toString(36);

export default function BoardApp() {
  const [board, setBoard] = useState<BoardState>(EMPTY_BOARD);
  const [loaded, setLoaded] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [tool, setTool] = useState<Tool>('select');
  const [selected, setSelected] = useState<string | null>(null);
  const [color, setColor] = useState('#f8fafc');
  const [width, setWidth] = useState(10);
  const [opacity, setOpacity] = useState(1);
  const [dirty, setDirty] = useState(false);
  const [status, setStatus] = useState('Loading');
  const [writeKey, setWriteKey] = useState('');
  const [warning, setWarning] = useState('');
  const [undo, setUndo] = useState<BoardState[]>([]);
  const [redo, setRedo] = useState<BoardState[]>([]);

  const interaction = useRef<Interaction>(null);
  const svg = useRef<SVGSVGElement | null>(null);
  const file = useRef<HTMLInputElement | null>(null);
  const boardRef = useRef(board);
  const dirtyRef = useRef(dirty);

  useEffect(() => { boardRef.current = board; }, [board]);
  useEffect(() => { dirtyRef.current = dirty; }, [dirty]);

  useEffect(() => {
    if (expanded) document.body.classList.add('board-editing');
    else document.body.classList.remove('board-editing');
    return () => document.body.classList.remove('board-editing');
  }, [expanded]);

  useEffect(() => {
    const savedKey = localStorage.getItem(WRITE_KEY) || '';
    setWriteKey(savedKey);
    const localBoard = readLocalBoard();

    fetch('/api/board', { cache: 'no-store', headers: { Accept: 'application/json' } })
      .then(async (res) => {
        const raw = await res.json() as BoardApiResponse;
        const remote = sanitizeBoard(raw);
        const chosen = choosePreferredBoard(remote, localBoard);
        setBoard(chosen);
        setLoaded(true);
        setStatus(res.ok ? 'Synced' : 'Using browser backup');
        writeLocalBoard(chosen);

        if (raw.warning || raw._storage?.persistent === false) {
          setWarning('Persistent online storage is missing. Add Upstash Redis in Vercel, otherwise Vercel can reset the board state.');
        }

        if (localBoard && boardSignature(chosen) === boardSignature(localBoard) && boardSignature(localBoard) !== boardSignature(remote)) {
          void saveRemote(localBoard, savedKey);
        }
      })
      .catch(() => {
        const fallback = localBoard || { ...EMPTY_BOARD, updatedAt: new Date().toISOString() };
        setBoard(fallback);
        setLoaded(true);
        setStatus(localBoard ? 'Browser backup' : 'Offline');
        setWarning('Could not reach the online board API. The widget needs the public Vercel API.');
      });
  }, []);

  useEffect(() => {
    if (!loaded) return;
    writeLocalBoard(board);
    if (!dirty) return;
    setStatus('Saving');
    const id = window.setTimeout(() => {
      void saveRemote(board, writeKey).then((ok) => {
        setStatus(ok ? 'Saved' : 'Saved in browser');
        if (ok) setDirty(false);
        else setWarning('The browser kept a safety copy, but the server did not confirm. Check Vercel Redis/KV settings if the widget does not update.');
      });
    }, 500);
    return () => window.clearTimeout(id);
  }, [board, dirty, loaded, writeKey]);

  useEffect(() => {
    const flush = () => {
      writeLocalBoard(boardRef.current);
      if (dirtyRef.current) void saveRemote(boardRef.current, writeKey, true);
    };
    const onVisibility = () => { if (document.hidden) flush(); };
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pagehide', flush);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pagehide', flush);
    };
  }, [writeKey]);

  const selectedItem = useMemo(
    () => board.items.find((item) => item.id === selected && item.type !== 'path') as EditableItem | undefined,
    [board.items, selected]
  );

  function commit(fn: (b: BoardState) => BoardState, pushUndo = true) {
    setBoard((current) => {
      if (pushUndo) setUndo((stack) => [...stack, current].slice(-70));
      setRedo([]);
      setDirty(true);
      const next = sanitizeBoard(fn({ ...current, updatedAt: new Date().toISOString() }));
      writeLocalBoard(next);
      return next;
    });
  }

  function pointerPos(e: PointerEvent<SVGElement>): Point {
    const el = svg.current;
    if (!el) return { x: 0, y: 0 };
    const matrix = el.getScreenCTM();
    if (matrix) {
      const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(matrix.inverse());
      return { x: clamp(p.x, 0, board.width), y: clamp(p.y, 0, board.height) };
    }
    const rect = el.getBoundingClientRect();
    return {
      x: clamp(((e.clientX - rect.left) / rect.width) * board.width, 0, board.width),
      y: clamp(((e.clientY - rect.top) / rect.height) * board.height, 0, board.height)
    };
  }

  function enterDesignMode() {
    setExpanded(true);
    setSelected(null);
    setStatus('Design mode');
  }

  function boardDown(e: PointerEvent<SVGSVGElement>) {
    if (!expanded) {
      enterDesignMode();
      return;
    }

    e.preventDefault();
    const p = pointerPos(e);

    if (tool === 'text') {
      const text = prompt('Text to add', 'New note');
      if (!text) return;
      const item: BoardTextItem = {
        id: uid(), type: 'text', x: p.x, y: p.y, text, color,
        fontSize: 48, opacity, rotation: 0, width: 420, height: 115
      };
      commit((b) => ({ ...b, items: [...b.items, item] }));
      setSelected(item.id);
      setTool('select');
      return;
    }

    if (tool === 'pen' || tool === 'eraser') {
      svg.current?.setPointerCapture(e.pointerId);
      const item: BoardPathItem = { id: uid(), type: 'path', points: [p], color, width, opacity, tool };
      interaction.current = { type: 'draw', id: item.id, pointerId: e.pointerId };
      commit((b) => ({ ...b, items: [...b.items, item] }));
      return;
    }

    setSelected(null);
  }

  function boardMove(e: PointerEvent<SVGSVGElement>) {
    if (!expanded || !interaction.current) return;
    if (interaction.current.pointerId !== e.pointerId) return;
    e.preventDefault();
    const p = pointerPos(e);
    const current = interaction.current;

    if (current.type === 'draw') {
      setBoard((b) => {
        const next = {
          ...b,
          updatedAt: new Date().toISOString(),
          items: b.items.map((item) => {
            if (item.id !== current.id || item.type !== 'path') return item;
            const last = item.points[item.points.length - 1];
            if (last && Math.hypot(last.x - p.x, last.y - p.y) < 2.2) return item;
            return { ...item, points: [...item.points, p] };
          })
        };
        const clean = sanitizeBoard(next);
        writeLocalBoard(clean);
        return clean;
      });
      setDirty(true);
      return;
    }

    setBoard((b) => {
      const dx = p.x - current.start.x;
      const dy = p.y - current.start.y;
      const next = {
        ...b,
        updatedAt: new Date().toISOString(),
        items: b.items.map((item) => {
          if (item.id !== current.id || item.type === 'path') return item;
          if (current.type === 'move') return { ...item, x: current.item.x + dx, y: current.item.y + dy };
          if (current.type === 'resize') return { ...item, width: Math.max(80, current.item.width + dx), height: Math.max(55, current.item.height + dy) };
          const cx = current.item.x + current.item.width / 2;
          const cy = current.item.y + current.item.height / 2;
          return { ...item, rotation: Math.atan2(p.y - cy, p.x - cx) * 180 / Math.PI + 90 };
        })
      };
      const clean = sanitizeBoard(next);
      writeLocalBoard(clean);
      return clean;
    });
    setDirty(true);
  }

  function boardUp(e?: PointerEvent<SVGSVGElement>) {
    if (e && interaction.current?.pointerId === e.pointerId) {
      try { svg.current?.releasePointerCapture(e.pointerId); } catch {}
    }
    interaction.current = null;
  }

  function startItem(e: PointerEvent<SVGGElement>, id: string, kind: DragKind) {
    e.stopPropagation();
    e.preventDefault();
    if (!expanded) {
      enterDesignMode();
      return;
    }
    const item = hit(id);
    if (!item) return;
    svg.current?.setPointerCapture(e.pointerId);
    setSelected(id);
    interaction.current = { id, kind, type: kind, pointerId: e.pointerId, start: pointerPos(e), item };
    setUndo((stack) => [...stack, board].slice(-70));
    setRedo([]);
  }

  function hit(id: string) {
    return board.items.find((item) => item.id === id && item.type !== 'path') as EditableItem | undefined;
  }

  function addImage(src: string) {
    const item: BoardImageItem = { id: uid(), type: 'image', x: 180, y: 160, src, width: 430, height: 290, opacity: 1, rotation: 0 };
    commit((b) => ({ ...b, items: [...b.items, item] }));
    setExpanded(true);
    setSelected(item.id);
  }

  function upload(e: ChangeEvent<HTMLInputElement>) {
    const picked = e.target.files?.[0];
    if (!picked) return;
    const reader = new FileReader();
    reader.onload = () => addImage(String(reader.result));
    reader.readAsDataURL(picked);
    e.target.value = '';
  }

  function addUrl() {
    const url = prompt('Image URL');
    if (url) addImage(url);
  }

  function editSelectedText() {
    if (!selectedItem || selectedItem.type !== 'text') return;
    const text = prompt('Edit text', selectedItem.text);
    if (text === null) return;
    commit((b) => ({ ...b, items: b.items.map((item) => item.id === selectedItem.id && item.type === 'text' ? { ...item, text } : item) }));
  }

  function deleteSelected() {
    if (!selected) return;
    commit((b) => ({ ...b, items: b.items.filter((item) => item.id !== selected) }));
    setSelected(null);
  }

  async function reset() {
    if (!confirm('Clear the board? This is the only action that should intentionally reset it.')) return;
    const next = { ...EMPTY_BOARD, updatedAt: new Date().toISOString() };
    setUndo((stack) => [...stack, board].slice(-70));
    setRedo([]);
    setBoard(next);
    writeLocalBoard(next);
    setDirty(false);
    setSelected(null);
    const ok = await deleteRemote(writeKey);
    setStatus(ok ? 'Cleared' : 'Cleared locally');
  }

  function undoIt() {
    setUndo((stack) => {
      const prev = stack.at(-1);
      if (!prev) return stack;
      setRedo((r) => [board, ...r].slice(0, 70));
      setBoard(prev);
      writeLocalBoard(prev);
      setDirty(true);
      return stack.slice(0, -1);
    });
  }

  function redoIt() {
    setRedo((stack) => {
      const next = stack[0];
      if (!next) return stack;
      setUndo((u) => [...u, board].slice(-70));
      setBoard(next);
      writeLocalBoard(next);
      setDirty(true);
      return stack.slice(1);
    });
  }

  function storeKey() {
    localStorage.setItem(WRITE_KEY, writeKey);
    setStatus('Write key saved');
  }

  return (
    <main className={'page ' + (expanded ? 'editingPage' : '')}>
      <div className="aurora" />
      <section className="shell">
        <div className="hero">
          <div>
            <p className="kicker">Live widget canvas</p>
            <h1>Amo‘s Board</h1>
            <p className="hint">Choose the board first. Then the editor locks into place, so drawing and moving items line up correctly on mobile.</p>
          </div>
          <div className="auth">
            <input placeholder="Optional write key" value={writeKey} onChange={(e) => setWriteKey(e.target.value)} />
            <button onClick={storeKey}>Save key</button>
          </div>
        </div>

        {warning && <div className="warning">{warning}</div>}

        <div className={'boardWrap ' + (expanded ? 'expanded' : '')}>
          <div className="boardChrome">
            <div className="titleBar">
              <div>
                <div className="title">Amo‘s Board</div>
                <div className="status">{expanded ? status : 'Preview mode'}</div>
              </div>
              {expanded ? <button className="doneBtn" onClick={() => { setExpanded(false); setTool('select'); setSelected(null); }}>Done</button> : <span className="tapHint">Tap to design</span>}
            </div>

            <svg
              ref={svg}
              className="canvas"
              viewBox={`0 0 ${board.width} ${board.height}`}
              preserveAspectRatio="xMidYMid meet"
              onPointerDown={boardDown}
              onPointerMove={boardMove}
              onPointerUp={boardUp}
              onPointerCancel={boardUp}
              onPointerLeave={boardUp}
            >
              {board.items.length === 0 && <>
                <text className="empty" x="50%" y="47%" textAnchor="middle">{expanded ? 'Start designing' : 'Tap board to design'}</text>
                <text className="emptySmall" x="50%" y="54%" textAnchor="middle">{expanded ? 'Text • Pen • Images • Eraser • Sync' : 'Preview mode'}</text>
              </>}
              {board.items.map((item) => renderItem(item, startItem))}
              {!expanded && <rect x="0" y="0" width={board.width} height={board.height} fill="transparent" />}
              {expanded && selectedItem && <Selection item={selectedItem} onDown={startItem} />}
            </svg>

            <div className="tools" aria-hidden={!expanded}>
              <button className={'tool ' + (tool === 'select' ? 'active' : '')} onClick={() => setTool('select')}>⌖</button>
              <button className={'tool ' + (tool === 'text' ? 'active' : '')} onClick={() => setTool('text')}>T</button>
              <button className={'tool ' + (tool === 'pen' ? 'active' : '')} onClick={() => setTool('pen')}>✎</button>
              <button className={'tool ' + (tool === 'eraser' ? 'active' : '')} onClick={() => setTool('eraser')}>⌫</button>
              <div className={'penPanel ' + ((tool === 'pen' || tool === 'eraser') ? 'open' : '')}>
                <input aria-label="Pen color" type="color" value={color} onChange={(e) => setColor(e.target.value)} />
                <span className="pill">Size</span>
                <input aria-label="Pen size" type="range" min="1" max="80" value={width} onChange={(e) => setWidth(Number(e.target.value))} />
                <span className="pill">Opacity</span>
                <input aria-label="Pen opacity" type="range" min="0.1" max="1" step="0.05" value={opacity} onChange={(e) => setOpacity(Number(e.target.value))} />
              </div>
              <button className="tool" onClick={() => file.current?.click()}>▧</button>
              <button className="ghost" onClick={addUrl}>Image URL</button>
              {selectedItem?.type === 'text' && <button className="ghost" onClick={editSelectedText}>Edit text</button>}
              {selectedItem && <button className="ghost" onClick={deleteSelected}>Delete</button>}
              <button className="tool" onClick={undoIt}>↶</button>
              <button className="tool" onClick={redoIt}>↷</button>
              <button className="ghost danger" onClick={reset}>Reset</button>
            </div>
            <input ref={file} className="fileInput" type="file" accept="image/*" onChange={upload} />
          </div>
        </div>
      </section>
    </main>
  );
}

function renderItem(item: BoardItem, start: (e: PointerEvent<SVGGElement>, id: string, kind: DragKind) => void) {
  if (item.type === 'path') {
    return <path key={item.id} d={pointsToPath(item.points)} fill="none" stroke={item.tool === 'eraser' ? '#101827' : item.color} strokeWidth={item.width} strokeLinecap="round" strokeLinejoin="round" opacity={item.opacity} />;
  }

  if (item.type === 'text') {
    return (
      <g key={item.id} className="item" transform={`rotate(${item.rotation} ${item.x + item.width / 2} ${item.y + item.height / 2})`} onPointerDown={(e) => start(e, item.id, 'move')}>
        <rect x={item.x - 16} y={item.y - 16} width={item.width + 32} height={item.height + 32} fill="transparent" />
        <text x={item.x} y={item.y + item.fontSize} fill={item.color} opacity={item.opacity} fontSize={item.fontSize} fontWeight="750">
          {item.text.split(String.fromCharCode(10)).map((line, index) => <tspan key={index} x={item.x} dy={index ? item.fontSize * 1.15 : 0}>{line}</tspan>)}
        </text>
      </g>
    );
  }

  return (
    <g key={item.id} className="item" transform={`rotate(${item.rotation} ${item.x + item.width / 2} ${item.y + item.height / 2})`} onPointerDown={(e) => start(e, item.id, 'move')}>
      <rect x={item.x - 18} y={item.y - 18} width={item.width + 36} height={item.height + 36} fill="transparent" />
      <image href={item.src} x={item.x} y={item.y} width={item.width} height={item.height} preserveAspectRatio="xMidYMid slice" opacity={item.opacity} />
    </g>
  );
}

function Selection({ item, onDown }: { item: EditableItem; onDown: (e: PointerEvent<SVGGElement>, id: string, kind: DragKind) => void }) {
  const cx = item.x + item.width / 2;
  const cy = item.y + item.height / 2;
  return (
    <g transform={`rotate(${item.rotation} ${cx} ${cy})`}>
      <rect className="selectedBox" x={item.x} y={item.y} width={item.width} height={item.height} rx="18" />
      <g onPointerDown={(e) => onDown(e, item.id, 'move')}><circle className="moveHandle" cx={cx} cy={cy} r="22" /></g>
      <g onPointerDown={(e) => onDown(e, item.id, 'resize')}><circle className="handle" cx={item.x + item.width} cy={item.y + item.height} r="22" /></g>
      <g onPointerDown={(e) => onDown(e, item.id, 'rotate')}><circle className="rotate" cx={cx} cy={item.y - 52} r="20" /><line x1={cx} y1={item.y} x2={cx} y2={item.y - 34} stroke="#c4b5fd" strokeWidth="5" /></g>
    </g>
  );
}

function readLocalBoard(): BoardState | null {
  try {
    const raw = localStorage.getItem(LOCAL_KEY);
    return raw ? sanitizeBoard(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}

function writeLocalBoard(board: BoardState) {
  try { localStorage.setItem(LOCAL_KEY, JSON.stringify(board)); } catch {}
}

async function saveRemote(board: BoardState, writeKey: string, keepalive = false): Promise<boolean> {
  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (writeKey) headers.Authorization = `Bearer ${writeKey}`;
    const res = await fetch('/api/board', { method: 'PUT', headers, body: JSON.stringify(board), keepalive });
    return res.ok;
  } catch {
    return false;
  }
}

async function deleteRemote(writeKey: string): Promise<boolean> {
  try {
    const headers: Record<string, string> = {};
    if (writeKey) headers.Authorization = `Bearer ${writeKey}`;
    const res = await fetch('/api/board', { method: 'DELETE', headers });
    return res.ok;
  } catch {
    return false;
  }
}

function choosePreferredBoard(remote: BoardState, local: BoardState | null): BoardState {
  if (!local) return remote;
  const remoteTime = Date.parse(remote.updatedAt || '') || 0;
  const localTime = Date.parse(local.updatedAt || '') || 0;
  if (local.items.length > 0 && remote.items.length === 0 && localTime > remoteTime) return local;
  return localTime > remoteTime ? local : remote;
}

function boardSignature(board: BoardState) {
  return `${board.updatedAt}:${board.items.length}`;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}
