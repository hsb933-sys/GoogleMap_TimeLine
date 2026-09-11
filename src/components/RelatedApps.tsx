// Cross-links to sibling side-project apps, each with its own blog post.
// Add an entry here whenever a new app in the series is published.
const RELATED_APPS = [
  {
    icon: '💬',
    title: '카톡 대화 분석기',
    subtitle: '단톡방 대화량, 활동 시간대, 자주 쓰는 말버릇까지',
    url: 'https://seap.tistory.com/entry/kakao-chat-analyzer',
  },
]

export function RelatedApps() {
  return (
    <div className="related-apps">
      {RELATED_APPS.map((app) => (
        <a key={app.url} href={app.url} target="_blank" rel="noopener noreferrer" className="related-apps-card">
          <span className="related-apps-icon">{app.icon}</span>
          <span className="related-apps-text">
            <span className="related-apps-title">{app.title}</span>
            <span className="related-apps-subtitle">{app.subtitle}</span>
          </span>
          <span className="related-apps-arrow" aria-hidden="true">→</span>
        </a>
      ))}
    </div>
  )
}
