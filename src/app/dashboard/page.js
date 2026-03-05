'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { collection, query, where, onSnapshot, doc, deleteDoc, updateDoc, arrayRemove, getDocs } from 'firebase/firestore';
import { ref as storageRef, deleteObject } from 'firebase/storage';
import { db, storage } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';
import AuthGuard from '@/components/AuthGuard';
import AppNavbar from '@/components/AppNavbar';
import { getInitials, getTimeSince, formatBytes, LIMITS, MEMBER_COLORS } from '@/lib/constants';
import styles from './dashboard.module.css';

function ConfirmModal({ title, message, confirmText, onConfirm, onCancel, requireTyping, typingTarget }) {
    const [typed, setTyped] = useState('');
    const canConfirm = requireTyping ? typed === typingTarget : true;
    return (
        <div className="modal-overlay" onClick={onCancel}>
            <div className="modal" onClick={e => e.stopPropagation()}>
                <h3>{title}</h3>
                <p>{message}</p>
                {requireTyping && (
                    <input
                        type="text"
                        placeholder={`Type "${typingTarget}" to confirm`}
                        value={typed}
                        onChange={e => setTyped(e.target.value)}
                        style={{ marginBottom: 16 }}
                    />
                )}
                <div className="modal-actions">
                    <button className="btn btn-ghost" onClick={onCancel}>Cancel</button>
                    <button className="btn btn-danger" onClick={onConfirm} disabled={!canConfirm}>{confirmText || 'Delete'}</button>
                </div>
            </div>
        </div>
    );
}

