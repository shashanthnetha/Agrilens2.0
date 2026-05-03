import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { Instances, Instance, Environment } from '@react-three/drei';

function Rain() {
  const count = 3000;
  const mesh = useRef<THREE.InstancedMesh>(null);
  
  const particles = useMemo(() => {
    const temp = [];
    for (let i = 0; i < count; i++) {
        const x = (Math.random() - 0.5) * 40;
        const y = Math.random() * 40;
        const z = (Math.random() - 0.5) * 40;
        const speed = 0.5 + Math.random() * 0.5;
        temp.push({ x, y, z, speed });
    }
    return temp;
  }, [count]);

  const dummy = new THREE.Object3D();

  useFrame(() => {
    if (!mesh.current) return;
    particles.forEach((p, i) => {
      p.y -= p.speed;
      if (p.y < -10) p.y = 30; // reset height
      dummy.position.set(p.x, p.y, p.z);
      // Stretch it slightly to look like falling rain
      dummy.scale.set(0.1, 4, 0.1); 
      dummy.updateMatrix();
      mesh.current!.setMatrixAt(i, dummy.matrix);
    });
    mesh.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={mesh} args={[null, null, count]}>
      <boxGeometry args={[0.02, 0.2, 0.02]} />
      <meshBasicMaterial color="#ffffff" transparent opacity={0.3} />
    </instancedMesh>
  );
}

function City() {
  // Creating a sprawling abstract city with tall buildings and neon accents
  return (
    <group>
        <Instances limit={100} castShadow receiveShadow position={[0, -10, 0]}>
            <boxGeometry args={[1, 1, 1]} />
            <meshStandardMaterial color="#050505" roughness={0.2} metalness={0.9} />
            {Array.from({ length: 100 }).map((_, i) => {
                const x = (Math.random() - 0.5) * 60;
                const z = (Math.random() - 0.5) * 60;
                const scaleY = 10 + Math.random() * 40;
                
                // create a glowing window effect randomly
                const isNeon = Math.random() > 0.8;
                return (
                    <Instance 
                        key={i} 
                        position={[x, scaleY / 2, z]} 
                        scale={[2 + Math.random()*2, scaleY, 2 + Math.random()*2]} 
                        color={isNeon ? (Math.random() > 0.5 ? '#D4AF37' : '#FBBF24') : '#0a0a0a'}
                    />
                );
            })}
        </Instances>
    </group>
  );
}

function Webs() {
    // some curved neon web lines swinging across buildings
    const count = 10;
    const lines = useMemo(() => {
        return Array.from({length: count}).map(() => {
            const start = new THREE.Vector3((Math.random() -0.5)*30, Math.random()*20, (Math.random()-0.5)*30);
            const end = new THREE.Vector3((Math.random() -0.5)*30, Math.random()*20, (Math.random()-0.5)*30);
            const middle = new THREE.Vector3().copy(start).lerp(end, 0.5);
            middle.y -= 5 + Math.random() * 5; // droop
            const curve = new THREE.QuadraticBezierCurve3(start, middle, end);
            return curve.getPoints(50);
        });
    }, [count]);

    return (
        <group>
            {lines.map((points, i) => {
                const geometry = new THREE.BufferGeometry().setFromPoints(points);
                const material = new THREE.LineBasicMaterial({ color: 0xD4AF37, transparent: true, opacity: 0.3 });
                return (
                    <primitive key={i} object={new THREE.Line(geometry, material)} />
                );
            })}
        </group>
    );
}

export default function Scene() {
  return (
    <>
      <color attach="background" args={['#020202']} />
      <fog attach="fog" args={['#020202', 10, 50]} />
      
      <ambientLight intensity={0.1} />
      <spotLight position={[0, 40, 0]} angle={0.4} penumbra={1} intensity={2} color="#D4AF37" castShadow />
      <pointLight position={[-10, 10, -10]} intensity={1.5} color="#B45309" />
      <pointLight position={[10, 10, 10]} intensity={2} color="#FBBF24" />
      
      <City />
      <Rain />
      <Webs />
      
      {/* Adds reflections to the metallic materials */}
      <Environment preset="night" />
    </>
  );
}
