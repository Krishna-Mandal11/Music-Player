import { useState } from 'react'
import Sidebar from './components/Sidebar'
import PlayerBar from './components/PlayerBar'
import PlaceholderPage from './components/PlaceholderPage'
import DbStatus from './components/DbStatus'
import Library from './components/Library'
import FolderPage from './components/FolderPage'
import CollectionPage from './components/CollectionPage'
import BrowsePage from './components/BrowsePage'
import RankedPage from './components/RankedPage'
import FolderBrowsePage from './components/FolderBrowsePage'
import EqualizerPage from './components/EqualizerPage'
import SleepTimerPage from './components/SleepTimerPage'
import PlaylistPage from './components/PlaylistPage'
import { PlaylistsProvider } from './PlaylistsContext'
import { usePlayer } from './usePlayer'
import { useFavourites } from './useFavourites'
import { useSleepTimer } from './useSleepTimer'
import { NAV_GROUPS } from './navigation'

const ALL_ITEMS = NAV_GROUPS.flatMap((group) => group.items)
const BROWSE_KINDS = ['artists', 'albums', 'genres', 'years', 'composers']

function AppShell() {
  const [activePage, setActivePage] = useState('songs')
  const [libraryVersion, setLibraryVersion] = useState(0)
  const player = usePlayer()
  const favourites = useFavourites()
  const sleep = useSleepTimer(player)
  const page = ALL_ITEMS.find((item) => item.id === activePage)
  const playlistId = activePage.startsWith('playlist:') ? Number(activePage.slice(9)) : null

  function handleLibraryUpdated() {
    setLibraryVersion((version) => version + 1)
  }

  let content = null
  if (activePage === 'songs') {
    content = (
      <Library
        player={player}
        favourites={favourites}
        refreshKey={libraryVersion}
        onOpenFolders={() => setActivePage('folder')}
      />
    )
  } else if (activePage === 'favourites' || activePage === 'recent') {
    content = (
      <CollectionPage
        key={activePage}
        kind={activePage === 'recent' ? 'recent' : 'favourites'}
        player={player}
        favourites={favourites}
      />
    )
  } else if (BROWSE_KINDS.includes(activePage)) {
    content = (
      <BrowsePage key={activePage} kind={activePage} player={player} favourites={favourites} />
    )
  } else if (activePage === 'added' || activePage === 'played') {
    content = (
      <RankedPage key={activePage} kind={activePage} player={player} favourites={favourites} />
    )
  } else if (activePage === 'browse-folders') {
    content = <FolderBrowsePage player={player} favourites={favourites} />
  } else if (activePage === 'equalizer') {
    content = <EqualizerPage player={player} />
  } else if (activePage === 'sleep') {
    content = <SleepTimerPage sleep={sleep} player={player} />
  } else if (playlistId !== null) {
    content = (
      <PlaylistPage
        key={activePage}
        playlistId={playlistId}
        player={player}
        favourites={favourites}
        onDeleted={() => setActivePage('songs')}
      />
    )
  } else if (activePage !== 'folder') {
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
      <main className="content">
        {content}
        <div style={{ display: activePage === 'folder' ? 'block' : 'none', height: '100%' }}>
          <FolderPage onLibraryUpdated={handleLibraryUpdated} />
        </div>
      </main>
      <PlayerBar player={player} />
    </div>
  )
}

function App() {
  return (
    <PlaylistsProvider>
      <AppShell />
    </PlaylistsProvider>
  )
}

export default App
