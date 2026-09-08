export default function DirectChatLoading() {
  return (
    <div className="chat-page-layout">
      <div className="chat-page-container">
        <div className="chat-window">
          {/* Header skeleton */}
          <div
            className="chat-header"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              padding: '14px 20px',
              borderBottom: '1px solid rgba(255, 182, 193, 0.25)',
            }}
          >
            <div className="skeleton-box skeleton-shimmer" style={{ width: '28px', height: '28px', borderRadius: '8px' }} />
            <div className="skeleton-circle skeleton-shimmer" style={{ width: '42px', height: '42px' }} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', flex: 1 }}>
              <div className="skeleton-box skeleton-shimmer" style={{ width: '120px', height: '16px' }} />
              <div className="skeleton-box skeleton-shimmer" style={{ width: '70px', height: '11px' }} />
            </div>
          </div>

          {/* Messages bubbles skeleton */}
          <div className="chat-messages" style={{ display: 'flex', flexDirection: 'column', gap: '14px', padding: '24px 20px', minHeight: '380px' }}>
            <div style={{ alignSelf: 'flex-start', width: '55%' }}>
              <div
                className="skeleton-box skeleton-shimmer"
                style={{ height: '52px', borderRadius: '18px 18px 18px 4px' }}
              />
            </div>
            <div style={{ alignSelf: 'flex-end', width: '45%' }}>
              <div
                className="skeleton-box skeleton-shimmer"
                style={{ height: '44px', borderRadius: '18px 18px 4px 18px' }}
              />
            </div>
            <div style={{ alignSelf: 'flex-start', width: '65%' }}>
              <div
                className="skeleton-box skeleton-shimmer"
                style={{ height: '60px', borderRadius: '18px 18px 18px 4px' }}
              />
            </div>
            <div style={{ alignSelf: 'flex-end', width: '38%' }}>
              <div
                className="skeleton-box skeleton-shimmer"
                style={{ height: '40px', borderRadius: '18px 18px 4px 18px' }}
              />
            </div>
          </div>

          {/* Input bar skeleton */}
          <div
            className="chat-input-bar"
            style={{
              padding: '12px 16px',
              borderTop: '1px solid rgba(255, 182, 193, 0.25)',
            }}
          >
            <div
              className="skeleton-box skeleton-shimmer"
              style={{ height: '44px', borderRadius: '22px', width: '100%' }}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
