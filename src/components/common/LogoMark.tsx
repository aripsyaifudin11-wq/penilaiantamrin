import { useState } from 'react';
import { BookOpen } from 'lucide-react';

interface LogoMarkProps {
  src?: string;
  alt: string;
  sizeClass?: string;
  framed?: boolean;
}

export function LogoMark({ src, alt, sizeClass = 'w-14 h-14', framed = false }: LogoMarkProps) {
  const [failed, setFailed] = useState(false);

  const frameClass = framed
    ? 'rounded-2xl bg-white ring-2 ring-[#D4AF37]/55 shadow-sm'
    : 'rounded-xl bg-white border border-slate-200/90';

  if (!src || failed) {
    return (
      <div
        aria-label={alt}
        className={`${sizeClass} ${frameClass} flex items-center justify-center text-emerald-700 shrink-0`}
      >
        <BookOpen className="w-1/2 h-1/2" />
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className={`${sizeClass} ${frameClass} object-contain p-1 shrink-0`}
    />
  );
}
