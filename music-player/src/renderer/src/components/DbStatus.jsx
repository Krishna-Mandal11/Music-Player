import { useEffect, useState } from 'react'

function DbStatus() {
  const [text, setText] = useState('Checking database…')

  useEffect(() => {
    window.api
      .getDbStatus()
      .then((status) => {
        if (!status.ok) {
          setText(`Database error: ${status.error}`)
          return
        }
        const times = status.openCount === 1 ? 'time' : 'times'
        setText(
          `Database OK · schema version ${status.schemaVersion} · app opened ${status.openCount} ${times}`
        )
      })
      .catch((error) => setText(`Database error: ${error.message}`))
  }, [])

  return <p style={{ padding: '0 24px', opacity: 0.7, fontSize: 13 }}>{text}</p>
}

export default DbStatus
