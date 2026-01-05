"use client"

import { useMemo } from "react"
import { motion } from "framer-motion"

export function HeroImage() {
  // Generate random heights for the "masonry" layout look
  const columns = useMemo(() => [
    [180, 240, 160], // Col 1
    [220, 140, 260], // Col 2
    [160, 280, 200], // Col 3
    [240, 180, 220], // Col 4
  ], [])

  return (
    <div className="relative w-full max-w-[1000px] mx-auto mt-16 lg:mt-24 perspective-[2000px]">
      {/* Abstract Browser Interface */}
      <motion.div 
        initial={{ opacity: 0, rotateX: 20, y: 100 }}
        animate={{ opacity: 1, rotateX: 0, y: 0 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
        className="relative rounded-2xl border bg-background/80 backdrop-blur-xl shadow-2xl overflow-hidden ring-1 ring-white/20"
      >
        {/* Browser Toolbar */}
        <div className="h-10 border-b bg-muted/50 flex items-center px-4 gap-2">
          <div className="flex gap-1.5">
            <div className="w-3 h-3 rounded-full bg-red-400/80" />
            <div className="w-3 h-3 rounded-full bg-amber-400/80" />
            <div className="w-3 h-3 rounded-full bg-emerald-400/80" />
          </div>
          <div className="flex-1 flex justify-center">
            <div className="h-6 w-64 bg-background/50 rounded-md flex items-center justify-center text-[10px] text-muted-foreground font-mono">
              sphoto.arturf.ch
            </div>
          </div>
        </div>

        {/* Gallery Content */}
        <div className="p-6 md:p-8 bg-background/50">
          <div className="flex items-center justify-between mb-8">
            <div className="space-y-1.5">
              <div className="h-6 w-32 bg-foreground/10 rounded-md" />
              <div className="h-3 w-48 bg-muted-foreground/10 rounded-md" />
            </div>
            <div className="flex gap-2">
              <div className="h-8 w-8 rounded-full bg-primary/10" />
              <div className="h-8 w-8 rounded-full bg-muted" />
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {columns.map((col, colIndex) => (
              <div key={colIndex} className="flex flex-col gap-4">
                {col.map((height, itemIndex) => (
                  <motion.div
                    key={itemIndex}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ 
                      delay: 0.5 + (colIndex * 0.1) + (itemIndex * 0.1),
                      duration: 0.5 
                    }}
                    style={{ height }}
                    className={`
                      w-full rounded-lg overflow-hidden relative group cursor-pointer
                      ${(colIndex + itemIndex) % 3 === 0 ? 'bg-primary/5' : 'bg-muted/30'}
                    `}
                  >
                    {/* Placeholder content pattern */}
                    <div className="absolute inset-0 bg-gradient-to-br from-transparent to-black/5 dark:to-white/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                    
                    {/* Abstract "Image" - just a colorful gradient or solid tone */}
                    <div className={`
                      w-full h-full opacity-80
                      ${itemIndex % 2 === 0 ? 'bg-gradient-to-br from-primary/10 to-primary/5' : 'bg-gradient-to-br from-blue-500/5 to-purple-500/5'}
                    `} />
                    
                    {/* Hover overlay UI */}
                    <div className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity transform translate-y-2 group-hover:translate-y-0 duration-200">
                      <div className="h-6 w-6 rounded-full bg-white/90 shadow-sm flex items-center justify-center">
                        <div className="h-3 w-3 rounded-[1px] border border-primary/50" />
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            ))}
          </div>
        </div>
      </motion.div>
      
      {/* Glow effect behind */}
      <div className="absolute inset-0 -z-10 bg-primary/20 blur-[100px] rounded-full opacity-50 translate-y-20 scale-90" />
    </div>
  )
}
