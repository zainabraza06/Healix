'use client';

import { Float, MeshDistortMaterial, MeshWobbleMaterial } from '@react-three/drei';

function PlusShape(props: any) {
    return (
        <group {...props}>
            <mesh position={[0, 0, 0]}>
                <boxGeometry args={[1, 3, 0.5]} />
                <meshStandardMaterial color="#10b981" roughness={0.3} metalness={0.1} />
            </mesh>
            <mesh position={[0, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
                <boxGeometry args={[1, 3, 0.5]} />
                <meshStandardMaterial color="#10b981" roughness={0.3} metalness={0.1} />
            </mesh>
        </group>
    );
}

function PillShape(props: any) {
    return (
        <group {...props}>
            <mesh>
                <capsuleGeometry args={[0.6, 2, 4, 8]} />
                <MeshWobbleMaterial factor={0.6} speed={2} color="#f472b6" roughness={0.1} opacity={0.9} transparent />
            </mesh>
        </group>
    );
}

function SphereShape(props: any) {
    return (
        <mesh {...props}>
            <sphereGeometry args={[0.8, 32, 32]} />
            <MeshDistortMaterial color="#0ea5e9" speed={2} distort={0.4} radius={1} />
        </mesh>
    )
}

export default function FloatingIcons() {
    return (
        <group>
            <ambientLight intensity={0.5} />
            <directionalLight position={[10, 10, 5]} intensity={1} />
            <pointLight position={[-10, -10, -10]} intensity={1} color="#10b981" />

            {/* Floating Plus */}
            <Float speed={2} rotationIntensity={1.5} floatIntensity={2}>
                <PlusShape position={[-3, 2, -5]} rotation={[0.5, 0.5, 0]} scale={0.4} />
            </Float>

            {/* Floating Pill */}
            <Float speed={1.5} rotationIntensity={2} floatIntensity={1.5}>
                <PillShape position={[4, -1, -3]} rotation={[1, 0, -0.5]} scale={0.3} />
            </Float>

            {/* Floating Sphere */}
            <Float speed={3} rotationIntensity={1} floatIntensity={3}>
                <SphereShape position={[-4, -3, -6]} />
            </Float>

            {/* Background Particles/Dots */}
            {Array.from({ length: 20 }).map((_, i) => (
                <Float key={i} speed={Math.random() * 2} rotationIntensity={Math.random() * 2} floatIntensity={Math.random() * 4}>
                    <mesh position={[
                        (Math.random() - 0.5) * 20,
                        (Math.random() - 0.5) * 20,
                        -10 - Math.random() * 10
                    ]}>
                        <sphereGeometry args={[0.1, 8, 8]} />
                        <meshStandardMaterial color="#34d399" opacity={0.6} transparent />
                    </mesh>
                </Float>
            ))}
        </group>
    );
}
