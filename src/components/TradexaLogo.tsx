import { memo } from 'react';

export interface TradexaLogoProps {
  variant?: 'symbol' | 'framed' | 'wordmark' | 'full';
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | number;
  animated?: boolean;
  subtitle?: string;
  className?: string;
  idPrefix?: string;
}

const SIZE_MAP = {
  xs: 18,
  sm: 26,
  md: 34,
  lg: 46,
  xl: 64,
};

export const TradexaSymbol = memo(function TradexaSymbol({
  size = 32,
  animated = false,
  framed = true,
  className = '',
}: {
  size?: number;
  animated?: boolean;
  framed?: boolean;
  idPrefix?: string;
  className?: string;
}) {
  const iconSrc =
    size >= 256
      ? '/icons/tradexa-512.png'
      : size >= 48
      ? '/icons/tradexa-192.png'
      : size >= 32
      ? '/icons/tradexa-64.png'
      : '/icons/tradexa-32.png';

  const borderRadius = Math.max(4, Math.round(size * 0.22));

  return (
    <div
      style={{ width: size, height: size }}
      className={`relative inline-flex items-center justify-center shrink-0 select-none ${
        animated ? 'animate-pulse' : ''
      } ${className}`}
    >
      <img
        src={iconSrc}
        alt="Tradexa Logo"
        width={size}
        height={size}
        style={{
          borderRadius: framed ? `${borderRadius}px` : `${Math.round(borderRadius * 0.8)}px`,
        }}
        className="h-full w-full object-contain drop-shadow-[0_2px_12px_rgba(0,240,255,0.3)] transition-transform duration-200"
        loading="eager"
        decoding="async"
      />
    </div>
  );
});

export const TradexaLogo = memo(function TradexaLogo({
  variant = 'full',
  size = 'md',
  animated = false,
  subtitle,
  className = '',
  idPrefix = 'tx',
}: TradexaLogoProps) {
  const pixelSize = typeof size === 'number' ? size : SIZE_MAP[size] ?? 34;

  if (variant === 'symbol') {
    return (
      <TradexaSymbol
        size={pixelSize}
        animated={animated}
        framed={false}
        idPrefix={idPrefix}
        className={className}
      />
    );
  }

  if (variant === 'framed') {
    return (
      <TradexaSymbol
        size={pixelSize}
        animated={animated}
        framed={true}
        idPrefix={idPrefix}
        className={className}
      />
    );
  }

  if (variant === 'wordmark') {
    return (
      <div className={`inline-flex flex-col select-none ${className}`}>
        <span className="font-extrabold tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-white via-slate-100 to-cyan-200">
          TRADEXA
        </span>
        {subtitle && (
          <span className="text-[9px] font-semibold tracking-[0.2em] uppercase text-cyan-400/90 -mt-0.5">
            {subtitle}
          </span>
        )}
      </div>
    );
  }

  // Full: Symbol + Wordmark
  return (
    <div className={`inline-flex items-center gap-2.5 select-none ${className}`}>
      <TradexaSymbol
        size={pixelSize}
        animated={animated}
        framed={true}
        idPrefix={idPrefix}
      />
      <div className="flex flex-col leading-none">
        <div className="flex items-center gap-1.5">
          <span className="font-extrabold tracking-tight text-[var(--text-primary)] text-sm sm:text-base font-sans">
            TRADEXA
          </span>
          <span className="hidden sm:inline-block h-1.5 w-1.5 rounded-full bg-cyan-400 animate-pulse" />
        </div>
        <span className="hidden sm:block text-[9.5px] font-medium tracking-wider text-[var(--text-muted)] uppercase mt-0.5">
          {subtitle || 'Market Intelligence'}
        </span>
      </div>
    </div>
  );
});

export default TradexaLogo;
