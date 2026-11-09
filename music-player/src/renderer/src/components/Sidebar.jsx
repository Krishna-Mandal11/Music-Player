function Sidebar({ groups, activePage, onNavigate }) {
  return (
    <nav className="sidebar">
      <div className="sidebar-brand">Music Player</div>

      {groups.map((group) => (
        <div className="nav-group" key={group.title}>
          <div className="nav-group-title">{group.title}</div>
          {group.items.map((item) => (
            <button
              key={item.id}
              className={item.id === activePage ? 'nav-item active' : 'nav-item'}
              onClick={() => onNavigate(item.id)}
            >
              {item.label}
            </button>
          ))}
        </div>
      ))}
    </nav>
  )
}

export default Sidebar
