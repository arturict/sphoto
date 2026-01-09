"use client"

import { motion } from "framer-motion"
import { ImmichSidebar } from "./immich-sidebar"
import { ImmichTopBar } from "./immich-topbar"

// Generate deterministic colors based on seed for consistent "photos"
function getPhotoGradient(seed: number): string {
  const gradients = [
    'from-blue-600/40 to-purple-600/40',    // Sunset sky
    'from-green-600/40 to-teal-600/40',     // Nature
    'from-orange-500/40 to-red-500/40',     // Warm sunset
    'from-cyan-500/40 to-blue-500/40',      // Ocean
    'from-pink-500/40 to-rose-500/40',      // Flowers
    'from-amber-500/40 to-yellow-500/40',   // Golden hour
    'from-indigo-500/40 to-violet-500/40',  // Twilight
    'from-emerald-500/40 to-green-500/40',  // Forest
    'from-sky-500/40 to-cyan-500/40',       // Clear sky
    'from-fuchsia-500/40 to-pink-500/40',   // Vibrant
  ]
  return gradients[seed % gradients.length]
}

// Simulated photo placeholder component
function PhotoPlaceholder({ seed, className = "" }: { seed: number; className?: string }) {
  const gradient = getPhotoGradient(seed)
  return (
    <div className={`bg-gradient-to-br ${gradient} ${className}`}>
      {/* Subtle noise texture overlay */}
      <div className="absolute inset-0 opacity-30 bg-[radial-gradient(circle_at_50%_50%,rgba(255,255,255,0.1),transparent_70%)]" />
    </div>
  )
}

export function HeroImage() {
  // Generate random data for the dense grid
  const gridRows = [
    { label: "Today", count: 9 },
    { label: "Yesterday", count: 18 },
    { label: "Wednesday", count: 18 },
  ]

  return (
    <div className="relative w-full max-w-[1200px] mx-auto mt-8 lg:mt-12 perspective-[2000px]">
      {/* Abstract Browser Interface */}
      <motion.div
        initial={{ opacity: 0, rotateX: 10, y: 40 }}
        animate={{ opacity: 1, rotateX: 0, y: 0 }}
        transition={{ duration: 1.2, ease: "easeOut" }}
        className="relative rounded-2xl border border-white/10 bg-black shadow-2xl overflow-hidden ring-1 ring-white/10 flex h-[600px]"
      >
        <ImmichSidebar />

        <div className="flex-1 flex flex-col overflow-hidden">
          <ImmichTopBar />

          {/* Main Gallery Scroll Area */}
          <div className="flex-1 overflow-y-auto bg-black p-6 custom-scrollbar">
            {/* Memory Section (Top Horizontal Cards) */}
            <div className="flex gap-4 mb-10 overflow-x-hidden">
              {[1, 2, 3].map((i) => (
                <div key={i} className="min-w-[280px] h-44 rounded-xl relative overflow-hidden group cursor-pointer border border-white/5">
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent z-10" />
                  {/* CSS-based photo placeholder */}
                  <PhotoPlaceholder 
                    seed={i * 123} 
                    className="absolute inset-0 w-full h-full group-hover:scale-105 transition-transform duration-500"
                  />
                  <div className="absolute bottom-4 left-4 z-20">
                    <div className="text-[10px] text-white/60 font-medium">{i} year{i > 1 ? 's' : ''} ago</div>
                    <div className="text-sm text-white font-bold">Memory from {2025 - i}</div>
                  </div>
                </div>
              ))}
            </div>

            {/* Photo Grid Sections */}
            {gridRows.map((row, rowIndex) => (
              <div key={rowIndex} className="mb-8">
                <div className="flex items-center gap-4 mb-4">
                  <span className="text-white font-bold text-sm">{row.label}</span>
                  <div className="h-px flex-1 bg-white/5" />
                </div>
                <div className="grid grid-cols-3 md:grid-cols-6 lg:grid-cols-9 gap-1.5">
                  {Array.from({ length: row.count }).map((_, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: 0.2 + (i * 0.05), duration: 0.4 }}
                      className="aspect-square rounded-[2px] overflow-hidden relative group cursor-pointer"
                    >
                      <PhotoPlaceholder 
                        seed={(rowIndex * 50) + i} 
                        className="w-full h-full group-hover:scale-110 transition-transform duration-300"
                      />
                      <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </motion.div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Floating Timeline Indicator */}
          <div className="absolute right-4 top-1/2 -translate-y-1/2 flex flex-col gap-3 items-center z-30">
            {[2025, 2024, 2023, 2022, 2021].map(year => (
              <div key={year} className="group relative flex items-center justify-end w-12 cursor-pointer">
                <span className="text-[9px] text-white/20 group-hover:text-white/80 transition-colors absolute right-4 whitespace-nowrap">{year}</span>
                <div className="w-1 h-1 rounded-full bg-white/20 group-hover:bg-blue-500 transition-colors" />
              </div>
            ))}
          </div>
        </div>
      </motion.div>

      {/* Glow effect behind */}
      <div className="absolute inset-0 -z-10 bg-blue-600/10 blur-[100px] rounded-full opacity-50 translate-y-20 scale-90" />

      <style jsx>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.1);
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(255, 255, 255, 0.2);
        }
      `}</style>
    </div>
  )
}
