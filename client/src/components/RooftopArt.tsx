import { useEffect, useRef } from 'react';
import { drawRooftops } from '../game/art';

export function RooftopArt() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const context = ref.current?.getContext('2d');
    if (context) drawRooftops(context);
  }, []);
  return <canvas ref={ref} width={1440} height={690} className="rooftop-art" aria-hidden="true" />;
}
