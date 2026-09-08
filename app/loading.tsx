export default function RootLoading() {
  return (
    <div className="profile-page" style={{ opacity: 0.9 }}>
      {/* Header Skeleton */}
      <div
        className="profile-header skeleton-shimmer"
        style={{
          borderRadius: 'var(--radius-xl, 24px)',
          marginBottom: '24px',
          minHeight: '120px',
        }}
      />

      {/* Content Skeleton Cards */}
      <div className="profile-body" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <div
          className="card skeleton-shimmer"
          style={{
            padding: '24px',
            borderRadius: 'var(--radius-xl, 20px)',
            minHeight: '140px',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
          }}
        >
          <div className="skeleton-box skeleton-shimmer" style={{ width: '40%', height: '22px' }} />
          <div className="skeleton-box skeleton-shimmer" style={{ width: '85%', height: '14px' }} />
          <div className="skeleton-box skeleton-shimmer" style={{ width: '60%', height: '14px' }} />
        </div>

        <div
          className="card skeleton-shimmer"
          style={{
            padding: '24px',
            borderRadius: 'var(--radius-xl, 20px)',
            minHeight: '180px',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              className="skeleton-circle skeleton-shimmer"
              style={{ width: '46px', height: '46px', flexShrink: 0 }}
            />
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', flex: 1 }}>
              <div className="skeleton-box skeleton-shimmer" style={{ width: '35%', height: '16px' }} />
              <div className="skeleton-box skeleton-shimmer" style={{ width: '20%', height: '12px' }} />
            </div>
          </div>
          <div className="skeleton-box skeleton-shimmer" style={{ width: '90%', height: '16px', marginTop: '8px' }} />
          <div className="skeleton-box skeleton-shimmer" style={{ width: '75%', height: '16px' }} />
        </div>
      </div>
    </div>
  )
}
