export default function MessagesLoading() {
  return (
    <div className="profile-page">
      {/* Header skeleton */}
      <div
        className="profile-header skeleton-shimmer"
        style={{
          borderRadius: 'var(--radius-xl, 24px)',
          marginBottom: '24px',
          minHeight: '110px',
        }}
      />

      <div className="profile-body">
        <div className="conv-list-container">
          {/* Search bar skeleton */}
          <div
            className="skeleton-box skeleton-shimmer"
            style={{
              height: '46px',
              borderRadius: 'var(--radius-lg, 16px)',
              marginBottom: '20px',
            }}
          />

          {/* Conversation items skeleton */}
          <div className="conv-items" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {[1, 2, 3, 4, 5].map(i => (
              <div
                key={i}
                className="conv-item"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '14px',
                  padding: '12px 16px',
                  background: 'var(--glass-bg, rgba(255, 255, 255, 0.7))',
                  borderRadius: 'var(--radius-lg, 16px)',
                }}
              >
                <div
                  className="skeleton-circle skeleton-shimmer"
                  style={{ width: '50px', height: '50px', flexShrink: 0 }}
                />
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div className="skeleton-box skeleton-shimmer" style={{ width: '30%', height: '15px' }} />
                    <div className="skeleton-box skeleton-shimmer" style={{ width: '15%', height: '12px' }} />
                  </div>
                  <div className="skeleton-box skeleton-shimmer" style={{ width: '65%', height: '13px' }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
