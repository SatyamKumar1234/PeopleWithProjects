'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { HoneypotField, useHoneypot } from '@/lib/honeypot';
import styles from './auth.module.css';

export default function LoginPage() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const { login, loginWithGoogle } = useAuth();
    const { checkSubmission } = useHoneypot();
    const router = useRouter();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        console.log('--- Login Submission Started ---');

        setLoading(true);
        try {
            console.log('Running security honeypot check...');
            const hpResult = await checkSubmission({ email });
            if (hpResult.blocked) {
                console.warn('Submission BLOCKED by honeypot:', hpResult.reasons);
                setError('Suspicious activity detected. Please try again.');
                setLoading(false);
                return;
            }

            console.log('Security check passed. logging in...');
            await login(email, password);

            console.log('Login successful. Redirecting to dashboard...');
            router.push('/dashboard');
        } catch (err) {
            console.error('CRITICAL: Login process failed:', err);
            setError(err.code === 'auth/invalid-credential'
                ? 'Invalid email or password'
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
                    <h1 className={styles.authTitle}>Welcome Back</h1>
                    <p className={styles.authSub}>Sign in to manage your projects</p>
                </div>

                <form onSubmit={handleSubmit} className={styles.authForm}>
                    {error && <div className={styles.authError}>{error}</div>}
                    <HoneypotField />

                    <div className={styles.inputGroup}>
                        <label>Email</label>
                        <input
                            type="email"
                            placeholder="you@example.com"
                            value={email}
                            onChange={e => setEmail(e.target.value)}
                            required
                            id="login-email"
                        />
                    </div>

                    <div className={styles.inputGroup}>
                        <div className={styles.labelRow}>
                            <label>Password</label>
                            <Link href="/forgot-password" className={styles.forgotLink}>Forgot?</Link>
                        </div>
                        <div className={styles.passwordWrap}>
                            <input
                                type={showPassword ? 'text' : 'password'}
                                placeholder="••••••••"
                                value={password}
                                onChange={e => setPassword(e.target.value)}
                                required
                                id="login-password"
                            />
                            <button
                                type="button"
                                className={styles.eyeBtn}
                                onClick={() => setShowPassword(!showPassword)}
                            >
                                {showPassword ? '🙈' : '👁'}
                            </button>
                        </div>
                    </div>

                    <button type="submit" className="btn btn-primary w-full" disabled={loading} id="login-submit">
                        {loading ? <span className="spinner"></span> : 'Log In →'}
                    </button>
                </form>

                <div className={styles.divider}>
                    <span>OR CONTINUE WITH</span>
                </div>

                <button className={styles.googleBtn} onClick={handleGoogle} id="google-login">
                    <svg width="18" height="18" viewBox="0 0 18 18"><path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" /><path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.183l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332C2.438 15.983 5.482 18 9 18z" /><path fill="#FBBC05" d="M3.964 10.708c-.18-.54-.282-1.117-.282-1.708s.102-1.168.282-1.708V4.96H.957C.347 6.175 0 7.55 0 9s.348 2.825.957 4.04l3.007-2.332z" /><path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0 5.482 0 2.438 2.017.957 4.96L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" /></svg>
                    Continue with Google
                </button>

                <p className={styles.authSwitch}>
                    Don't have an account? <Link href="/signup">Sign Up</Link>
                </p>
            </div>
        </div>
    );
}
