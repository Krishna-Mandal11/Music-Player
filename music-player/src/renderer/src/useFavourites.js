import { useCallback, useEffect, useState } from 'react'

export function useFavourites() {
  const [ids, setIds] = useState(() => new Set())

  useEffect(() => {
    window.api.getFavouriteIds().then((list) => setIds(new Set(list)))
  }, [])

  const toggle = useCallback(async (id) => {
    const isFavourite = await window.api.toggleFavourite(id)
    setIds((previous) => {
      const next = new Set(previous)
      if (isFavourite) next.add(id)
      else next.delete(id)
      return next
    })
  }, [])

  return { ids, toggle }
}
