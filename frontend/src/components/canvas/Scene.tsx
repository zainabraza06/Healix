'use client';

import { Canvas } from '@react-three/fiber';
import { Preload } from '@react-three/drei';

interface SceneProps {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

export default function Scene({ children, className, ...props }: SceneProps) {
  return (
    <Canvas
      className={className}
      {...props}
      camera={{ position: [0, 0, 5], fov: 45 }}
      dpr={[1, 2]} // Optimize pixel ratio
    >
      {children}
      <Preload all />
    </Canvas>
  );
}
