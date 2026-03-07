'use client'

import dynamic from 'next/dynamic'

const DesignEditor = dynamic(() => import('@/components/DesignEditor'), { ssr: false })

export default function DesignPage() {
  return (
    <div className="h-[calc(100dvh)] flex flex-col bg-zinc-900 text-white">
      <div className="px-4 py-2 bg-zinc-950 border-b border-zinc-700">
        <h2 className="text-lg font-semibold">Design Editor</h2>
      </div>
      <div className="flex-1 min-h-0">
        <DesignEditor />
      </div>
    </div>
  )
}
