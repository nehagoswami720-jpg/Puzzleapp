'use client';

import { useEffect, useState } from 'react';

/**
 * v1 splash — exact reproduction of the Figma frames "splash screen #1–#4":
 * black full-bleed, a 150×150 animated arcade-cabinet, and "Loading" in
 * Press Start 2P with the dots cycling every 0.5s (the four prototype frames).
 * After one full cycle (~2s) it advances to the home screen.
 */
const STEP_MS = 500;
const FRAMES = 4;

export default function SplashScreen({ onDone }: { onDone: () => void }) {
  const [dots, setDots] = useState(0);

  useEffect(() => {
    const tick = setInterval(() => setDots((d) => (d + 1) % FRAMES), STEP_MS);
    const done = setTimeout(onDone, STEP_MS * FRAMES);
    return () => {
      clearInterval(tick);
      clearTimeout(done);
    };
  }, [onDone]);

  return (
    <div className="fixed inset-0 grid place-items-center bg-black">
      <div className="flex w-[150px] flex-col items-center gap-[32px]">
        {/* eslint-disable-next-line @next/next/no-img-element -- animated GIF; next/image would freeze it */}
        <img
          src="/v1/arcade-cabinet.gif"
          alt="Retro arcade cabinet"
          width={150}
          height={150}
          className="size-[150px] object-cover"
        />
        <p className="font-press text-center text-[16px] tracking-[0.64px] text-white">
          Loading{'.'.repeat(dots)}
        </p>
      </div>
    </div>
  );
}
