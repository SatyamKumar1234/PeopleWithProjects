/**
 * SSL Honeypot — Threat Detection Logic
 * Detects bots, SQL injection, XSS, and suspicious patterns
 * Standalone module — works with any project
 */

// Known SQL injection patterns
const SQL_PATTERNS = [
    /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|UNION|ALTER|CREATE|EXEC)\b)/i,
    /(--|;|'|"|\\x|0x)/,
    /(\bOR\b\s+\d+\s*=\s*\d+)/i,
    /(\bAND\b\s+\d+\s*=\s*\d+)/i,
    /(SLEEP\s*\()/i,
    /(BENCHMARK\s*\()/i,
];

// Known XSS patterns  
const XSS_PATTERNS = [
    /<script[\s>]/i,
    /javascript:/i,
    /on\w+\s*=/i,
    /<iframe/i,
    /<object/i,
    /<embed/i,
    /(alert|confirm|prompt)\s*\(/i,
    /document\.(cookie|write|location)/i,
    /eval\s*\(/i,
];

// Suspicious email patterns
const SUSPICIOUS_EMAIL_PATTERNS = [
    /test@test/i,
    /admin@admin/i,
    /root@/i,
    /hack/i,
    /inject/i,
    /<[^>]+>/,
];

/**
 * Analyzes an input string for threats
 * @param {string} input - The input to analyze
 * @returns {{ isThreat: boolean, threats: string[], score: number }}
 */
export function analyzeInput(input) {
    if (!input || typeof input !== 'string') {
        return { isThreat: false, threats: [], score: 0 };
    }

    const threats = [];
    let score = 0;

    // Check SQL injection
    for (const pattern of SQL_PATTERNS) {
        if (pattern.test(input)) {
            threats.push('SQL_INJECTION');
            score += 30;
            break;
        }
    }

    // Check XSS
    for (const pattern of XSS_PATTERNS) {
        if (pattern.test(input)) {
            threats.push('XSS_ATTEMPT');
            score += 30;
            break;
        }
    }

    // Check suspicious email
    for (const pattern of SUSPICIOUS_EMAIL_PATTERNS) {
        if (pattern.test(input)) {
            threats.push('SUSPICIOUS_EMAIL');
            score += 15;
            break;
        }
    }

    // Excessive length (possible buffer overflow attempt)
    if (input.length > 500) {
        threats.push('EXCESSIVE_LENGTH');
        score += 20;
    }

    // Contains null bytes
    if (input.includes('\0') || input.includes('%00')) {
        threats.push('NULL_BYTE');
        score += 25;
    }

    // Path traversal
    if (input.includes('../') || input.includes('..\\')) {
        threats.push('PATH_TRAVERSAL');
        score += 25;
    }

    return {
        isThreat: score >= 25,
        threats,
        score: Math.min(score, 100),
    };
}

/**
 * Checks if an IP should be rate limited
 * @param {Object[]} attempts - Previous attempts from this IP
 * @param {number} windowMs - Time window in milliseconds (default 15 minutes)
 * @param {number} maxAttempts - Max attempts in window (default 10)
 * @returns {{ blocked: boolean, remaining: number, resetAt: Date }}
 */
export function checkRateLimit(attempts, windowMs = 15 * 60 * 1000, maxAttempts = 10) {
    const now = Date.now();
    const windowStart = now - windowMs;
    const recentAttempts = attempts.filter(a => {
        const ts = a.timestamp instanceof Date ? a.timestamp.getTime() :
            a.timestamp?.toDate ? a.timestamp.toDate().getTime() :
                new Date(a.timestamp).getTime();
        return ts > windowStart;
    });

    return {
        blocked: recentAttempts.length >= maxAttempts,
        remaining: Math.max(0, maxAttempts - recentAttempts.length),
        resetAt: new Date(now + windowMs),
        attemptCount: recentAttempts.length,
    };
}

/**
 * Generates a fingerprint from browser info
 * @returns {string} Browser fingerprint hash
 */
export function getBrowserFingerprint() {
    if (typeof window === 'undefined') return 'server';

    const components = [
        navigator.userAgent,
        navigator.language,
        screen.width + 'x' + screen.height,
        screen.colorDepth,
        new Date().getTimezoneOffset(),
        navigator.hardwareConcurrency || 'unknown',
        navigator.platform,
    ];

    // Simple hash
    const str = components.join('|');
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
    }
    return Math.abs(hash).toString(36);
}

/**
 * Detects if a form submission is likely from a bot
 * @param {number} formLoadTime - When the form was loaded (timestamp)
 * @param {boolean} honeypotFilled - Whether the honeypot field was filled
 * @returns {{ isBot: boolean, reasons: string[] }}
 */
export function detectBot(formLoadTime, honeypotFilled) {
    const reasons = [];

    // Honeypot field was filled (invisible to humans)
    if (honeypotFilled) {
        reasons.push('HONEYPOT_TRIGGERED');
    }

    // Form submitted too fast (< 2 seconds)
    const timeTaken = Date.now() - formLoadTime;
    if (timeTaken < 2000) {
        reasons.push('TOO_FAST_SUBMISSION');
    }

    // No mouse movement detected (would need to be tracked externally)
    // This is handled by the HoneypotProvider component

    return {
        isBot: reasons.length > 0,
        reasons,
        timeTaken,
    };
}
