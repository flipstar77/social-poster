'use client'

import { useEffect, useRef, useState, useCallback } from 'react'

// Fabric.js types
type FabricCanvas = import('fabric').Canvas
type FabricObject = import('fabric').FabricObject

const CANVAS_PRESETS = [
  { id: 'ig-post', label: 'Instagram Post', w: 1080, h: 1080 },
  { id: 'ig-story', label: 'Instagram Story', w: 1080, h: 1920 },
  { id: 'tiktok', label: 'TikTok', w: 1080, h: 1920 },
  { id: 'fb-post', label: 'Facebook Post', w: 1200, h: 630 },
  { id: 'linkedin', label: 'LinkedIn Post', w: 1200, h: 627 },
  { id: 'x-post', label: 'X Post', w: 1600, h: 900 },
  { id: 'yt-thumb', label: 'YouTube Thumbnail', w: 1280, h: 720 },
]

const FONT_OPTIONS = [
  'Arial', 'Georgia', 'Times New Roman', 'Courier New',
  'Verdana', 'Impact', 'Comic Sans MS', 'Trebuchet MS',
  'Palatino', 'Garamond',
]

const COLORS = [
  '#000000', '#ffffff', '#ef4444', '#f97316', '#eab308',
  '#22c55e', '#3b82f6', '#8b5cf6', '#ec4899', '#6b7280',
  '#1e293b', '#d4a574', '#2d5016', '#7c2d12',
]

