'use client';
import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import JSZip from 'jszip';
import { collection, doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { ref as storageRef, uploadBytesResumable } from 'firebase/storage';
import { db, storage } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';
import AuthGuard from '@/components/AuthGuard';
import AppNavbar from '@/components/AppNavbar';
import { LIMITS, isSensitiveFile, getFileIcon } from '@/lib/constants';
import styles from './newproject.module.css';

function NewProjectContent() {
    const { user } = useAuth();
    const router = useRouter();
    const fileInputRef = useRef(null);

    const [step, setStep] = useState(1);
    const [projectName, setProjectName] = useState('');
    const [zipFile, setZipFile] = useState(null);
    const [fileTree, setFileTree] = useState([]);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [uploading, setUploading] = useState(false);
    const [memberEmails, setMemberEmails] = useState([]);
    const [emailInput, setEmailInput] = useState('');
    const [permissions, setPermissions] = useState({});
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    // Step 1: Handle ZIP upload
    const handleFileSelect = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        if (!file.name.endsWith('.zip')) {
            setError('Only .zip files are allowed');
            return;
        }
        if (file.size > LIMITS.MAX_PROJECT_SIZE_BYTES) {
            setError(`File too large. Max size is ${LIMITS.MAX_PROJECT_SIZE_MB}MB`);
            return;
        }

        setError('');
        setZipFile(file);

        try {
            const zip = await JSZip.loadAsync(file);
            const files = [];
            zip.forEach((path, entry) => {
                if (!entry.dir && !path.startsWith('__MACOSX') && !path.startsWith('.')) {
                    files.push({
                        path,
                        size: entry._data?.uncompressedSize || 0,
                        isDir: false,
                    });
                }
            });
            setFileTree(files);

            // Auto-set permissions for sensitive files
            const perms = {};
            files.forEach(f => {
                perms[f.path] = isSensitiveFile(f.path) ? 'restricted' : 'readwrite';
            });
            setPermissions(perms);
        } catch (err) {
            setError('Failed to read ZIP file');
        }
    };

    // Step 2: Add members
    const addMember = () => {
        if (!emailInput.trim()) return;
        if (memberEmails.length >= LIMITS.MAX_MEMBERS_PER_PROJECT - 1) {
            setError(`Max ${LIMITS.MAX_MEMBERS_PER_PROJECT} members per project (including you)`);
            return;
        }
        if (emailInput === user.email) {
            setError("You're already a member");
            return;
        }
        if (memberEmails.includes(emailInput)) {
            setError('Already added');
            return;
        }
        setMemberEmails([...memberEmails, emailInput.trim()]);
        setEmailInput('');
        setError('');
    };

    const removeMember = (email) => {
        setMemberEmails(memberEmails.filter(e => e !== email));
    };

    // Step 3: Toggle permission
    const togglePermission = (path) => {
        setPermissions(prev => ({
            ...prev,
            [path]: prev[path] === 'restricted' ? 'readwrite' : 'restricted'
        }));
    };

    const setAllPermissions = (level) => {
        const newPerms = {};
        fileTree.forEach(f => { newPerms[f.path] = level; });
        setPermissions(newPerms);
    };

    // Save project
    const handleComplete = async () => {
        if (!projectName.trim()) { setError('Project name is required'); return; }
        if (!zipFile) { setError('Please upload a ZIP file'); return; }

        setSaving(true);
        setError('');

        try {
            const projectId = doc(collection(db, 'projects')).id;

            // Upload ZIP to Firebase Storage
            setUploading(true);
            const zipStorageRef = storageRef(storage, `projects/${projectId}/codebase.zip`);
            const uploadTask = uploadBytesResumable(zipStorageRef, zipFile);

            await new Promise((resolve, reject) => {
                uploadTask.on('state_changed',
                    (snap) => setUploadProgress((snap.bytesTransferred / snap.totalBytes) * 100),
                    reject,
                    resolve
                );
            });
            setUploading(false);

            // Parse ZIP and write files to Firestore
            const zip = await JSZip.loadAsync(zipFile);
            const writePromises = [];

            zip.forEach((path, entry) => {
                if (!entry.dir && !path.startsWith('__MACOSX') && !path.startsWith('.')) {
                    const promise = entry.async('string').then(content => {
                        if (content.length <= LIMITS.MAX_FILE_SIZE_BYTES) {
                            const encodedPath = path.replace(/\//g, '__');
                            return setDoc(doc(db, 'projects', projectId, 'files', encodedPath), {
                                path,
                                content,
                                language: path.split('.').pop() || 'text',
                                lastEditedBy: user.uid,
                                lastEditedAt: serverTimestamp(),
                            });
                        }
                    });
                    writePromises.push(promise);
                }
            });

            await Promise.all(writePromises);

            // Write permissions
            for (const [path, level] of Object.entries(permissions)) {
                const encodedPath = path.replace(/\//g, '__');
                await setDoc(doc(db, 'projects', projectId, 'permissions', encodedPath), {
                    path,
                    level,
                });
            }

            // Create project document
            await setDoc(doc(db, 'projects', projectId), {
                name: projectName,
                ownerId: user.uid,
                memberIds: [user.uid],
                pendingInvites: memberEmails,
                createdAt: serverTimestamp(),
                lastEditedAt: serverTimestamp(),
                hasFolder: true,
                folderName: zipFile.name,
                fileCount: fileTree.length,
            });

            // Create invites
            for (const email of memberEmails) {
                const inviteId = doc(collection(db, 'invites')).id;
                await setDoc(doc(db, 'invites', inviteId), {
                    projectId,
                    projectName,
                    invitedEmail: email,
                    invitedBy: user.uid,
                    invitedByName: user.displayName,
                    status: 'pending',
                    createdAt: serverTimestamp(),
                });
            }

            router.push(`/project/${projectId}`);
        } catch (err) {
            console.error(err);
            setError('Failed to create project: ' + err.message);
            setSaving(false);
        }
    };

    return (
        <div className={styles.page}>
            <AppNavbar />
            <div className={styles.content}>
                <h1 className={styles.title}>New Project</h1>

                {/* Steps indicator */}
                <div className={styles.steps}>
                    {[1, 2, 3].map(s => (
                        <button
                            key={s}
                            className={`${styles.stepDot} ${step === s ? styles.stepActive : ''} ${step > s ? styles.stepDone : ''}`}
                            onClick={() => setStep(s)}
                        >
                            {step > s ? '✓' : s}
                        </button>
                    ))}
                </div>

                {error && <div className={styles.error}>{error}</div>}

                {/* Step 1: Upload */}
                {step === 1 && (
                    <div className={styles.stepContent}>
                        <h2>Upload Your Codebase</h2>
                        <p className="text-muted">ZIP your project folder and drop it here. Max {LIMITS.MAX_PROJECT_SIZE_MB}MB.</p>

                        <div className={styles.inputGroup}>
                            <label>Project Name</label>
                            <input
                                type="text"
                                placeholder="my-hackathon-project"
                                value={projectName}
                                onChange={e => setProjectName(e.target.value)}
                                id="project-name-input"
                            />
                        </div>

                        <div
                            className={styles.uploadZone}
                            onClick={() => fileInputRef.current?.click()}
                            onDragOver={e => e.preventDefault()}
                            onDrop={e => {
                                e.preventDefault();
                                const f = e.dataTransfer.files[0];
                                if (f) {
                                    const fakeEvent = { target: { files: [f] } };
                                    handleFileSelect(fakeEvent);
                                }
                            }}
                        >
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept=".zip"
                                onChange={handleFileSelect}
                                style={{ display: 'none' }}
                                id="zip-upload-input"
                            />
                            {zipFile ? (
                                <div className={styles.uploadDone}>
                                    <span className={styles.uploadCheckmark}>✔</span>
                                    <p><strong>{zipFile.name}</strong></p>
                                    <p className="text-muted">{fileTree.length} files detected</p>
                                </div>
                            ) : (
                                <>
                                    <span className={styles.uploadIcon}>📁</span>
                                    <p><strong>Drop your .zip file here</strong></p>
                                    <p className="text-muted">or click to browse</p>
                                    <p className={styles.uploadLimit}>MAX {LIMITS.MAX_PROJECT_SIZE_MB}MB · ONE FOLDER ONLY</p>
                                </>
                            )}
                        </div>

                        {uploading && (
                            <div className={styles.progressBar}>
                                <div className={styles.progressFill} style={{ width: `${uploadProgress}%` }} />
                            </div>
                        )}

                        {fileTree.length > 0 && (
                            <div className={styles.filePreview}>
                                <h4>File Preview ({fileTree.length} files)</h4>
                                <div className={styles.fileList}>
                                    {fileTree.slice(0, 20).map((f, i) => {
                                        const icon = getFileIcon(f.path);
                                        return (
                                            <div key={i} className={styles.fileItem}>
                                                <span className={styles.fileIcon} style={{ color: icon.color }}>●</span>
                                                <span className={styles.fileName}>{f.path}</span>
                                            </div>
                                        );
                                    })}
                                    {fileTree.length > 20 && (
                                        <p className="text-muted" style={{ padding: '8px 12px', fontSize: 12 }}>
                                            ...and {fileTree.length - 20} more files
                                        </p>
                                    )}
                                </div>
                            </div>
                        )}

                        <div className={styles.actions}>
                            <button className="btn btn-ghost" onClick={() => router.push('/dashboard')}>← Cancel</button>
                            <button className="btn btn-primary" onClick={() => setStep(2)} disabled={!zipFile || !projectName.trim()}>
                                Next: Add Members →
                            </button>
                        </div>
                    </div>
                )}

                {/* Step 2: Members */}
                {step === 2 && (
                    <div className={styles.stepContent}>
                        <h2>Invite Team Members</h2>
                        <p className="text-muted">Add up to {LIMITS.MAX_MEMBERS_PER_PROJECT - 1} collaborators by email.</p>

                        <div className={styles.inviteRow}>
                            <input
                                type="email"
                                placeholder="teammate@example.com"
                                value={emailInput}
                                onChange={e => setEmailInput(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && addMember()}
                                id="invite-email-input"
                            />
                            <button className="btn btn-primary" onClick={addMember}>Invite</button>
                        </div>

                        <p className={styles.memberCount}>{memberEmails.length + 1}/{LIMITS.MAX_MEMBERS_PER_PROJECT} members</p>

                        <div className={styles.memberList}>
                            <div className={styles.memberChip}>
                                <span className={styles.chipAvatar} style={{ background: '#4285f4' }}>{user?.displayName?.[0] || '?'}</span>
                                <span>{user?.displayName} (you)</span>
                                <span className={styles.chipRole}>Owner</span>
                            </div>
                            {memberEmails.map((email, i) => (
                                <div key={email} className={styles.memberChip}>
                                    <span className={styles.chipAvatar} style={{ background: '#ff6d01' }}>✉</span>
                                    <span>{email}</span>
                                    <span className={styles.chipPending}>Pending...</span>
                                    <button className={styles.chipRemove} onClick={() => removeMember(email)}>×</button>
                                </div>
                            ))}
                        </div>

                        <div className={styles.actions}>
                            <button className="btn btn-ghost" onClick={() => setStep(1)}>← Back</button>
                            <button className="btn btn-primary" onClick={() => setStep(3)}>Next: Permissions →</button>
                        </div>
                    </div>
                )}

                {/* Step 3: Permissions */}
                {step === 3 && (
                    <div className={styles.stepContent}>
                        <h2>File Permissions</h2>
                        <p className="text-muted">Sensitive files are auto-detected and restricted. Adjust as needed.</p>

                        <div className={styles.permActions}>
                            <button className="btn btn-sm btn-ghost" onClick={() => setAllPermissions('readwrite')}>Set All Read & Write</button>
                            <button className="btn btn-sm btn-ghost" onClick={() => setAllPermissions('restricted')}>Set All Restricted</button>
                        </div>

                        <div className={styles.permList}>
                            {fileTree.map((f, i) => (
                                <div key={i} className={styles.permRow}>
                                    <span className={styles.permFile}>{f.path}</span>
                                    <button
                                        className={`${styles.permToggle} ${permissions[f.path] === 'restricted' ? styles.permRestricted : styles.permOpen}`}
                                        onClick={() => togglePermission(f.path)}
                                    >
                                        {permissions[f.path] === 'restricted' ? '🔒 RESTRICTED' : '✏️ READ & WRITE'}
                                    </button>
                                </div>
                            ))}
                        </div>

                        <div className={styles.actions}>
                            <button className="btn btn-ghost" onClick={() => setStep(2)}>← Back</button>
                            <button className="btn btn-primary" onClick={handleComplete} disabled={saving}>
                                {saving ? <span className="spinner"></span> : '✓ Complete Configuration'}
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

export default function NewProjectPage() {
    return (
        <AuthGuard>
            <NewProjectContent />
        </AuthGuard>
    );
}
