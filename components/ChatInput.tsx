'use client';

import { useState } from 'react';

/** §12.1 — the three seeded prompts, so a first-time user never faces a blank box. */
const EXAMPLES = ['critical thinking', 'vocabulary', 'mental math'];

interface ChatInputProps {
  onSubmit(prompt: string): void;
  busy: boolean;
  initialValue?: string;
  placeholder?: string;
}

export default function ChatInput({
  onSubmit,
  busy,
  initialValue = '',
  placeholder = 'e.g. I want to improve my critical thinking',
}: ChatInputProps) {
  const [value, setValue] = useState(initialValue);
  const trimmed = value.trim();

  const submit = (text: string) => {
    const t = text.trim();
    if (t.length < 2 || busy) return;
    onSubmit(t);
  };

  return (
    <div className="flex flex-col gap-3">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit(value);
        }}
        className="flex flex-col gap-2.5"
      >
        <label htmlFor="skill" className="sr-only">
          What skill do you want to improve?
        </label>
        <input
          id="skill"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={placeholder}
          maxLength={300}
          autoComplete="off"
          disabled={busy}
          className="ring-accent min-h-14 rounded-2xl border border-line bg-surface-2 px-4 py-3 text-[16px] text-ink outline-none placeholder:text-faint focus:border-line-strong disabled:opacity-60"
        />
        <button
          type="submit"
          disabled={busy || trimmed.length < 2}
          className="min-h-14 rounded-2xl bg-lime px-4 font-display text-[15px] font-semibold tracking-tight text-canvas transition active:scale-[0.99] disabled:bg-surface-2 disabled:text-faint"
        >
          {busy ? 'Building your set…' : 'Make me some puzzles'}
        </button>
      </form>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-faint">Try</span>
        {EXAMPLES.map((ex) => (
          <button
            key={ex}
            type="button"
            disabled={busy}
            onClick={() => {
              setValue(ex);
              submit(ex);
            }}
            className="min-h-9 rounded-full border border-line bg-surface px-3 text-xs font-semibold text-muted transition hover:border-lime/50 hover:text-ink disabled:opacity-40"
          >
            {ex}
          </button>
        ))}
      </div>
    </div>
  );
}
