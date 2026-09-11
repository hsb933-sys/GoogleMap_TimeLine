// Cross-links to sibling side-project apps, each with its own blog post.
// Add an entry here whenever a new app in the series is published.
const RELATED_APPS = [{ label: '카톡 대화 분석기', url: 'https://seap.tistory.com/entry/kakao-chat-analyzer' }]

export function RelatedApps() {
  return (
    <div className="related-apps">
      {RELATED_APPS.map((app) => (
        <a key={app.url} href={app.url} target="_blank" rel="noopener noreferrer" className="related-apps-link">
          🔗 다른 프로젝트 - {app.label} →
        </a>
      ))}
    </div>
  )
}
