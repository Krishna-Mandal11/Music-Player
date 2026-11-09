function PlaceholderPage({ title, milestone }) {
  return (
    <div className="page">
      <h1 className="page-title">{title}</h1>
      <p className="page-note">This section is built in milestone {milestone}.</p>
    </div>
  )
}

export default PlaceholderPage
