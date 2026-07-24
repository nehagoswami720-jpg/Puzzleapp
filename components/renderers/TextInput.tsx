'use client';

import { useState } from 'react';
import type { TextInputAnswer, TextInputContent } from '@/lib/mechanics/textInput';
import type { RendererProps } from '@/lib/mechanics/types';

/**
 * Single-answer input: a prominent display (scrambled letters, an expression, a
 * target) above one text/number field. Serves anagram, mental math and
 * make-the-target. The answer becomes submittable once the field is non-empty.
 */
export default function TextInput({
  instance,
  onAnswerChange,
  locked,
}: RendererProps<TextInputContent, TextInputAnswer>) {
  const { display, placeholder, numeric } = instance.content;
  const [value, setValue] = useState('');

  const update = (raw: string) => {
    setValue(raw);
    onAnswerChange(raw.trim() ? raw.trim() : null);
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="grid min-h-24 place-items-center rounded-2xl border border-line bg-surface-2 p-4">
        <span className="text-center font-mono text-2xl font-bold tracking-wide text-ink">
          {display}
        </span>
      </div>
      <input
        type="text"
        inputMode={numeric ? 'numeric' : 'text'}
        autoComplete="off"
        autoCapitalize="off"
        spellCheck={false}
        disabled={locked}
        value={value}
        onChange={(e) => update(e.target.value)}
        placeholder={placeholder}
        className="ring-accent min-h-14 rounded-xl border border-line bg-surface px-4 text-center text-[17px] text-ink outline-none placeholder:text-faint focus:border-lime disabled:opacity-70"
      />
    </div>
  );
}
