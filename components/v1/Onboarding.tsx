'use client';

import { useState } from 'react';

/**
 * v1 Onboarding — faithful build of the Figma "Onboarding" frame (97:144) and
 * its "Skill component" (97:179), which has two variants:
 *   • Default   (97:178) — transparent, purple border #a57eff, "+" icon,
 *                          purple label (Outfit Regular)
 *   • Variant2  (97:180) — gradient #430cc1 → #9266f4, check icon, white label
 *                          (Outfit Medium)
 * The prototype wires a chip's tap to CHANGE_TO its selected variant, so these
 * are multi-select toggles.
 *
 * The frame ships one chip ("Critical thinking"); per the brief we add more
 * skills using the same component. Chips hug their labels (the component's
 * fixed w-[112px] label was sized for "Critical thinking" and would leave big
 * gaps on shorter names), and wrap into a cloud.
 *
 * NOTE: the "Continue" button is NOT in the Figma yet — the frame has no way to
 * advance to home. It's added here (app lime accent) so the loading → onboarding
 * → home flow works; swap it for the designed version when ready.
 */

// Skills offered on first run. "Critical thinking" is the one already in Figma.
const SKILLS = [
  'Critical thinking',
  'Logical reasoning',
  'Pattern recognition',
  'Memory',
  'Focus',
  'Problem solving',
  'Spatial reasoning',
  'Vocabulary',
  'Mental math',
  'Lateral thinking',
  'Attention to detail',
  'Decision making',
];

function PlusIcon() {
  return (
    <svg width={12} height={12} viewBox="0 0 12 12" fill="none" className="shrink-0" aria-hidden="true">
      <path
        d="M11.25 5.25H6.75V0.75C6.75 0.551088 6.67098 0.360322 6.53033 0.21967C6.38968 0.0790178 6.19891 0 6 0C5.80109 0 5.61032 0.0790178 5.46967 0.21967C5.32902 0.360322 5.25 0.551088 5.25 0.75V5.25H0.75C0.551088 5.25 0.360322 5.32902 0.21967 5.46967C0.0790178 5.61032 0 5.80109 0 6C0 6.19891 0.0790178 6.38968 0.21967 6.53033C0.360322 6.67098 0.551088 6.75 0.75 6.75H5.25V11.25C5.25 11.4489 5.32902 11.6397 5.46967 11.7803C5.61032 11.921 5.80109 12 6 12C6.19891 12 6.38968 11.921 6.53033 11.7803C6.67098 11.6397 6.75 11.4489 6.75 11.25V6.75H11.25C11.4489 6.75 11.6397 6.67098 11.7803 6.53033C11.921 6.38968 12 6.19891 12 6C12 5.80109 11.921 5.61032 11.7803 5.46967C11.6397 5.32902 11.4489 5.25 11.25 5.25Z"
        fill="currentColor"
      />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg
      width={14.0539}
      height={10.2216}
      viewBox="0 0 14.0539 10.2216"
      fill="none"
      className="shrink-0"
      aria-hidden="true"
    >
      <path
        d="M13.7319 0.295798C13.639 0.20207 13.5284 0.127675 13.4065 0.0769067C13.2846 0.026138 13.1539 0 13.0219 0C12.8899 0 12.7592 0.026138 12.6373 0.0769067C12.5155 0.127675 12.4049 0.20207 12.3119 0.295798L4.86192 7.7558L1.73192 4.6158C1.6354 4.52256 1.52146 4.44925 1.3966 4.40004C1.27175 4.35084 1.13843 4.32671 1.00424 4.32903C0.870064 4.33135 0.737655 4.36008 0.614576 4.41357C0.491498 4.46706 0.380161 4.54428 0.286922 4.6408C0.193684 4.73732 0.12037 4.85126 0.0711659 4.97612C0.0219619 5.10097 -0.00216855 5.2343 0.000152918 5.36848C0.00247438 5.50266 0.0312022 5.63507 0.0846957 5.75814C0.138189 5.88122 0.215401 5.99256 0.311922 6.0858L4.15192 9.9258C4.24489 10.0195 4.35549 10.0939 4.47735 10.1447C4.59921 10.1955 4.72991 10.2216 4.86192 10.2216C4.99393 10.2216 5.12464 10.1955 5.2465 10.1447C5.36836 10.0939 5.47896 10.0195 5.57192 9.9258L13.7319 1.7658C13.8334 1.67216 13.9144 1.5585 13.9698 1.432C14.0252 1.30551 14.0539 1.1689 14.0539 1.0308C14.0539 0.892697 14.0252 0.756092 13.9698 0.629592C13.9144 0.503092 13.8334 0.389441 13.7319 0.295798V0.295798Z"
        fill="currentColor"
      />
    </svg>
  );
}

function SkillChip({
  label,
  selected,
  onToggle,
}: {
  label: string;
  selected: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={selected}
      className={`flex items-center justify-center gap-[8px] rounded-[38px] border p-[12px] transition-colors duration-200 ${
        selected
          ? 'border-transparent bg-gradient-to-r from-[#430cc1] to-[#9266f4] text-[#eceef2]'
          : 'border-[#a57eff] bg-transparent text-[#a57eff]'
      }`}
    >
      {selected ? <CheckIcon /> : <PlusIcon />}
      <span className={`text-[16px] whitespace-nowrap ${selected ? 'font-medium' : 'font-normal'}`}>
        {label}
      </span>
    </button>
  );
}

export default function Onboarding({ onContinue }: { onContinue: () => void }) {
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const toggle = (skill: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(skill)) next.delete(skill);
      else next.add(skill);
      return next;
    });
  };

  const hasSelection = selected.size > 0;

  return (
    <div className="fixed inset-0 bg-black font-outfit">
      {/* Container (Figma left 24, top 51, w 354), flex-col gap-24 */}
      <div className="absolute top-[51px] left-[24px] flex w-[354px] flex-col gap-[24px]">
        {/* header group + subtitle, gap-48 */}
        <div className="flex flex-col gap-[48px]">
          <div className="flex flex-col gap-[8px]">
            <p className="text-[20px] text-[#959595]">Hey there,</p>
            <p className="text-[32px] leading-[34px] font-bold tracking-[-0.96px] text-[#eceef2]">
              What are some <span className="text-[#9df800]">skills</span> you would like to improve?
            </p>
          </div>
          <p className="text-[20px] text-[#959595]">Select one or more skills</p>
        </div>

        {/* skill chips — multi-select, wrap into a cloud */}
        <div className="flex flex-wrap gap-[12px]">
          {SKILLS.map((skill) => (
            <SkillChip
              key={skill}
              label={skill}
              selected={selected.has(skill)}
              onToggle={() => toggle(skill)}
            />
          ))}
        </div>
      </div>

      {/* Continue — NOT in Figma; added so the flow can reach home. */}
      <button
        type="button"
        onClick={onContinue}
        disabled={!hasSelection}
        className={`absolute inset-x-[24px] bottom-[53px] rounded-[38px] bg-[#9df800] py-[16px] text-center text-[16px] font-medium text-black transition-opacity duration-200 ${
          hasSelection ? 'opacity-100' : 'pointer-events-none opacity-40'
        }`}
      >
        Continue
      </button>
    </div>
  );
}
