'use client';

import { useState } from 'react';
import Onboarding from '@/components/v1/Onboarding';
import PuzzlesHome from '@/components/v1/PuzzlesHome';
import SplashScreen from '@/components/v1/SplashScreen';

/**
 * v1 entry — the prototype flow: splash (loading) → onboarding (pick skills) →
 * Puzzles home. The onboarding's selected skills will later seed the home
 * screen's puzzles; for now advancing just moves to home.
 *
 * Lives at /v1 for now so it doesn't disturb the working v0 app; it becomes the
 * default entry once v1 is fleshed out.
 */
type Step = 'splash' | 'onboarding' | 'home';

export default function V1() {
  const [step, setStep] = useState<Step>('splash');

  if (step === 'splash') return <SplashScreen onDone={() => setStep('onboarding')} />;
  if (step === 'onboarding') return <Onboarding onContinue={() => setStep('home')} />;
  return <PuzzlesHome />;
}
