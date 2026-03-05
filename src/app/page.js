'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import styles from './landing.module.css';

const TERMINAL_LINES = [
  { text: '$ pwp init my-hackathon', delay: 0 },
  { text: '✔ Workspace created', delay: 800 },
  { text: '✔ 3 collaborators invited', delay: 1400 },
  { text: '✔ Codebase synced — 47 files ready', delay: 2000 },
];

const STATS = [
  { label: '1,200+ Projects', icon: '📁' },
  { label: '4,800+ Collaborators', icon: '👥' },
  { label: 'Firebase Powered', icon: '🔥' },
  { label: 'Free to Start', icon: '✨' },
];

const STEPS = [
  { num: '01', title: 'Upload', desc: 'One folder, your whole codebase. ZIP it, drop it, done.' },
  { num: '02', title: 'Invite', desc: 'Teammates join by email link. Up to 5 per project.' },
  { num: '03', title: 'Build', desc: 'Live cursors, live edits, live presence. Ship together.' },
];

const FEATURES = [
  { title: 'Real-time Editing', desc: 'Debounced, Firebase-safe collaborative editing with conflict resolution.', icon: '⚡' },
  { title: 'Live Presence', desc: 'See exactly who\'s in which file right now with colored cursors.', icon: '👁️' },
  { title: 'Role Permissions', desc: 'Control who can read or write sensitive config files.', icon: '🔒' },
  { title: 'One-Click Upload', desc: 'Upload your folder as ZIP. Replace anytime with one click.', icon: '📤' },
  { title: 'Project Chat', desc: 'Built-in messaging so your team stays in sync inside the editor.', icon: '💬' },
  { title: 'File Snapshots', desc: 'Last 10 saves per file. Never lose work during a sprint.', icon: '📸' },
];

const TECH_ICONS = ['.js', '.tsx', '.py', '.go', '.rs', '.html', '.css', '.json', '.md'];

export default function LandingPage() {
  const { user } = useAuth();
  const [terminalLines, setTerminalLines] = useState([]);
  const [showCursor, setShowCursor] = useState(true);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    TERMINAL_LINES.forEach((line, i) => {
      setTimeout(() => {
        setTerminalLines(prev => [...prev, line.text]);
      }, line.delay + 500);
    });
  }, []);

  useEffect(() => {
    const cursorInterval = setInterval(() => setShowCursor(prev => !prev), 530);
    return () => clearInterval(cursorInterval);
  }, []);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <div className={styles.landing}>
      {/* Navbar */}
      <nav className={`${styles.navbar} ${scrolled ? styles.navScrolled : ''}`}>
        <div className={styles.navInner}>
          <Link href="/" className={styles.logo}>
            <span className={styles.logoIcon}>⟐</span>
            <span className={styles.logoText}>PeopleWithProjects</span>
          </Link>
          <div className={styles.navRight}>
            {user ? (
              <Link href="/dashboard" className="btn btn-primary">Dashboard →</Link>
            ) : (
              <>
                <Link href="/login" className="btn btn-ghost">Log In</Link>
                <Link href="/signup" className="btn btn-primary">Get Started</Link>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className={styles.hero}>
        <div className={styles.dotGrid}></div>
        <div className={styles.heroContent}>
          <h1 className={styles.headline}>
            Code Together.<br />
            <span className={styles.headlineAccent}>Ship Faster.</span>
          </h1>
          <p className={styles.subheadline}>
            Upload your codebase, invite your team, and edit files in real-time — built for hackathon sprints.
          </p>
          <div className={styles.heroCtas}>
            <Link href={user ? "/dashboard" : "/signup"} className="btn btn-primary btn-lg">
              Start Building
            </Link>
            <a href="#how-it-works" className="btn btn-ghost btn-lg">
              See Demo
            </a>
          </div>

          {/* Terminal Mockup */}
          <div className={styles.terminal}>
            <div className={styles.terminalBar}>
              <span className={styles.termDot} style={{ background: '#ff5f57' }}></span>
              <span className={styles.termDot} style={{ background: '#ffbd2e' }}></span>
              <span className={styles.termDot} style={{ background: '#28c840' }}></span>
              <span className={styles.termTitle}>terminal</span>
            </div>
            <div className={styles.terminalBody}>
              {terminalLines.map((line, i) => (
                <div key={i} className={styles.termLine}>
                  {line.startsWith('✔') ? (
                    <span className={styles.termSuccess}>{line}</span>
                  ) : (
                    <span>{line}</span>
                  )}
                </div>
              ))}
              <span className={`${styles.termCursor} ${showCursor ? styles.termCursorVisible : ''}`}>▌</span>
            </div>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className={styles.stats}>
        {STATS.map((stat, i) => (
          <div key={i} className={styles.statItem}>
            <span className={styles.statIcon}>{stat.icon}</span>
            <span className={styles.statLabel}>{stat.label}</span>
          </div>
        ))}
      </section>

      {/* How It Works */}
      <section className={styles.section} id="how-it-works">
        <h2 className={styles.sectionTitle}>How It Works</h2>
        <p className={styles.sectionSub}>Three steps to collaborative coding</p>
        <div className={styles.stepsGrid}>
          {STEPS.map((step, i) => (
            <div key={i} className={styles.stepCard}>
              <span className={styles.stepNum}>{step.num}</span>
              <h3 className={styles.stepTitle}>{step.title}</h3>
              <p className={styles.stepDesc}>{step.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Built for Speed</h2>
        <p className={styles.sectionSub}>Everything you need, nothing you don't</p>
        <div className={styles.featuresGrid}>
          {FEATURES.map((feat, i) => (
            <div key={i} className={styles.featureCard}>
              <span className={styles.featureIcon}>{feat.icon}</span>
              <h3 className={styles.featureTitle}>{feat.title}</h3>
              <p className={styles.featureDesc}>{feat.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Tech Stack */}
      <section className={styles.techStrip}>
        <p className={styles.techLabel}>Works with any stack</p>
        <div className={styles.techIcons}>
          {TECH_ICONS.map((ext, i) => (
            <span key={i} className={styles.techIcon}>{ext}</span>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className={styles.footer}>
        <div className={styles.footerInner}>
          <div className={styles.footerLeft}>
            <span className={styles.logoIcon}>⟐</span>
            <span>PeopleWithProjects</span>
          </div>
          <div className={styles.footerLinks}>
            <Link href="/login">Login</Link>
            <Link href="/signup">Sign Up</Link>
            <a href="#how-it-works">How It Works</a>
          </div>
          <div className={styles.footerRight}>
            <span className="font-mono text-muted">PWP Core v1.0 — Built for builders</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
