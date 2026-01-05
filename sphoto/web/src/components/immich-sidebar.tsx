"use client"

import {
    Image as ImageIcon,
    Compass,
    Map as MapIcon,
    Users,
    Share2,
    Heart,
    Folder,
    PlusSquare,
    Archive,
    Lock,
    Trash2,
    HardDrive
} from "lucide-react"

export function ImmichSidebar() {
    const menuItems = [
        { icon: ImageIcon, label: "Photos", active: true },
        { icon: Compass, label: "Explore" },
        { icon: MapIcon, label: "Map" },
        { icon: Users, label: "People" },
        { icon: Share2, label: "Sharing" },
    ]

    const libraryItems = [
        { icon: Heart, label: "Favorites" },
        { icon: Folder, label: "Albums" },
        { icon: PlusSquare, label: "Utilities" },
        { icon: Archive, label: "Archive" },
        { icon: Lock, label: "Locked Folder" },
        { icon: Trash2, label: "Trash" },
    ]

    return (
        <div className="w-52 flex flex-col h-full bg-black text-white/70 text-[11px] font-medium border-r border-white/10 select-none">
            <div className="p-4 flex items-center gap-2 mb-2">
                <div className="w-6 h-6 bg-blue-500 rounded-sm flex items-center justify-center">
                    <div className="w-4 h-4 text-white">
                        <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2L4.5 20.29L5.21 21L12 18L18.79 21L19.5 20.29L12 2Z" /></svg>
                    </div>
                </div>
                <span className="text-white text-sm font-bold tracking-tight">immich</span>
            </div>

            <nav className="flex-1 px-2 space-y-0.5">
                {menuItems.map((item) => (
                    <div
                        key={item.label}
                        className={`flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer transition-colors ${item.active ? 'bg-white/10 text-white' : 'hover:bg-white/5'}`}
                    >
                        <item.icon size={16} className={item.active ? "text-blue-400" : ""} />
                        <span>{item.label}</span>
                    </div>
                ))}

                <div className="mt-6 mb-2 px-3 text-[9px] uppercase tracking-wider text-white/40 font-bold">Library</div>

                {libraryItems.map((item) => (
                    <div
                        key={item.label}
                        className="flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer hover:bg-white/5 transition-colors"
                    >
                        <item.icon size={16} />
                        <span>{item.label}</span>
                    </div>
                ))}
            </nav>

            <div className="mt-auto p-4 border-t border-white/10">
                <div className="mt-2 text-[10px] space-y-2">
                    <div className="flex flex-col gap-1">
                        <span className="text-white/60">Storage space</span>
                        <div className="h-1 bg-white/10 rounded-full overflow-hidden">
                            <div className="h-full bg-blue-500 w-3/4" />
                        </div>
                        <span className="text-white/40">3.4 TiB of 4.5 TiB used</span>
                    </div>
                </div>
            </div>
        </div>
    )
}
