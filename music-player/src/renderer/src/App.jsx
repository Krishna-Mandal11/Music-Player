import { useState } from 'react'
import Sidebar from './components/Sidebar'
import PlayerBar from './components/PlayerBar'
import PlaceholderPage from './components/PlaceholderPage'
import { NAV_GROUPS } from './navigation'

const ALL_ITEMS = NAV_GROUPS.flatMap((group) => group.items)

function App() {
  const [activePage, setActivePage] = useState('songs')
  const page = ALL_ITEMS.find((item) => item.id === activePage)

  return (
    <div className="shell">
      <Sidebar groups={NAV_GROUPS} activePage={activePage} onNavigate={setActivePage} />
      <main className="content">
        <PlaceholderPage title={page.label} milestone={page.milestone} />
      </main>
      <PlayerBar />
    </div>
  )
}

export default App
