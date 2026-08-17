'use client';

import { useState } from 'react';
import PuzzlesHome from '@/components/v1/PuzzlesHome';
import SplashScreen from '@/components/v1/SplashScreen';

/**
 * v1 entry — the prototype flow: the splash screen animates through its four
 * loading-dot frames, then advances to the Puzzles home screen.
 *
 * Lives at /v1 for now so it doesn't disturb the working v0 app; it becomes the
 * default entry once v1 is fleshed out.
 */
export default function V1() {
  const [started, setStarted] = useState(false);
  return started ? <PuzzlesHome /> : <SplashScreen onDone={() => setStarted(true)} />;
}
