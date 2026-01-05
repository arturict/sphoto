"use client"

import { motion } from "framer-motion"
import { ImmichSidebar } from "./immich-sidebar"
import { ImmichTopBar } from "./immich-topbar"

export function HeroImage() {
  // Generate random data for the dense grid
  const gridRows = [
    { label: "Today", count: 8 },
    { label: "Yesterday", count: 12 },
    { label: "Wednesday", count: 18 },
  ]

  return (
    <div className="relative w-full max-w-[1200px] mx-auto mt-16 lg:mt-24 perspective-[2000px]">
      {/* Abstract Browser Interface */}
      <motion.div
        initial={{ opacity: 0, rotateX: 20, y: 100 }}
        animate={{ opacity: 1, rotateX: 0, y: 0 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
        className="relative rounded-2xl border border-white/10 bg-black shadow-2xl overflow-hidden ring-1 ring-white/10 flex h-[700px]"
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
                  <div className={`absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent z-10`} />
                  <div className={`absolute inset-0 bg-white/5 animate-pulse`} />
                  {/* Simulated Images */}
                  <img
                    src={`https://images.unsplash.com/photo-${1500000000000 + i * 10000}?auto=format&fit=crop&w=600&q=80`}
                    className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 opacity-60"
                    alt="memory"
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
                      className="aspect-square bg-white/5 rounded-[2px] overflow-hidden relative group cursor-pointer"
                    >
                      <img
                        src={`https://images.unsplash.com/photo-${1510000000000 + (rowIndex * 20 + i) * 123456}?auto=format&fit=crop&w=200&q=80`}
                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300 opacity-80"
                        alt="gallery"
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
