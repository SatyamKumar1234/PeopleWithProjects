'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { getInitials } from '@/lib/constants';
import styles from './appnav.module.css';

export default function AppNavbar() {
    const { user, logout } = useAuth();
    const [showDropdown, setShowDropdown] = useState(false);
    const router = useRouter();

    const handleLogout = async () => {
        await logout();
        router.push('/');
    };

    return (
        <nav className={styles.nav}>
            <div className={styles.navInner}>
                <Link href="/dashboard" className={styles.logo}>
                    <span className={styles.logoIcon}>⟐</span>
                    <span className={styles.logoText}>PWP</span>
                </Link>

                <div className={styles.searchWrap}>
                    <input
                        className={styles.searchInput}
                        type="text"
                        placeholder="Search projects..."
                        id="nav-search"
                    />
                </div>

                <div className={styles.navRight}>
                    <button className={styles.iconBtn} title="Notifications" id="nav-bell">
                        🔔
                    </button>
                    <button className={styles.iconBtn} title="Settings" id="nav-settings">
                        ⚙️
                    </button>
                    <div className={styles.avatarWrap}>
                        <button
                            className={styles.avatar}
                            onClick={() => setShowDropdown(!showDropdown)}
                            id="nav-avatar"
                        >
                            {user?.photoURL ? (
                                <img src={user.photoURL} alt="" className={styles.avatarImg} />
                            ) : (
                                <span>{getInitials(user?.displayName)}</span>
                            )}
                        </button>
                        {showDropdown && (
                            <>
                                <div className={styles.dropdownOverlay} onClick={() => setShowDropdown(false)} />
                                <div className={styles.dropdown}>
                                    <div className={styles.dropdownHeader}>
                                        <strong>{user?.displayName}</strong>
                                        <span>{user?.email}</span>
                                    </div>
                                    <div className={styles.dropdownDivider} />
                                    <Link href="/dashboard" className={styles.dropdownItem} onClick={() => setShowDropdown(false)}>
                                        📁 Projects
                                    </Link>
                                    <button className={styles.dropdownItem} onClick={handleLogout}>
                                        🚪 Sign Out
                                    </button>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            </div>
        </nav>
    );
}
