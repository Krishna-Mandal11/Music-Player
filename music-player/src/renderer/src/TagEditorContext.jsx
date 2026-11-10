import { createContext, useCallback, useContext, useMemo, useState } from 'react'
import TagEditorDialog from './components/TagEditorDialog'

const TagEditorContext = createContext(null)

export function TagEditorProvider({ children }) {
  const [track, setTrack] = useState(null)
  const open = useCallback((t) => setTrack(t), [])
  const value = useMemo(() => ({ open }), [open])

  return (
    <TagEditorContext.Provider value={value}>
      {children}
      {track && <TagEditorDialog key={track.id} track={track} onClose={() => setTrack(null)} />}
    </TagEditorContext.Provider>
  )
}

export function useTagEditor() {
  const value = useContext(TagEditorContext)
  if (!value) throw new Error('useTagEditor must be used inside TagEditorProvider')
  return value
}
