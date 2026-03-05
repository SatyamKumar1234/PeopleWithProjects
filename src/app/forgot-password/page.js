'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import styles from '../login/auth.module.css';

export default function ForgotPasswordPage() {
    const [email, setEmail] = useState('');
    const [sent, setSent] = useState(false);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const { resetPassword } = useAuth();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        try {
            await resetPassword(email);
            setSent(true);
        } catch (err) {
            setError(err.code === 'auth/user-not-found'
                ? 'No account found with that email'
                : err.message);
        }
        setLoading(false);
    };

    return (
        <div className={styles.authPage}>
            <div className={styles.authCard}>
                <div className={styles.authHeader}>
                    <Link href="/" className={styles.authLogo}>
                        <span className={styles.logoIcon}>⟐</span>
                        <span>PWP</span>
                    </Link>
                    {sent ? (
                        <>
                            <div className={styles.successIcon}>✔</div>
                            <h1 className={styles.authTitle}>Check Your Inbox</h1>
                            <p className={styles.authSub}>We sent a password reset link to <strong>{email}</strong></p>
                        </>
                    ) : (
                        <>
                            <h1 className={styles.authTitle}>Reset Password</h1>
                            <p className={styles.authSub}>Enter your email and we'll send a reset link</p>
                        </>
                    )}
                </div>

                {!sent && (
                    <form onSubmit={handleSubmit} className={styles.authForm}>
                        {error && <div className={styles.authError}>{error}</div>}

                        <div className={styles.inputGroup}>
                            <label>Email</label>
                            <input
                                type="email"
                                placeholder="you@example.com"
                                value={email}
                                onChange={e => setEmail(e.target.value)}
                                required
                                id="forgot-email"
                            />
                        </div>

                        <button type="submit" className="btn btn-primary w-full" disabled={loading} id="forgot-submit">
                            {loading ? <span className="spinner"></span> : 'Send Reset Link'}
                        </button>
                    </form>
                )}

                <p className={styles.authSwitch}>
                    <Link href="/login">← Back to Log In</Link>
                </p>
            </div>
        </div>
    );
}
