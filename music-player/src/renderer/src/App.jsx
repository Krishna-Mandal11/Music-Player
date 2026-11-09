import { useState } from 'react'
import Sidebar from './components/Sidebar'
import PlayerBar from './components/PlayerBar'
import PlaceholderPage from './components/PlaceholderPage'
import DbStatus from './components/DbStatus'
import Library from './components/Library'
import CollectionPage from './components/CollectionPage'
import BrowsePage from './components/BrowsePage'
import SleepTimerPage from './components/SleepTimerPage'
import { usePlayer } from './usePlayer'
import { useFavourites } from './useFavourites'
import { useSleepTimer } from './useSleepTimer'
import { NAV_GROUPS } from './navigation'

const ALL_ITEMS = NAV_GROUPS.flatMap((group) => group.items)

function App() {
  const [activePage, setActivePage] = useState('songs')
  const player = usePlayer()
  const favourites = useFavourites()
  const sleep = useSleepTimer(player)
  const page = ALL_ITEMS.find((item) => item.id === activePage)

  let content
  if (activePage === 'songs') {
    content = <Library player={player} favourites={favourites} />
  } else if (activePage === 'favourites' || activePage === 'recent') {
    content = (
      <CollectionPage
        key={activePage}
        kind={activePage === 'recent' ? 'recent' : 'favourites'}
        player={player}
        favourites={favourites}
      />
    )
  } else if (activePage === 'artists' || activePage === 'albums' || activePage === 'genres') {
    content = (
      <BrowsePage key={activePage} kind={activePage} player={player} favourites={favourites} />
    )
  } else if (activePage === 'sleep') {
    content = <SleepTimerPage sleep={sleep} player={player} />
  } else {
    content = (
      <>
        <PlaceholderPage title={page.label} milestone={page.milestone} />
        <DbStatus />
      </>
    )
  }

  return (
    <div className="shell">
      <Sidebar groups={NAV_GROUPS} activePage={activePage} onNavigate={setActivePage} />
      <main className="content">{content}</main>
      <PlayerBar player={player} />
    </div>
  )
}

export default App