export default function DesignEditor() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const fabricRef = useRef<FabricCanvas | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [preset, setPreset] = useState(CANVAS_PRESETS[0])
  const [activeObj, setActiveObj] = useState<FabricObject | null>(null)
  const [zoom, setZoom] = useState(1)
  const [textColor, setTextColor] = useState('#ffffff')
  const [fontSize, setFontSize] = useState(48)
  const [fontFamily, setFontFamily] = useState('Arial')
  const [fillColor, setFillColor] = useState('#3b82f6')
  const [canvasHistory, setCanvasHistory] = useState<string[]>([])
  const [historyIndex, setHistoryIndex] = useState(-1)
  const isUndoRedoRef = useRef(false)

  // Calculate zoom to fit canvas in viewport
  const calcZoom = useCallback((w: number, h: number) => {
    const maxW = 800
    const maxH = 600
    return Math.min(maxW / w, maxH / h, 1)
  }, [])

  // Save canvas state for undo/redo
  const saveHistory = useCallback(() => {
    if (isUndoRedoRef.current || !fabricRef.current) return
    const json = JSON.stringify(fabricRef.current.toJSON())
    setCanvasHistory(prev => {
      const newHistory = [...prev.slice(0, historyIndex + 1), json]
      setHistoryIndex(newHistory.length - 1)
      return newHistory
    })
  }, [historyIndex])

  // Initialize canvas
  useEffect(() => {
    let canvas: FabricCanvas | null = null
    let disposed = false

    const init = async () => {
      const fabric = await import('fabric')
      if (!canvasRef.current || disposed) return

      // Dispose previous canvas on same element (Strict Mode double-mount)
      if (fabricRef.current) {
        fabricRef.current.dispose()
        fabricRef.current = null
      }

      const z = calcZoom(preset.w, preset.h)
      setZoom(z)

      canvas = new fabric.Canvas(canvasRef.current, {
        width: preset.w * z,
        height: preset.h * z,
        backgroundColor: '#ffffff',
        selection: true,
      })

      canvas.setZoom(z)
      fabricRef.current = canvas

      canvas.on('selection:created', () => setActiveObj(canvas!.getActiveObject() ?? null))
      canvas.on('selection:updated', () => setActiveObj(canvas!.getActiveObject() ?? null))
      canvas.on('selection:cleared', () => setActiveObj(null))
      canvas.on('object:modified', () => saveHistory())
      canvas.on('object:added', () => saveHistory())

      // Initial history
      const json = JSON.stringify(canvas.toJSON())
      setCanvasHistory([json])
      setHistoryIndex(0)
    }

    init()

    return () => {
      disposed = true
      if (canvas) canvas.dispose()
      fabricRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preset])

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!fabricRef.current) return

      if (e.key === 'Delete' || e.key === 'Backspace') {
        const active = fabricRef.current.getActiveObject()
        if (active && document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'SELECT') {
          fabricRef.current.remove(active)
          fabricRef.current.renderAll()
          saveHistory()
        }
      }

      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        e.preventDefault()
        undo()
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
        e.preventDefault()
        redo()
      }
    }

    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canvasHistory, historyIndex])

  const undo = () => {
    if (historyIndex <= 0 || !fabricRef.current) return
    isUndoRedoRef.current = true
    const newIndex = historyIndex - 1
    fabricRef.current.loadFromJSON(JSON.parse(canvasHistory[newIndex])).then(() => {
      fabricRef.current!.renderAll()
      setHistoryIndex(newIndex)
      isUndoRedoRef.current = false
    })
  }

  const redo = () => {
    if (historyIndex >= canvasHistory.length - 1 || !fabricRef.current) return
    isUndoRedoRef.current = true
    const newIndex = historyIndex + 1
    fabricRef.current.loadFromJSON(JSON.parse(canvasHistory[newIndex])).then(() => {
      fabricRef.current!.renderAll()
      setHistoryIndex(newIndex)
      isUndoRedoRef.current = false
    })
  }

  // --- Object manipulation ---

  const addText = async () => {
    const fabric = await import('fabric')
    if (!fabricRef.current) return
    const text = new fabric.Textbox('Text hier eingeben', {
      left: 50 / zoom,
      top: 50 / zoom,
      fontSize: fontSize / zoom,
      fontFamily,
      fill: textColor,
      width: 400 / zoom,
      editable: true,
    })
    fabricRef.current.add(text)
    fabricRef.current.setActiveObject(text)
    fabricRef.current.renderAll()
  }

  const addRect = async () => {
    const fabric = await import('fabric')
    if (!fabricRef.current) return
    const rect = new fabric.Rect({
      left: 100 / zoom,
      top: 100 / zoom,
      width: 200 / zoom,
      height: 150 / zoom,
      fill: fillColor,
      rx: 10 / zoom,
      ry: 10 / zoom,
    })
    fabricRef.current.add(rect)
    fabricRef.current.setActiveObject(rect)
    fabricRef.current.renderAll()
  }

  const addCircle = async () => {
    const fabric = await import('fabric')
    if (!fabricRef.current) return
    const circle = new fabric.Circle({
      left: 100 / zoom,
      top: 100 / zoom,
      radius: 75 / zoom,
      fill: fillColor,
    })
    fabricRef.current.add(circle)
    fabricRef.current.setActiveObject(circle)
    fabricRef.current.renderAll()
  }

  const addImage = async (file: File) => {
    const fabric = await import('fabric')
    if (!fabricRef.current) return
    const url = URL.createObjectURL(file)
    const img = await fabric.FabricImage.fromURL(url)
    // Scale to fit canvas
    const maxDim = Math.min(preset.w, preset.h) * 0.6
    const scale = Math.min(maxDim / (img.width ?? 1), maxDim / (img.height ?? 1))
    img.set({ left: 50 / zoom, top: 50 / zoom, scaleX: scale / zoom, scaleY: scale / zoom })
    fabricRef.current.add(img)
    fabricRef.current.setActiveObject(img)
    fabricRef.current.renderAll()
  }

  const bringForward = () => {
    if (!fabricRef.current || !activeObj) return
    fabricRef.current.bringObjectForward(activeObj)
    fabricRef.current.renderAll()
    saveHistory()
  }

  const sendBackward = () => {
    if (!fabricRef.current || !activeObj) return
    fabricRef.current.sendObjectBackwards(activeObj)
    fabricRef.current.renderAll()
    saveHistory()
  }

  const duplicateObj = () => {
    if (!fabricRef.current || !activeObj) return
    activeObj.clone().then((cloned: FabricObject) => {
      cloned.set({ left: (cloned.left ?? 0) + 20, top: (cloned.top ?? 0) + 20 })
      fabricRef.current!.add(cloned)
      fabricRef.current!.setActiveObject(cloned)
      fabricRef.current!.renderAll()
      saveHistory()
    })
  }

  const deleteObj = () => {
    if (!fabricRef.current || !activeObj) return
    fabricRef.current.remove(activeObj)
    fabricRef.current.renderAll()
    saveHistory()
  }

  // --- Export ---

  const exportCanvas = (format: string) => {
    if (!fabricRef.current) return
    fabricRef.current.discardActiveObject()
    fabricRef.current.renderAll()

    // Export at full resolution
    const multiplier = 1 / zoom
    const dataUrl = fabricRef.current.toDataURL({
      format: format as 'png' | 'jpeg',
      quality: format === 'jpg' ? 0.92 : undefined,
      multiplier,
    })

    const link = document.createElement('a')
    link.download = `design-${preset.id}-${Date.now()}.${format}`
    link.href = dataUrl
    link.click()
  }

  const saveJSON = () => {
    if (!fabricRef.current) return
    const json = JSON.stringify(fabricRef.current.toJSON(), null, 2)
    const blob = new Blob([json], { type: 'application/json' })
    const link = document.createElement('a')
    link.download = `design-${preset.id}-${Date.now()}.json`
    link.href = URL.createObjectURL(blob)
    link.click()
  }

  const loadJSON = (file: File) => {
    if (!fabricRef.current) return
    const reader = new FileReader()
    reader.onload = (e) => {
      const json = JSON.parse(e.target?.result as string)
      fabricRef.current!.loadFromJSON(json).then(() => {
        fabricRef.current!.renderAll()
        saveHistory()
      })
    }
    reader.readAsText(file)
  }

  // Update active object properties
  const updateActiveColor = (color: string) => {
    if (!fabricRef.current || !activeObj) return
    activeObj.set('fill', color)
    fabricRef.current.renderAll()
    saveHistory()
  }

  const updateActiveFontSize = (size: number) => {
    if (!fabricRef.current || !activeObj) return
    ;(activeObj as any).set('fontSize', size / zoom)
    fabricRef.current.renderAll()
    saveHistory()
  }

  const updateActiveFontFamily = (family: string) => {
    if (!fabricRef.current || !activeObj) return
    ;(activeObj as any).set('fontFamily', family)
    fabricRef.current.renderAll()
    saveHistory()
  }

  const setCanvasBg = (color: string) => {
    if (!fabricRef.current) return
    fabricRef.current.backgroundColor = color
    fabricRef.current.renderAll()
    saveHistory()
  }

  const isTextObj = activeObj && ('text' in activeObj || (activeObj as any).type === 'textbox' || (activeObj as any).type === 'i-text')

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Top Toolbar */}
      <div className="flex items-center gap-2 p-3 bg-zinc-900 border-b border-zinc-700 flex-wrap">
        {/* Preset selector */}
        <select
          value={preset.id}
          onChange={(e) => {
            const p = CANVAS_PRESETS.find(c => c.id === e.target.value)
            if (p) setPreset(p)
          }}
          className="bg-zinc-800 text-white text-sm px-3 py-1.5 rounded border border-zinc-600"
        >
          {CANVAS_PRESETS.map(p => (
            <option key={p.id} value={p.id}>{p.label} ({p.w}x{p.h})</option>
          ))}
        </select>

        <div className="w-px h-6 bg-zinc-600" />

        {/* Add objects */}
        <button onClick={addText} className="px-3 py-1.5 bg-zinc-700 hover:bg-zinc-600 text-white text-sm rounded transition-colors" title="Text">
          T
        </button>
        <button onClick={addRect} className="px-3 py-1.5 bg-zinc-700 hover:bg-zinc-600 text-white text-sm rounded transition-colors" title="Rechteck">
          &#9645;
        </button>
        <button onClick={addCircle} className="px-3 py-1.5 bg-zinc-700 hover:bg-zinc-600 text-white text-sm rounded transition-colors" title="Kreis">
          &#9675;
        </button>
        <button
          onClick={() => fileInputRef.current?.click()}
          className="px-3 py-1.5 bg-zinc-700 hover:bg-zinc-600 text-white text-sm rounded transition-colors"
          title="Bild hochladen"
        >
          Bild
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) addImage(file)
            e.target.value = ''
          }}
        />

        <div className="w-px h-6 bg-zinc-600" />

        {/* Colors */}
        <div className="flex gap-1">
          {COLORS.slice(0, 8).map(c => (
            <button
              key={c}
              onClick={() => {
                setFillColor(c)
                setTextColor(c)
                if (activeObj) updateActiveColor(c)
              }}
              className="w-6 h-6 rounded border border-zinc-500 hover:scale-110 transition-transform"
              style={{ backgroundColor: c }}
              title={c}
            />
          ))}
          <input
            type="color"
            value={fillColor}
            onChange={(e) => {
              setFillColor(e.target.value)
              setTextColor(e.target.value)
              if (activeObj) updateActiveColor(e.target.value)
            }}
            className="w-6 h-6 rounded cursor-pointer"
            title="Custom color"
          />
        </div>

        <div className="w-px h-6 bg-zinc-600" />

        {/* Undo/Redo */}
        <button onClick={undo} disabled={historyIndex <= 0} className="px-2 py-1.5 bg-zinc-700 hover:bg-zinc-600 disabled:opacity-30 text-white text-sm rounded" title="Undo (Ctrl+Z)">
          &#8617;
        </button>
        <button onClick={redo} disabled={historyIndex >= canvasHistory.length - 1} className="px-2 py-1.5 bg-zinc-700 hover:bg-zinc-600 disabled:opacity-30 text-white text-sm rounded" title="Redo (Ctrl+Y)">
          &#8618;
        </button>
      </div>

      {/* Main area */}
      <div className="flex flex-1 min-h-0">
        {/* Canvas */}
        <div className="flex-1 flex items-center justify-center bg-zinc-800 overflow-auto p-4">
          <div
            className="shadow-2xl"
            style={{
              width: preset.w * zoom,
              height: preset.h * zoom,
              position: 'relative',
            }}
          >
            <canvas ref={canvasRef} />
          </div>
        </div>

        {/* Right sidebar */}
        <div className="w-64 bg-zinc-900 border-l border-zinc-700 p-4 overflow-y-auto space-y-4">
          {/* Canvas background */}
          <div>
            <h3 className="text-xs font-medium text-zinc-400 uppercase mb-2">Hintergrund</h3>
            <div className="flex gap-1 flex-wrap">
              {['#ffffff', '#000000', '#1e293b', '#fef3c7', '#dcfce7', '#dbeafe', '#fce7f3', '#f3e8ff'].map(c => (
                <button
                  key={c}
                  onClick={() => setCanvasBg(c)}
                  className="w-7 h-7 rounded border border-zinc-600 hover:scale-110 transition-transform"
                  style={{ backgroundColor: c }}
                />
              ))}
              <input
                type="color"
                defaultValue="#ffffff"
                onChange={(e) => setCanvasBg(e.target.value)}
                className="w-7 h-7 rounded cursor-pointer"
              />
            </div>
          </div>

          {/* Active object props */}
          {activeObj && (
            <div>
              <h3 className="text-xs font-medium text-zinc-400 uppercase mb-2">Auswahl</h3>
              <div className="space-y-2">
                {isTextObj && (
                  <>
                    <select
                      value={fontFamily}
                      onChange={(e) => { setFontFamily(e.target.value); updateActiveFontFamily(e.target.value) }}
                      className="w-full bg-zinc-800 text-white text-sm px-2 py-1.5 rounded border border-zinc-600"
                    >
                      {FONT_OPTIONS.map(f => <option key={f} value={f}>{f}</option>)}
                    </select>
                    <div className="flex gap-2">
                      <input
                        type="number"
                        value={fontSize}
                        onChange={(e) => { const v = parseInt(e.target.value) || 12; setFontSize(v); updateActiveFontSize(v) }}
                        className="w-20 bg-zinc-800 text-white text-sm px-2 py-1.5 rounded border border-zinc-600"
                        min={8}
                        max={200}
                      />
                      <span className="text-zinc-400 text-sm self-center">px</span>
                    </div>
                  </>
                )}
                <div className="flex gap-1 flex-wrap">
                  {COLORS.map(c => (
                    <button
                      key={c}
                      onClick={() => updateActiveColor(c)}
                      className="w-6 h-6 rounded border border-zinc-500 hover:scale-110 transition-transform"
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>

                <div className="flex gap-1 pt-2">
                  <button onClick={bringForward} className="flex-1 px-2 py-1 bg-zinc-700 hover:bg-zinc-600 text-white text-xs rounded" title="Nach vorne">
                    Nach vorne
                  </button>
                  <button onClick={sendBackward} className="flex-1 px-2 py-1 bg-zinc-700 hover:bg-zinc-600 text-white text-xs rounded" title="Nach hinten">
                    Nach hinten
                  </button>
                </div>
                <div className="flex gap-1">
                  <button onClick={duplicateObj} className="flex-1 px-2 py-1 bg-zinc-700 hover:bg-zinc-600 text-white text-xs rounded">
                    Duplizieren
                  </button>
                  <button onClick={deleteObj} className="flex-1 px-2 py-1 bg-red-900 hover:bg-red-800 text-white text-xs rounded">
                    Entfernen
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Export */}
          <div>
            <h3 className="text-xs font-medium text-zinc-400 uppercase mb-2">Export</h3>
            <div className="space-y-2">
              <button onClick={() => exportCanvas('png')} className="w-full px-3 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm rounded transition-colors">
                PNG herunterladen
              </button>
              <button onClick={() => exportCanvas('jpg')} className="w-full px-3 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm rounded transition-colors">
                JPG herunterladen
              </button>
              <div className="flex gap-1">
                <button onClick={saveJSON} className="flex-1 px-2 py-1.5 bg-zinc-700 hover:bg-zinc-600 text-white text-xs rounded">
                  JSON speichern
                </button>
                <label className="flex-1 px-2 py-1.5 bg-zinc-700 hover:bg-zinc-600 text-white text-xs rounded text-center cursor-pointer">
                  JSON laden
                  <input
                    type="file"
                    accept=".json"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0]
                      if (file) loadJSON(file)
                      e.target.value = ''
                    }}
                  />
                </label>
              </div>
            </div>
          </div>

          {/* Info */}
          <div className="text-xs text-zinc-500 space-y-1">
            <p>{preset.w} x {preset.h} px</p>
            <p>Zoom: {Math.round(zoom * 100)}%</p>
            <p>Delete = Objekt entfernen</p>
            <p>Ctrl+Z/Y = Undo/Redo</p>
          </div>
        </div>
      </div>
    </div>
  )
}
