/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Canvas } from '@react-three/fiber';
import Scene from './components/Scene';
import Dashboard from './components/Dashboard';

export default function App() {
  return (
    <div className="w-full h-screen overflow-y-auto overflow-x-hidden relative bg-black text-white">
      {/* 3D Background */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <Canvas>
          <Scene />
        </Canvas>
      </div>

      {/* Main UI Overlay */}
      <Dashboard />
    </div>
  );
}

