'use client';

import type { RendererProps } from '@/lib/mechanics/types';
import MultipleChoice from './MultipleChoice';
import ZipBoard from './ZipBoard';

/**
 * Renderers are bound to mechanic ids here, separately from the Mechanic
 * interface (§8) — that keeps `lib/mechanics/*` free of React so generators and
 * graders stay runnable server-side and in tests.
 *
 * This is a switch rather than an id→component map so the element type is
 * statically known at each branch: a dynamic `<Component />` looked up during
 * render remounts (and so resets puzzle state) whenever the lookup identity
 * changes.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRendererProps = RendererProps<any, any>;

/** Mechanic ids that have a renderer wired up. */
export const RENDERED_MECHANICS = ['zip', 'spot-the-fallacy', 'context-cloze'] as const;

export function hasRenderer(mechanicId: string): boolean {
  return (RENDERED_MECHANICS as readonly string[]).includes(mechanicId);
}

export default function MechanicRenderer(props: AnyRendererProps) {
  switch (props.instance.mechanicId) {
    case 'zip':
      return <ZipBoard {...props} />;
    // One MultipleChoice serves every option-picking LLM mechanic (§9.5).
    case 'spot-the-fallacy':
    case 'context-cloze':
      return <MultipleChoice {...props} />;
    default:
      return (
        <p className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          No renderer registered for mechanic <code>{props.instance.mechanicId}</code>.
        </p>
      );
  }
}
