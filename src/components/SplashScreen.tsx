import { useEffect, useState, useTransition } from 'react';
import { TradexaSymbol } from './TradexaLogo';

interface SplashScreenProps {
  onComplete?: () => void;
  isAppReady?: boolean;
}

export default function SplashScreen({ onComplete, isAppReady = true }: SplashScreenProps) {
  // Check if splash was already shown during this session or if reduced motion is requested
  const [shouldRender, setShouldRender] = useState(() => {
    if (typeof window === 'undefined') return true;
    try {
      const alreadyShown = sessionStorage.getItem('tradexa_splash_completed');
      if (alreadyShown === 'true') return false;
      const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (prefersReduced) {
        sessionStorage.setItem('tradexa_splash_completed', 'true');
        return false;
      }
    } catch {
      // ignore storage errors in restricted mode
    }
    return true;
  });

  const [phase, setPhase] = useState<'logo' | 'brand' | 'exit' | 'done'>('logo');
  const [, startTransition] = useTransition();

  useEffect(() => {
    if (!shouldRender) {
      onComplete?.();
      return;
    }

    // Sequence timeline:
    // 0ms: Phase 1 & 2 - Logo reveal & scale
    // 450ms: Phase 3 - Brand reveal ("TRADEXA" + Tagline)
    // 1250ms - 1500ms: Phase 4 - Smooth Dashboard Crossfade once app is ready
    const brandTimer = setTimeout(() => {
      startTransition(() => setPhase('brand'));
    }, 450);

    const exitTimer = setTimeout(() => {
      startTransition(() => setPhase('exit'));
    }, Math.max(1200, isAppReady ? 1200 : 1600));

    const completeTimer = setTimeout(() => {
      try {
        sessionStorage.setItem('tradexa_splash_completed', 'true');
      } catch {
        // ignore storage errors
      }
      setShouldRender(false);
      setPhase('done');
      onComplete?.();
    }, 1650);

    return () => {
      clearTimeout(brandTimer);
      clearTimeout(exitTimer);
      clearTimeout(completeTimer);
    };
  }, [shouldRender, isAppReady, onComplete]);

  if (!shouldRender || phase === 'done') return null;

  return (
    <div
      aria-label="Tradexa Startup Screen"
      aria-hidden={phase === 'exit'}
      className={`fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-[#070B14] select-none transition-opacity duration-500 ease-out ${
        phase === 'exit' ? 'opacity-0 pointer-events-none' : 'opacity-100'
      }`}
      style={{
        background: 'radial-gradient(ellipse 90% 80% at 50% 45%, #0B1322 0%, #060912 60%, #030509 100%)',
      }}
    >
      {/* Background Ambient Mesh Lights */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[340px] sm:w-[500px] h-[340px] sm:h-[500px] rounded-full bg-cyan-500/10 blur-[90px] animate-pulse" />
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[220px] h-[220px] rounded-full bg-blue-600/15 blur-[70px]" />
      </div>

      {/* Main Content Group */}
      <div className="relative z-10 flex flex-col items-center">
        {/* Phase 2: Logo with smooth scale, glow, and trend animation */}
        <div
          className={`relative flex items-center justify-center transition-all duration-700 ease-out ${
            phase === 'logo'
              ? 'scale-90 opacity-80'
              : 'scale-100 opacity-100 drop-shadow-[0_0_35px_rgba(0,240,255,0.45)]'
          }`}
        >
          {/* Pulsing ring aura */}
          <div className="absolute -inset-3 rounded-[32px] bg-gradient-to-tr from-cyan-500/20 to-blue-600/10 blur-md animate-pulse" />
          
          <TradexaSymbol
            size={84}
            framed={true}
            idPrefix="splash"
            className="relative transform-gpu"
          />
        </div>

        {/* Phase 3: Brand Reveal */}
        <div
          className={`mt-6 flex flex-col items-center transition-all duration-700 ease-out transform-gpu ${
            phase === 'logo'
              ? 'opacity-0 translate-y-3'
              : 'opacity-100 translate-y-0'
          }`}
        >
          <div className="flex items-center gap-2">
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-[0.3em] uppercase text-transparent bg-clip-text bg-gradient-to-r from-white via-slate-100 to-cyan-300 font-sans">
              TRADEXA
            </h1>
          </div>

          <p className="mt-2 text-xs sm:text-sm font-medium tracking-widest uppercase text-cyan-400/80">
            Trade Smarter. Stay Ahead.
          </p>
        </div>

        {/* Telemetry Startup Indicator */}
        <div
          className={`mt-10 flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-cyan-500/20 bg-cyan-950/30 backdrop-blur-md transition-all duration-700 ease-out ${
            phase === 'logo' ? 'opacity-0 scale-95' : 'opacity-100 scale-100'
          }`}
        >
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-400" />
          </span>
          <span className="font-mono text-[10px] font-semibold tracking-wider text-slate-300 uppercase">
            Live Market Telemetry Active
          </span>
        </div>
      </div>

      {/* Bottom Legal / Version Info */}
      <div className="absolute bottom-6 left-0 right-0 text-center text-[10px] font-mono tracking-widest uppercase text-slate-500/80">
        Global Markets Command Center · v1.0
      </div>
    </div>
  );
}
