import { useWallet } from '../context/WalletContext';
import { useEventStream } from '../hooks/useStellar';
import { truncateAddress, formatTime, getExplorerUrl } from '../utils/errors';

export default function EventLog() {
  const { publicKey, isConnected } = useWallet();
  const { events, clearEvents } = useEventStream(publicKey);

  if (!isConnected) {
    return (
      <div className="card">
        <div className="card-header">
          <div className="card-title"><span>📡</span> Live Events</div>
        </div>
        <div className="event-empty">
          <div className="event-empty-icon">📡</div>
          <p>Connect wallet to stream live events</p>
        </div>
      </div>
    );
  }

  return (
    <div className="card">
      <div className="card-header">
        <div className="card-title">
          <span>📡</span> Live Events
          {events.length > 0 && (
            <span className="badge badge-info">{events.length}</span>
          )}
        </div>
        {events.length > 0 && (
          <button className="btn btn-secondary btn-sm" onClick={clearEvents}>
            Clear
          </button>
        )}
      </div>

      <div className="event-log" id="event-log-list">
        {events.length === 0 ? (
          <div className="event-empty">
            <div className="event-empty-icon">⏳</div>
            <p className="text-sm text-secondary">Listening for transactions...</p>
            <p className="text-xs text-tertiary mt-2">
              Events will appear here in real-time when transactions are made
            </p>
          </div>
        ) : (
          events.map((event) => (
            <div className="event-item" key={event.id}>
              <div
                className={`event-dot ${
                  event.isIncoming ? 'event-dot-receive' : 'event-dot-send'
                }`}
              ></div>
              <div className="event-info">
                <div className="event-type">
                  {event.isIncoming ? '↓ Received' : '↑ Sent'}
                </div>
                <div className="event-detail">
                  {event.amount} {event.asset}
                  {event.isIncoming
                    ? ` from ${truncateAddress(event.from)}`
                    : ` to ${truncateAddress(event.to)}`}
                </div>
                {event.txHash && (
                  <a
                    href={getExplorerUrl(event.txHash)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="tx-hash-link"
                    style={{ marginTop: 2 }}
                  >
                    {truncateAddress(event.txHash, 6, 6)}
                  </a>
                )}
              </div>
              <div className="event-time">
                {formatTime(event.createdAt)}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
