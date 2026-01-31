"use client";

import { VoiceInterface } from "./components";

export default function Home() {
  return (
    <div className="app-container">
      {/* Animated Background */}
      <div className="background-gradient" />
      <div className="background-orbs">
        <div className="orb orb-1" />
        <div className="orb orb-2" />
        <div className="orb orb-3" />
      </div>

      {/* Main Content */}
      <main className="main-content">
        {/* Header */}
        <header className="header">
          <div className="logo">
            <div className="logo-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" />
                <circle cx="12" cy="9" r="2.5" />
              </svg>
            </div>
            <div className="logo-text">
              <h1>Reality Memory</h1>
              <p>Spatial Memory System</p>
            </div>
          </div>
          <nav className="nav-tabs">
            <button className="nav-tab active">Recall</button>
            <button className="nav-tab">Map</button>
            <button className="nav-tab">Objects</button>
          </nav>
        </header>

        {/* Hero Section */}
        <section className="hero">
          <h2>Find anything you&apos;ve lost</h2>
          <p>
            Ask me where you left your belongings. I remember where everything
            was last seen and will guide you back to it.
          </p>
        </section>

        {/* Voice Interface */}
        <VoiceInterface />

        {/* Quick Actions */}
        <section className="quick-actions">
          <h3>Quick Search</h3>
          <div className="action-grid">
            {[
              { icon: "💧", label: "Water Bottle" },
              { icon: "🔑", label: "Keys" },
              { icon: "🎒", label: "Backpack" },
              { icon: "💻", label: "Laptop" },
              { icon: "📱", label: "Phone" },
              { icon: "👓", label: "Glasses" },
            ].map((item) => (
              <button key={item.label} className="action-button">
                <span className="action-icon">{item.icon}</span>
                <span className="action-label">{item.label}</span>
              </button>
            ))}
          </div>
        </section>

        {/* Recent Activity */}
        <section className="recent-activity">
          <h3>Recent Searches</h3>
          <div className="activity-list">
            <div className="activity-item">
              <span className="activity-icon">🔑</span>
              <div className="activity-details">
                <span className="activity-name">Keys</span>
                <span className="activity-time">Found • 5 min ago</span>
              </div>
              <span className="activity-status found">✓</span>
            </div>
            <div className="activity-item">
              <span className="activity-icon">💧</span>
              <div className="activity-details">
                <span className="activity-name">Water Bottle</span>
                <span className="activity-time">Located • 1 hour ago</span>
              </div>
              <span className="activity-status found">✓</span>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="footer">
        <p>Reality Memory • Built with ❤️ at SandHacks 2025</p>
      </footer>
    </div>
  );
}
