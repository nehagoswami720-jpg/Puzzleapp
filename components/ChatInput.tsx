'use client';

import { useState } from 'react';

/** §12.1 — the three seeded prompts, so a first-time user never faces a blank box. */
const EXAMPLES = ['critical thinking', 'vocabulary', 'mental math'];

interface ChatInputProps {
  onSubmit(prompt: string): void;
  busy: boolean;
  /** shown as the field value when re-asking after a clarifying question */
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
        className="flex flex-col gap-2"
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
          className="min-h-13 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-[16px] text-slate-900 shadow-sm outline-none placeholder:text-slate-400 focus:border-indigo-500 disabled:opacity-60"
        />
        <button
          type="submit"
          disabled={busy || trimmed.length < 2}
          className="min-h-13 rounded-2xl bg-indigo-600 px-4 text-[15px] font-semibold text-white disabled:opacity-40"
        >
          {busy ? 'Building your set…' : 'Make me some puzzles'}
        </button>
      </form>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-slate-400">Try:</span>
        {EXAMPLES.map((ex) => (
          <button
            key={ex}
            type="button"
            disabled={busy}
            onClick={() => {
              setValue(ex);
              submit(ex);
            }}
            className="min-h-9 rounded-full border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-600 disabled:opacity-40"
          >
            {ex}
          </button>
        ))}
      </div>
    </div>
  );
}
