'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { HoneypotField, useHoneypot } from '@/lib/honeypot';
import styles from '../login/auth.module.css';

function getPasswordStrength(password) {
    let score = 0;
    if (password.length >= 8) score++;
    if (/[A-Z]/.test(password)) score++;
    if (/[0-9]/.test(password)) score++;
    if (/[^A-Za-z0-9]/.test(password)) score++;
    if (password.length >= 12) score++;
    return score;
}

const STRENGTH_LABELS = ['Very Weak', 'Weak', 'Fair', 'Strong', 'Very Strong'];
const STRENGTH_COLORS = ['#ea4335', '#ff6d01', '#fbbc05', '#34a853', '#00c853'];

export default function SignUpPage() {
    const [fullName, setFullName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [agreed, setAgreed] = useState(false);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const { signup, loginWithGoogle } = useAuth();
    const { checkSubmission } = useHoneypot();
    const router = useRouter();

    const strength = getPasswordStrength(password);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        console.log('--- Signup Submission Started ---');

        if (password !== confirmPassword) {
            setError('Passwords do not match');
            return;
        }
        if (password.length < 6) {
            setError('Password must be at least 6 characters');
            return;
        }
        if (!agreed) {
            setError('Please accept the terms');
            return;
        }

        setLoading(true);
        try {
            console.log('Running security honeypot check...');
            const hpResult = await checkSubmission({ fullName, email });
            if (hpResult.blocked) {
                console.warn('Submission BLOCKED by honeypot:', hpResult.reasons);
                setError('Suspicious activity detected. Please try again.');
                setLoading(false);
                return;
            }

            console.log('Security check passed. Creating user profile...');
            await signup(email, password, fullName);

            console.log('Signup completed successfully. Redirecting to dashboard...');
            router.push('/dashboard');
        } catch (err) {
            console.error('CRITICAL: Signup process failed:', err);
            setError(err.code === 'auth/email-already-in-use'
                ? 'An account with this email already exists'
                : err.message);
        }
        setLoading(false);
    };

    const handleGoogle = async () => {
        setError('');
        try {
            await loginWithGoogle();
            router.push('/dashboard');
        } catch (err) {
            setError(err.message);
        }
    };

    return (
        <div className={styles.authPage}>
            <div className={styles.authCard}>
                <div className={styles.authHeader}>
                    <Link href="/" className={styles.authLogo}>
                        <span className={styles.logoIcon}>⟐</span>
                        <span>PWP</span>
                    </Link>
                    <h1 className={styles.authTitle}>Create Account</h1>
                    <p className={styles.authSub}>Start building with your team</p>
                </div>

                <form onSubmit={handleSubmit} className={styles.authForm}>
                    {error && <div className={styles.authError}>{error}</div>}
                    <HoneypotField />

                    <div className={styles.inputGroup}>
                        <label>Full Name</label>
                        <input
                            type="text"
                            placeholder="John Doe"
                            value={fullName}
                            onChange={e => setFullName(e.target.value)}
                            required
                            id="signup-name"
                        />
                    </div>

                    <div className={styles.inputGroup}>
                        <label>Email</label>
                        <input
                            type="email"
                            placeholder="you@example.com"
                            value={email}
                            onChange={e => setEmail(e.target.value)}
                            required
                            id="signup-email"
                        />
                    </div>

                    <div className={styles.inputGroup}>
                        <label>Password</label>
                        <div className={styles.passwordWrap}>
                            <input
                                type={showPassword ? 'text' : 'password'}
                                placeholder="••••••••"
                                value={password}
                                onChange={e => setPassword(e.target.value)}
                                required
                                id="signup-password"
                            />
                            <button
                                type="button"
                                className={styles.eyeBtn}
                                onClick={() => setShowPassword(!showPassword)}
                            >
                                {showPassword ? '🙈' : '👁'}
                            </button>
                        </div>
                        {password && (
                            <div className={styles.strengthBar}>
                                <div className={styles.strengthTrack}>
                                    <div
                                        className={styles.strengthFill}
                                        style={{
                                            width: `${(strength / 5) * 100}%`,
                                            background: STRENGTH_COLORS[strength - 1] || '#ea4335'
                                        }}
                                    />
                                </div>
                                <span className={styles.strengthLabel} style={{ color: STRENGTH_COLORS[strength - 1] }}>
                                    {STRENGTH_LABELS[strength - 1] || 'Very Weak'}
                                </span>
                            </div>
                        )}
                    </div>

                    <div className={styles.inputGroup}>
                        <label>Confirm Password</label>
                        <input
                            type="password"
                            placeholder="••••••••"
                            value={confirmPassword}
                            onChange={e => setConfirmPassword(e.target.value)}
                            required
                            id="signup-confirm"
                        />
                    </div>

                    <label className={styles.checkboxLabel}>
                        <input
                            type="checkbox"
                            checked={agreed}
                            onChange={e => setAgreed(e.target.checked)}
                            id="signup-terms"
                        />
                        <span>I agree to the Terms of Service and Privacy Policy</span>
                    </label>

                    <button type="submit" className="btn btn-primary w-full" disabled={loading} id="signup-submit">
                        {loading ? <span className="spinner"></span> : 'Create Account'}
                    </button>
                </form>

                <div className={styles.divider}>
                    <span>OR CONTINUE WITH</span>
                </div>

                <button className={styles.googleBtn} onClick={handleGoogle} id="google-signup">
                    <svg width="18" height="18" viewBox="0 0 18 18"><path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" /><path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.183l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332C2.438 15.983 5.482 18 9 18z" /><path fill="#FBBC05" d="M3.964 10.708c-.18-.54-.282-1.117-.282-1.708s.102-1.168.282-1.708V4.96H.957C.347 6.175 0 7.55 0 9s.348 2.825.957 4.04l3.007-2.332z" /><path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0 5.482 0 2.438 2.017.957 4.96L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" /></svg>
                    Continue with Google
                </button>

                <p className={styles.authSwitch}>
                    Already have an account? <Link href="/login">Log In</Link>
                </p>
            </div>
        </div>
    );
}
