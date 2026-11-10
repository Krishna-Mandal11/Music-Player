import { useEffect, useRef } from 'react'

function isTyping(target) {
  if (!target) return false
  const tag = target.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable
}

export function useShortcuts(player) {
  const ref = useRef(player)
  ref.current = player

  useEffect(() => {
    const onKeyDown = (e) => {
      if (isTyping(e.target) || e.altKey || e.metaKey) return
      const p = ref.current

      if (e.code === 'Space' && !e.ctrlKey) {
        e.preventDefault() // also stops a focused button from being clicked
        if (!e.repeat) p.toggle()
      } else if (e.ctrlKey && e.key === 'ArrowRight') {
        e.preventDefault()
        p.next()
      } else if (e.ctrlKey && e.key === 'ArrowLeft') {
        e.preventDefault()
        p.previous()
      } else if (e.ctrlKey && e.key === 'ArrowUp') {
        e.preventDefault()
        p.setVolume(Math.min(1, Math.round((p.volume + 0.05) * 100) / 100))
      } else if (e.ctrlKey && e.key === 'ArrowDown') {
        e.preventDefault()
        p.setVolume(Math.max(0, Math.round((p.volume - 0.05) * 100) / 100))
      } else if (!e.ctrlKey && !e.repeat && e.key.toLowerCase() === 'm') {
        p.toggleMute()
      } else if (!e.ctrlKey && !e.repeat && e.key.toLowerCase() === 's') {
        p.toggleShuffle()
      } else if (!e.ctrlKey && !e.repeat && e.key.toLowerCase() === 'r') {
        p.cycleRepeat()
      }
    }

    // Space on a focused button clicks it on key release, so block that too
    const onKeyUp = (e) => {
      if (e.code === 'Space' && !isTyping(e.target)) e.preventDefault()
    }

    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
    }
  }, [])
}
