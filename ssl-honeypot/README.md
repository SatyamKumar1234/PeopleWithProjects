# SSL Honeypot — Lightweight Auth Page Security Module

A standalone, portable security module that detects and logs suspicious activity on login/signup pages. Works with any project — just drop it in and integrate.

## What It Does

- **Invisible honeypot fields** on login/signup forms (hidden from real users, filled by bots)
- **IP logging** on every auth attempt
- **Rate limiting** — blocks IPs with too many failed attempts
- **Input anomaly detection** — flags suspicious patterns (SQL injection, XSS, rapid submissions)
- **Stores flagged attempts** in Firestore for review
- **Zero impact on UX** — completely invisible to legitimate users

## Integration

```jsx
import { HoneypotProvider, useHoneypot, HoneypotField } from './ssl-honeypot';

// Wrap your app
<HoneypotProvider>
  <App />
</HoneypotProvider>

// In your login form
function LoginForm() {
  const { checkSubmission, logAttempt } = useHoneypot();

  const handleSubmit = async (e) => {
    e.preventDefault();
    const result = await checkSubmission();
    if (result.blocked) {
      // Bot or attacker detected
      return;
    }
    await logAttempt(email, 'login');
    // ... proceed with login
  };

  return (
    <form>
      <HoneypotField /> {/* Invisible to users, catches bots */}
      <input name="email" ... />
      <input name="password" ... />
    </form>
  );
}
```

## Files
- `index.js` — Main module (context, hooks, components)
- `detector.js` — Threat detection logic
- `README.md` — This file
