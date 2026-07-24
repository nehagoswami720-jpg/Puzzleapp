'use client';

import { useState } from 'react';
import type { ConnectionsAnswer, ConnectionsContent } from '@/lib/mechanics/connections';
import type { RendererProps } from '@/lib/mechanics/types';

/**
 * Connections: 16 items, form four groups of four. Select up to four, lock the
 * group, repeat. Once all four groups are locked the answer becomes
 * submittable; PlayShell's Submit grades the whole board.
 */
const GROUP_STYLE = [
  'border-lime bg-lime/10 text-lime',
  'border-cyan bg-cyan/10 text-cyan',
  'border-amber bg-amber/10 text-amber',
  'border-rose bg-rose/10 text-rose',
];

export default function ConnectionsBoard({
  instance,
  onAnswerChange,
  locked: readOnly,
}: RendererProps<ConnectionsContent, ConnectionsAnswer>) {
  const items = instance.content.items;
  const [groups, setGroups] = useState<string[][]>([]);
  const [selected, setSelected] = useState<string[]>([]);

  const used = new Set(groups.flat());
  const pool = items.filter((i) => !used.has(i));

  const commit = (next: string[][]) => {
    setGroups(next);
    setSelected([]);
    onAnswerChange(next.length === 4 ? next : null);
  };

  const toggle = (item: string) => {
    if (readOnly) return;
    setSelected((s) =>
      s.includes(item) ? s.filter((x) => x !== item) : s.length < 4 ? [...s, item] : s,
    );
  };

  const lockGroup = () => {
    if (selected.length === 4) commit([...groups, selected]);
  };
  const undo = () => {
    if (groups.length) commit(groups.slice(0, -1));
  };

  return (
    <div className="flex flex-col gap-3">
      {/* locked groups */}
      {groups.map((g, i) => (
        <div
          key={i}
          className={`flex flex-wrap gap-1.5 rounded-xl border p-2 ${GROUP_STYLE[i] ?? 'border-line'}`}
        >
          {g.map((item) => (
            <span key={item} className="rounded-lg bg-surface/60 px-2.5 py-1.5 text-[13px] font-medium">
              {item}
            </span>
          ))}
        </div>
      ))}

      {/* remaining pool */}
      {pool.length > 0 && (
        <div className="grid grid-cols-4 gap-1.5">
          {pool.map((item) => {
            const on = selected.includes(item);
            return (
              <button
                key={item}
                type="button"
                disabled={readOnly}
                onClick={() => toggle(item)}
                className={[
                  'grid min-h-14 place-items-center rounded-xl border px-1 py-2 text-center text-[12px] leading-tight font-semibold transition',
                  on
                    ? 'border-lime bg-lime/15 text-ink'
                    : 'border-line bg-surface-2 text-muted hover:border-line-strong',
                ].join(' ')}
              >
                {item}
              </button>
            );
          })}
        </div>
      )}

      <div className="flex items-center justify-between gap-3">
        <span className="font-mono text-xs text-faint">
          <b className="text-ink">{groups.length}</b>/4 groups
        </span>
        <div className="flex gap-2">
          {groups.length > 0 && (
            <button
              type="button"
              onClick={undo}
              disabled={readOnly}
              className="min-h-9 rounded-lg border border-line bg-surface-2 px-3 text-xs font-semibold text-muted disabled:opacity-40"
            >
              Undo group
            </button>
          )}
          {pool.length > 0 && (
            <button
              type="button"
              onClick={lockGroup}
              disabled={readOnly || selected.length !== 4}
              className="min-h-9 rounded-lg bg-lime px-3 text-xs font-semibold text-canvas disabled:bg-surface-2 disabled:text-faint"
            >
              Group these {selected.length}/4
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
