/**
 * SSL Honeypot — Main Module
 * React context, hooks, and invisible honeypot field component
 * Drop into any React project. Stores flagged attempts in Firestore.
 * 
 * Usage:
 *   1. Wrap app with <HoneypotProvider>
 *   2. Add <HoneypotField /> inside forms
 *   3. Use useHoneypot() hook to check submissions
 */

'use client';
import { createContext, useContext, useState, useEffect, useRef } from 'react';
import { collection, addDoc, getDocs, query, where, orderBy, limit, serverTimestamp } from 'firebase/firestore';
import { analyzeInput, checkRateLimit, getBrowserFingerprint, detectBot } from './detector';

const HoneypotContext = createContext({});

/**
 * Get the client's IP address using a free API
 * Falls back to fingerprint if API fails
 */
async function getClientIP() {
    try {
        const res = await fetch('https://api.ipify.org?format=json');
        const data = await res.json();
        return data.ip;
    } catch (e) {
        return 'unknown-' + getBrowserFingerprint();
    }
}

/**
 * HoneypotProvider — Wrap your app or auth pages with this
 * @param {Object} props
 * @param {Object} props.db - Firestore database instance
 * @param {React.ReactNode} props.children
 * @param {string} [props.collectionName='honeypot_logs'] - Firestore collection name
 */
export function HoneypotProvider({ db, children, collectionName = 'honeypot_logs' }) {
    const [formLoadTime] = useState(Date.now());
    const [hasMouseMoved, setHasMouseMoved] = useState(false);
    const [clientIP, setClientIP] = useState(null);
    const honeypotValueRef = useRef('');

    useEffect(() => {
        getClientIP().then(setClientIP);

        const handleMouse = () => setHasMouseMoved(true);
        window.addEventListener('mousemove', handleMouse, { once: true });
        return () => window.removeEventListener('mousemove', handleMouse);
    }, []);

    const setHoneypotValue = (val) => {
        honeypotValueRef.current = val;
    };

    /**
     * Check a form submission for threats
     * Call this before processing login/signup
     * @param {Object} fields - Form field values to analyze
     * @returns {Promise<{ blocked: boolean, reasons: string[], score: number }>}
     */
    const checkSubmission = async (fields = {}) => {
        const reasons = [];
        let totalScore = 0;

        // 1. Bot detection (honeypot + timing)
        const botResult = detectBot(formLoadTime, !!honeypotValueRef.current);
        if (botResult.isBot) {
            reasons.push(...botResult.reasons);
            totalScore += 50;
        }

        // 2. No mouse movement
        if (!hasMouseMoved) {
            reasons.push('NO_MOUSE_MOVEMENT');
            totalScore += 15;
        }

        // 3. Analyze all input fields for threats
        for (const [fieldName, value] of Object.entries(fields)) {
            const analysis = analyzeInput(value);
            if (analysis.isThreat) {
                reasons.push(...analysis.threats.map(t => `${fieldName}:${t}`));
                totalScore += analysis.score;
            }
        }

        // 4. Rate limiting (check previous attempts from this IP)
        if (db && clientIP) {
            try {
                const attemptsQuery = query(
                    collection(db, collectionName),
                    where('ip', '==', clientIP),
                    orderBy('timestamp', 'desc'),
                    limit(20)
                );
                const snap = await getDocs(attemptsQuery);
                const attempts = snap.docs.map(d => d.data());
                const rateResult = checkRateLimit(attempts);
                if (rateResult.blocked) {
                    reasons.push('RATE_LIMITED');
                    totalScore += 100;
                }
            } catch (e) {
                // Firestore might not have the index yet, continue
            }
        }

        const blocked = totalScore >= 40;

        // Log if suspicious
        if (blocked && db) {
            try {
                await addDoc(collection(db, collectionName), {
                    ip: clientIP || 'unknown',
                    fingerprint: getBrowserFingerprint(),
                    reasons,
                    score: totalScore,
                    fields: Object.keys(fields),
                    userAgent: navigator.userAgent,
                    timestamp: serverTimestamp(),
                    blocked: true,
                });
            } catch (e) {
                console.warn('Honeypot: Failed to log threat', e);
            }
        }

        return { blocked, reasons, score: totalScore };
    };

    /**
     * Log a successful or failed auth attempt (for rate limiting)
     * @param {string} email - Email used
     * @param {string} action - 'login' | 'signup' | 'reset'
     * @param {boolean} success - Whether the attempt succeeded
     */
    const logAttempt = async (email, action, success = false) => {
        if (!db) return;
        try {
            await addDoc(collection(db, collectionName), {
                ip: clientIP || 'unknown',
                fingerprint: getBrowserFingerprint(),
                email: email ? email.substring(0, 3) + '***' : 'unknown', // partial for privacy
                action,
                success,
                timestamp: serverTimestamp(),
                blocked: false,
            });
        } catch (e) {
            // Silent fail
        }
    };

    return (
        <HoneypotContext.Provider value={{ checkSubmission, logAttempt, setHoneypotValue }}>
            {children}
        </HoneypotContext.Provider>
    );
}

/**
 * Hook to access honeypot functions
 * @returns {{ checkSubmission: Function, logAttempt: Function }}
 */
export function useHoneypot() {
    return useContext(HoneypotContext);
}

/**
 * Invisible honeypot field — add inside <form> elements
 * Hidden from real users via CSS, bots will fill it
 * If filled → bot detected → submission blocked
 */
export function HoneypotField() {
    const { setHoneypotValue } = useContext(HoneypotContext);

    return (
        <div
            style={{
                position: 'absolute',
                left: '-9999px',
                top: '-9999px',
                width: 0,
                height: 0,
                overflow: 'hidden',
                opacity: 0,
                pointerEvents: 'none',
                tabIndex: -1,
            }}
            aria-hidden="true"
        >
            {/* These field names look legitimate to bots */}
            <input
                type="text"
                name="website"
                tabIndex={-1}
                autoComplete="off"
                onChange={e => setHoneypotValue(e.target.value)}
            />
            <input
                type="text"
                name="phone_number"
                tabIndex={-1}
                autoComplete="off"
                onChange={e => setHoneypotValue(e.target.value)}
            />
        </div>
    );
}

/**
 * Standalone function for non-React usage
 * @param {Object} fields - { email, password, ... }
 * @returns {{ isThreat: boolean, threats: string[] }}
 */
export function quickCheck(fields) {
    const allThreats = [];
    for (const [key, value] of Object.entries(fields)) {
        const result = analyzeInput(value);
        if (result.isThreat) {
            allThreats.push(...result.threats.map(t => `${key}:${t}`));
        }
    }
    return {
        isThreat: allThreats.length > 0,
        threats: allThreats,
    };
}
