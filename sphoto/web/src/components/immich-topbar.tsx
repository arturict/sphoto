"use client"

import { Search, Upload, Moon, Bell, ChevronDown } from "lucide-react"

export function ImmichTopBar() {
    return (
        <div className="h-14 bg-black border-b border-white/10 flex items-center px-6 gap-4">
            <div className="flex-1 max-w-2xl relative">
                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40">
                    <Search size={16} />
                </div>
                <input
                    type="text"
                    placeholder="Search your photos"
                    className="w-full bg-white/5 border border-white/10 rounded-lg py-1.5 pl-10 pr-10 text-xs text-white/80 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
                <div className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 21v-7h5v7M4 14V3c0-1.1.9-2 2-2h12c1.1 0 2 .9 2 2v11M15 21v-7h5v7M4 14h16" /></svg>
                </div>
            </div>

            <div className="flex items-center gap-5 text-white/60">
                <button className="flex items-center gap-2 text-xs font-medium hover:text-white transition-colors">
                    <Upload size={16} />
                    <span>Upload</span>
                </button>
                <button className="hover:text-white transition-colors">
                    <Moon size={18} />
                </button>
                <button className="hover:text-white transition-colors relative">
                    <Bell size={18} />
                    <div className="absolute top-0 right-0 w-1.5 h-1.5 bg-red-500 rounded-full" />
                </button>
                <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-xs font-bold text-white cursor-pointer overflow-hidden">
                    A
                </div>
            </div>
        </div>
    )
}