function DashboardContent() {
    const { user } = useAuth();
    const router = useRouter();
    const [projects, setProjects] = useState([]);
    const [loading, setLoading] = useState(true);
    const [menuOpen, setMenuOpen] = useState(null);
    const [deleteModal, setDeleteModal] = useState(null);

    useEffect(() => {
        if (!user?.uid) return;
        const q = query(collection(db, 'projects'), where('memberIds', 'array-contains', user.uid));
        const unsubscribe = onSnapshot(q, (snap) => {
            setProjects(snap.docs.map(d => ({ id: d.id, ...d.data() })));
            setLoading(false);
        });
        return () => unsubscribe();
    }, [user]);

    const handleDelete = async (project) => {
        try {
            // Delete files subcollection
            const filesSnap = await getDocs(collection(db, 'projects', project.id, 'files'));
            for (const fileDoc of filesSnap.docs) {
                await deleteDoc(fileDoc.ref);
            }
            // Delete chat subcollection
            const chatSnap = await getDocs(collection(db, 'projects', project.id, 'chat'));
            for (const chatDoc of chatSnap.docs) {
                await deleteDoc(chatDoc.ref);
            }
            // Try to delete storage
            try {
                const zipRef = storageRef(storage, `projects/${project.id}/codebase.zip`);
                await deleteObject(zipRef);
            } catch (e) { /* Storage might not exist */ }
            // Delete project doc
            await deleteDoc(doc(db, 'projects', project.id));
            setDeleteModal(null);
        } catch (err) {
            console.error('Delete failed:', err);
        }
    };

    const handleLeave = async (project) => {
        await updateDoc(doc(db, 'projects', project.id), {
            memberIds: arrayRemove(user.uid)
        });
    };

    const totalStorage = projects.reduce((acc, p) => acc + (p.fileCount || 0) * 500, 0); // rough estimate
    const totalMembers = projects.reduce((acc, p) => acc + (p.memberIds?.length || 0), 0);

    return (
        <div className={styles.dashboard}>
            <AppNavbar />
            <div className={styles.content}>
                <div className={styles.header}>
                    <h1 className={styles.title}>My Projects</h1>
                    <p className={styles.subtitle}>Build, collaborate, ship.</p>
                </div>

                {/* Limits Bar */}
                <div className={styles.limitsBar}>
                    <div className={styles.limitItem}>
                        <span className={styles.limitLabel}>Projects</span>
                        <div className={styles.limitTrack}>
                            <div className={styles.limitFill} style={{ width: `${(projects.length / LIMITS.MAX_PROJECTS_PER_USER) * 100}%` }} />
                        </div>
                        <span className={styles.limitValue}>{projects.length}/{LIMITS.MAX_PROJECTS_PER_USER}</span>
                    </div>
                    <div className={styles.limitItem}>
                        <span className={styles.limitLabel}>Members Total</span>
                        <div className={styles.limitTrack}>
                            <div className={styles.limitFill} style={{ width: `${Math.min((totalMembers / 15) * 100, 100)}%` }} />
                        </div>
                        <span className={styles.limitValue}>{totalMembers}/15</span>
                    </div>
                </div>

                {loading ? (
                    <div className="flex items-center justify-center" style={{ padding: 80 }}>
                        <div className="spinner" style={{ width: 32, height: 32 }}></div>
                    </div>
                ) : (
                    <div className={styles.grid}>
                        {projects.map((project) => (
                            <div
                                key={project.id}
                                className={styles.projectCard}
                                onClick={() => router.push(`/project/${project.id}`)}
                            >
                                <div className={styles.cardTop}>
                                    <h3 className={styles.projectName}>{project.name}</h3>
                                    <div className={styles.menuWrap}>
                                        <button
                                            className={styles.menuBtn}
                                            onClick={e => { e.stopPropagation(); setMenuOpen(menuOpen === project.id ? null : project.id); }}
                                        >⋯</button>
                                        {menuOpen === project.id && (
                                            <>
                                                <div className={styles.menuOverlay} onClick={e => { e.stopPropagation(); setMenuOpen(null); }} />
                                                <div className={styles.menu} onClick={e => e.stopPropagation()}>
                                                    {project.ownerId === user.uid ? (
                                                        <button className={styles.menuItem} onClick={() => { setMenuOpen(null); setDeleteModal(project); }}>
                                                            🗑 Delete Project
                                                        </button>
                                                    ) : (
                                                        <button className={styles.menuItem} onClick={() => { setMenuOpen(null); handleLeave(project); }}>
                                                            🚪 Leave Project
                                                        </button>
                                                    )}
                                                </div>
                                            </>
                                        )}
                                    </div>
                                </div>
                                <p className={styles.cardTime}>{getTimeSince(project.lastEditedAt || project.createdAt)}</p>
                                <div className={styles.cardBottom}>
                                    <div className={styles.avatarStack}>
                                        {(project.memberIds || []).slice(0, 4).map((mid, i) => (
                                            <div key={mid} className={styles.miniAvatar} style={{ background: MEMBER_COLORS[i], zIndex: 4 - i }}>
                                                {(mid === user.uid ? getInitials(user.displayName) : '??')}
                                            </div>
                                        ))}
                                        {(project.memberIds || []).length > 4 && (
                                            <div className={styles.miniAvatar} style={{ background: '#333' }}>
                                                +{project.memberIds.length - 4}
                                            </div>
                                        )}
                                    </div>
                                    <div className={styles.syncDot} style={{ background: '#34a853' }} title="Synced" />
                                </div>
                            </div>
                        ))}

                        {/* New Project Card */}
                        {projects.length < LIMITS.MAX_PROJECTS_PER_USER && (
                            <div
                                className={styles.newProjectCard}
                                onClick={() => router.push('/project/new')}
                            >
                                <span className={styles.newProjectIcon}>+</span>
                                <span className={styles.newProjectText}>New Project</span>
                            </div>
                        )}

                        {projects.length >= LIMITS.MAX_PROJECTS_PER_USER && (
                            <div className={styles.limitCard}>
                                <span>🔒</span>
                                <p>Project limit reached ({LIMITS.MAX_PROJECTS_PER_USER}/{LIMITS.MAX_PROJECTS_PER_USER})</p>
                                <small>Delete a project to create a new one</small>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {deleteModal && (
                <ConfirmModal
                    title="Delete Project"
                    message={`This will permanently delete "${deleteModal.name}" and all its files. This cannot be undone.`}
                    confirmText="Delete Project"
                    requireTyping={true}
                    typingTarget={deleteModal.name}
                    onConfirm={() => handleDelete(deleteModal)}
                    onCancel={() => setDeleteModal(null)}
                />
            )}
        </div>
    );
}

export default function DashboardPage() {
    return (
        <AuthGuard>
            <DashboardContent />
        </AuthGuard>
    );
}
