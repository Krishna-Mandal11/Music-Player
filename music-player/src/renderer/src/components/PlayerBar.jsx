import Icon from './Icon'

function PlayerBar() {
  return (
    <footer className="player-bar">
      <div className="player-track">
        <div className="player-artwork">
          <Icon name="note" size={28} />
        </div>
        <div className="player-track-text">
          <div className="player-title">Nothing playing</div>
          <div className="player-artist">Choose a music folder to begin</div>
        </div>
      </div>

      <div className="player-center">
        <div className="player-controls">
          <button className="icon-btn" disabled title="Shuffle (M7)">
            <Icon name="shuffle" />
          </button>
          <button className="icon-btn" disabled title="Previous (M7)">
            <Icon name="prev" size={24} />
          </button>
          <button className="icon-btn play-btn" disabled title="Play (M4)">
            <Icon name="play" size={28} />
          </button>
          <button className="icon-btn" disabled title="Next (M7)">
            <Icon name="next" size={24} />
          </button>
          <button className="icon-btn" disabled title="Repeat (M7)">
            <Icon name="repeat" />
          </button>
        </div>
        <div className="player-seek">
          <span className="time">0:00</span>
          <input type="range" min="0" max="100" value="0" disabled readOnly />
          <span className="time">0:00</span>
        </div>
      </div>

      <div className="player-right">
        <button className="icon-btn" disabled title="Queue (M7)">
          <Icon name="queue" />
        </button>
        <Icon name="volume" />
        <input type="range" min="0" max="100" value="100" disabled readOnly />
      </div>
    </footer>
  )
}

export default PlayerBar
