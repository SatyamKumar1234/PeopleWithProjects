'use client';
import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { doc, getDoc, onSnapshot, collection, setDoc, deleteDoc, getDocs, serverTimestamp, query, orderBy, limit, addDoc, where } from 'firebase/firestore';
import { ref, onValue, set, onDisconnect, remove, serverTimestamp as rtdbTimestamp } from 'firebase/database';
import { ref as storageRef, uploadBytesResumable, getDownloadURL, deleteObject } from 'firebase/storage';
import JSZip from 'jszip';
import { db, rtdb, storage } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';
import AuthGuard from '@/components/AuthGuard';
import { LIMITS, getFileIcon, getFileExtension, getInitials, MEMBER_COLORS, getTimeSince } from '@/lib/constants';
import styles from './editor.module.css';

// ===== FILE TREE BUILDER =====
function buildTree(files) {
    const root = { name: 'root', children: {}, isDir: true, path: '' };
    files.forEach(f => {
        const parts = f.path.split('/');
        let current = root;
        parts.forEach((part, i) => {
            if (i === parts.length - 1) {
                current.children[part] = { name: part, path: f.path, isDir: false, data: f };
            } else {
                if (!current.children[part]) {
                    current.children[part] = { name: part, children: {}, isDir: true, path: parts.slice(0, i + 1).join('/') };
                }
                current = current.children[part];
            }
        });
    });
    return root;
}

// ===== TREE NODE COMPONENT =====
function TreeNode({ node, depth, activeFile, onSelect, presenceMap, onContextMenu }) {
    const [expanded, setExpanded] = useState(depth < 2);
    const icon = node.isDir ? (expanded ? '📂' : '📁') : '';
    const fileIcon = !node.isDir ? getFileIcon(node.name) : null;
    const isActive = activeFile === node.path;
    const viewers = Object.values(presenceMap || {}).filter(p => p.currentFile === node.path);

    if (node.isDir) {
        const children = Object.values(node.children).sort((a, b) => {
            if (a.isDir && !b.isDir) return -1;
            if (!a.isDir && b.isDir) return 1;
            return a.name.localeCompare(b.name);
        });

        return (
            <div>
                <div
                    className={styles.treeItem}
                    style={{ paddingLeft: depth * 16 + 8 }}
                    onClick={() => setExpanded(!expanded)}
                    onContextMenu={e => onContextMenu(e, node)}
                >
                    <span className={styles.treeArrow}>{expanded ? '▼' : '▶'}</span>
                    <span className={styles.treeIcon}>{icon}</span>
                    <span className={styles.treeName}>{node.name}</span>
                </div>
                {expanded && children.map(child => (
                    <TreeNode
                        key={child.path || child.name}
                        node={child}
                        depth={depth + 1}
                        activeFile={activeFile}
                        onSelect={onSelect}
                        presenceMap={presenceMap}
                        onContextMenu={onContextMenu}
                    />
                ))}
            </div>
        );
    }

    return (
        <div
            className={`${styles.treeItem} ${isActive ? styles.treeItemActive : ''}`}
            style={{ paddingLeft: depth * 16 + 8 }}
            onClick={() => onSelect(node)}
            onContextMenu={e => onContextMenu(e, node)}
        >
            <span className={styles.treeFileIcon} style={{ color: fileIcon?.color }}>●</span>
            <span className={styles.treeName}>{node.name}</span>
            {viewers.length > 0 && (
                <span className={styles.treePresence}>
                    {viewers.map((v, i) => (
                        <span key={i} className={styles.presenceDot} style={{ background: v.color }} title={v.displayName}>
                            {v.displayName?.split(' ').map(n => n[0]).join('').slice(0, 2)}
                        </span>
                    ))}
                </span>
            )}
        </div>
    );
}

// ===== EDITOR COMPONENT (CodeMirror) =====
function CodeEditorPane({ content, language, onChange, readOnly }) {
    const editorRef = useRef(null);
    const viewRef = useRef(null);
    const [editorLoaded, setEditorLoaded] = useState(false);

    useEffect(() => {
        let destroyed = false;
        async function initEditor() {
            if (!editorRef.current || viewRef.current) return;

            const { EditorView, keymap, lineNumbers, highlightActiveLineGutter, highlightSpecialChars, drawSelection, highlightActiveLine, rectangularSelection, crosshairCursor } = await import('@codemirror/view');
            const { EditorState } = await import('@codemirror/state');
            const { defaultKeymap, history, historyKeymap, indentWithTab } = await import('@codemirror/commands');
            const { syntaxHighlighting, defaultHighlightStyle, bracketMatching, foldGutter, indentOnInput } = await import('@codemirror/language');
            const { autocompletion, completionKeymap, closeBrackets, closeBracketsKeymap } = await import('@codemirror/autocomplete');
            const { searchKeymap, highlightSelectionMatches } = await import('@codemirror/search');
            const { oneDark } = await import('@codemirror/theme-one-dark');

            let langExtension = [];
            try {
                switch (language) {
                    case 'js': case 'jsx': case 'ts': case 'tsx': case 'javascript': case 'typescript': {
                        const { javascript } = await import('@codemirror/lang-javascript');
                        langExtension = [javascript({ jsx: true, typescript: language.includes('ts') })];
                        break;
                    }
                    case 'css': case 'scss': {
                        const { css } = await import('@codemirror/lang-css');
                        langExtension = [css()];
                        break;
                    }
                    case 'html': case 'htm': case 'svg': {
                        const { html } = await import('@codemirror/lang-html');
                        langExtension = [html()];
                        break;
                    }
                    case 'json': {
                        const { json } = await import('@codemirror/lang-json');
                        langExtension = [json()];
                        break;
                    }
                    case 'py': case 'python': {
                        const { python } = await import('@codemirror/lang-python');
                        langExtension = [python()];
                        break;
                    }
                    case 'md': case 'markdown': {
                        const { markdown } = await import('@codemirror/lang-markdown');
                        langExtension = [markdown()];
                        break;
                    }
                }
            } catch (e) { }

            if (destroyed) return;

            const state = EditorState.create({
                doc: content || '',
                extensions: [
                    lineNumbers(),
                    highlightActiveLineGutter(),
                    highlightSpecialChars(),
                    history(),
                    foldGutter(),
                    drawSelection(),
                    indentOnInput(),
                    syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
                    bracketMatching(),
                    closeBrackets(),
                    autocompletion(),
                    rectangularSelection(),
                    crosshairCursor(),
                    highlightActiveLine(),
                    highlightSelectionMatches(),
                    keymap.of([
                        ...closeBracketsKeymap,
                        ...defaultKeymap,
                        ...searchKeymap,
                        ...historyKeymap,
                        ...completionKeymap,
                        indentWithTab,
                    ]),
                    oneDark,
                    ...langExtension,
                    EditorView.updateListener.of((update) => {
                        if (update.docChanged) {
                            onChange(update.state.doc.toString());
                        }
                    }),
                    EditorState.readOnly.of(readOnly || false),
                    EditorView.theme({
                        '&': { height: '100%', fontSize: '14px' },
                        '.cm-scroller': { overflow: 'auto', fontFamily: 'var(--font-mono)' },
                        '.cm-content': { padding: '8px 0' },
                    }),
                ],
            });

            viewRef.current = new EditorView({
                state,
                parent: editorRef.current,
            });
            setEditorLoaded(true);
        }

        initEditor();

        return () => {
            destroyed = true;
            if (viewRef.current) {
                viewRef.current.destroy();
                viewRef.current = null;
            }
        };
    }, []);

    // Update content externally (when switching files)
    useEffect(() => {
        if (viewRef.current && content !== undefined) {
            const currentContent = viewRef.current.state.doc.toString();
            if (currentContent !== content) {
                viewRef.current.dispatch({
                    changes: { from: 0, to: currentContent.length, insert: content || '' }
                });
            }
        }
    }, [content]);

    return (
        <div ref={editorRef} className={styles.editorPane}>
            {!editorLoaded && <div className={styles.editorLoading}><div className="spinner"></div></div>}
        </div>
    );
}

// ===== CHAT PANEL =====
function ChatPanel({ projectId, user }) {
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState('');
    const bottomRef = useRef(null);

    useEffect(() => {
        const q = query(
            collection(db, 'projects', projectId, 'chat'),
            orderBy('createdAt', 'desc'),
            limit(LIMITS.MAX_CHAT_MESSAGES)
        );
        const unsub = onSnapshot(q, (snap) => {
            setMessages(snap.docs.map(d => ({ id: d.id, ...d.data() })).reverse());
        });
        return () => unsub();
    }, [projectId]);

    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const sendMessage = async () => {
        if (!input.trim()) return;
        await addDoc(collection(db, 'projects', projectId, 'chat'), {
            text: input.trim(),
            userId: user.uid,
            displayName: user.displayName,
            photoURL: user.photoURL || '',
            createdAt: serverTimestamp(),
        });
        setInput('');
    };

    const deleteMessage = async (msgId) => {
        await deleteDoc(doc(db, 'projects', projectId, 'chat', msgId));
    };

    return (
        <div className={styles.chatPanel}>
            <div className={styles.chatHeader}>
                <span>💬 Chat</span>
            </div>
            <div className={styles.chatMessages}>
                {messages.map(msg => (
                    <div key={msg.id} className={styles.chatMsg}>
                        <div className={styles.chatMsgTop}>
                            <span className={styles.chatMsgName}>{msg.displayName}</span>
                            <span className={styles.chatMsgTime}>{getTimeSince(msg.createdAt)}</span>
                            {msg.userId === user.uid && (
                                <button className={styles.chatDeleteBtn} onClick={() => deleteMessage(msg.id)}>🗑</button>
                            )}
                        </div>
                        <p className={styles.chatMsgText}>{msg.text}</p>
                    </div>
                ))}
                <div ref={bottomRef} />
            </div>
            <div className={styles.chatInput}>
                <input
                    type="text"
                    placeholder="Type a message..."
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && sendMessage()}
                    id="chat-input"
                />
                <button className="btn btn-primary btn-sm" onClick={sendMessage}>Send</button>
            </div>
        </div>
    );
}

// ===== MAIN EDITOR PAGE =====
function EditorContent() {
    const { id: projectId } = useParams();
    const { user } = useAuth();
    const router = useRouter();

    const [project, setProject] = useState(null);
    const [files, setFiles] = useState([]);
    const [activeFile, setActiveFile] = useState(null);
    const [openTabs, setOpenTabs] = useState([]);
    const [fileContent, setFileContent] = useState('');
    const [unsaved, setUnsaved] = useState({});
    const [presence, setPresence] = useState({});
    const [showChat, setShowChat] = useState(false);
    const [loading, setLoading] = useState(true);
    const [contextMenu, setContextMenu] = useState(null);
    const [deleteModal, setDeleteModal] = useState(null);
    const [showReplaceModal, setShowReplaceModal] = useState(false);
    const saveTimerRef = useRef(null);
    const fileInputRef = useRef(null);

    // Load project
    useEffect(() => {
        if (!projectId) return;
        const unsub = onSnapshot(doc(db, 'projects', projectId), (snap) => {
            if (snap.exists()) {
                setProject({ id: snap.id, ...snap.data() });
            } else {
                router.push('/dashboard');
            }
        });
        return () => unsub();
    }, [projectId, router]);

    // Load files
    useEffect(() => {
        if (!projectId) return;
        const unsub = onSnapshot(collection(db, 'projects', projectId, 'files'), (snap) => {
            const fileList = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            setFiles(fileList);
            setLoading(false);
        });
        return () => unsub();
    }, [projectId]);

    // Setup presence
    useEffect(() => {
        if (!projectId || !user?.uid) return;

        const presenceRef = ref(rtdb, `presence/${projectId}/${user.uid}`);
        const allPresenceRef = ref(rtdb, `presence/${projectId}`);

        set(presenceRef, {
            displayName: user.displayName || 'Anonymous',
            currentFile: '',
            lastActive: Date.now(),
            color: MEMBER_COLORS[Math.floor(Math.random() * MEMBER_COLORS.length)],
        });

        onDisconnect(presenceRef).remove();

        const unsub = onValue(allPresenceRef, (snap) => {
            setPresence(snap.val() || {});
        });

        return () => {
            remove(presenceRef);
            unsub();
        };
    }, [projectId, user]);

    // Update presence when active file changes
    useEffect(() => {
        if (!projectId || !user?.uid || !activeFile) return;
        const presenceRef = ref(rtdb, `presence/${projectId}/${user.uid}`);
        set(presenceRef, {
            displayName: user.displayName || 'Anonymous',
            currentFile: activeFile,
            lastActive: Date.now(),
            color: MEMBER_COLORS[Math.floor(Math.random() * MEMBER_COLORS.length)],
        });
    }, [activeFile, projectId, user]);

    // Debounced save
    const saveFile = useCallback((filePath, content) => {
        if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
        setUnsaved(prev => ({ ...prev, [filePath]: true }));

        saveTimerRef.current = setTimeout(async () => {
            try {
                const encodedPath = filePath.replace(/\//g, '__');
                await setDoc(doc(db, 'projects', projectId, 'files', encodedPath), {
                    path: filePath,
                    content,
                    language: getFileExtension(filePath),
                    lastEditedBy: user.uid,
                    lastEditedAt: serverTimestamp(),
                }, { merge: true });
                setUnsaved(prev => ({ ...prev, [filePath]: false }));
            } catch (err) {
                console.error('Save failed:', err);
            }
        }, LIMITS.DEBOUNCE_SAVE_MS);
    }, [projectId, user]);

    const tree = useMemo(() => buildTree(files), [files]);

    const selectFile = (node) => {
        const file = files.find(f => f.path === node.path);
        if (!file) return;
        setActiveFile(file.path);
        setFileContent(file.content || '');
        if (!openTabs.find(t => t.path === file.path)) {
            setOpenTabs(prev => [...prev, { path: file.path, name: node.name }]);
        }
    };

    const closeTab = (path) => {
        setOpenTabs(prev => prev.filter(t => t.path !== path));
        if (activeFile === path) {
            const remaining = openTabs.filter(t => t.path !== path);
            if (remaining.length > 0) {
                const last = remaining[remaining.length - 1];
                const file = files.find(f => f.path === last.path);
                setActiveFile(last.path);
                setFileContent(file?.content || '');
            } else {
                setActiveFile(null);
                setFileContent('');
            }
        }
    };

    const handleContentChange = (newContent) => {
        setFileContent(newContent);
        if (activeFile) {
            saveFile(activeFile, newContent);
        }
    };

    const handleContextMenu = (e, node) => {
        e.preventDefault();
        setContextMenu({ x: e.clientX, y: e.clientY, node });
    };

    const handleDeleteFile = async () => {
        if (!deleteModal) return;
        const node = deleteModal;
        if (node.isDir) {
            const filesToDelete = files.filter(f => f.path.startsWith(node.path + '/'));
            for (const f of filesToDelete) {
                const encodedPath = f.path.replace(/\//g, '__');
                await deleteDoc(doc(db, 'projects', projectId, 'files', encodedPath));
            }
        } else {
            const encodedPath = node.path.replace(/\//g, '__');
            await deleteDoc(doc(db, 'projects', projectId, 'files', encodedPath));
        }
        setDeleteModal(null);
        if (activeFile === node.path) {
            setActiveFile(null);
            setFileContent('');
        }
        closeTab(node.path);
    };

    const handleReplaceFolder = async (e) => {
        const file = e.target.files[0];
        if (!file || !file.name.endsWith('.zip')) return;
        if (file.size > LIMITS.MAX_PROJECT_SIZE_BYTES) return;

        try {
            // Delete old files
            const existingFiles = await getDocs(collection(db, 'projects', projectId, 'files'));
            for (const d of existingFiles.docs) await deleteDoc(d.ref);

            // Delete old zip
            try {
                await deleteObject(storageRef(storage, `projects/${projectId}/codebase.zip`));
            } catch (e) { }

            // Upload new zip
            const zipRef = storageRef(storage, `projects/${projectId}/codebase.zip`);
            await uploadBytesResumable(zipRef, file);

            // Parse and write new files
            const zip = await JSZip.loadAsync(file);
            const promises = [];
            zip.forEach((path, entry) => {
                if (!entry.dir && !path.startsWith('__MACOSX') && !path.startsWith('.')) {
                    const p = entry.async('string').then(content => {
                        if (content.length <= LIMITS.MAX_FILE_SIZE_BYTES) {
                            const encodedPath = path.replace(/\//g, '__');
                            return setDoc(doc(db, 'projects', projectId, 'files', encodedPath), {
                                path,
                                content,
                                language: getFileExtension(path),
                                lastEditedBy: user.uid,
                                lastEditedAt: serverTimestamp(),
                            });
                        }
                    });
                    promises.push(p);
                }
            });
            await Promise.all(promises);
            setOpenTabs([]);
            setActiveFile(null);
            setShowReplaceModal(false);
        } catch (err) {
            console.error('Replace failed:', err);
        }
    };

    const handleDownloadProject = async () => {
        try {
            const zipUrl = await getDownloadURL(storageRef(storage, `projects/${projectId}/codebase.zip`));
            window.open(zipUrl, '_blank');
        } catch (err) {
            // Fallback: build ZIP from Firestore
            const zip = new JSZip();
            files.forEach(f => zip.file(f.path, f.content || ''));
            const blob = await zip.generateAsync({ type: 'blob' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${project?.name || 'project'}.zip`;
            a.click();
        }
    };

    const handleDownloadFile = () => {
        if (!activeFile) return;
        const blob = new Blob([fileContent], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = activeFile.split('/').pop();
        a.click();
    };

    const onlineMembers = Object.entries(presence).filter(([uid]) => uid !== user?.uid);

    if (loading) {
        return <div className="loading-screen"><div className="spinner" style={{ width: 32, height: 32 }}></div></div>;
    }

    return (
        <div className={styles.editorLayout}>
            {/* Left Sidebar */}
            <div className={styles.sidebar}>
                <div className={styles.sidebarSection}>
                    <div className={styles.sidebarHeader}>
                        <span>EXPLORER</span>
                        <div className={styles.sidebarActions}>
                            <button className={styles.sidebarBtn} onClick={() => setShowReplaceModal(true)} title="Replace Folder">⟳</button>
                        </div>
                    </div>
                    <div className={styles.fileTree}>
                        {Object.values(tree.children).map(node => (
                            <TreeNode
                                key={node.path || node.name}
                                node={node}
                                depth={0}
                                activeFile={activeFile}
                                onSelect={selectFile}
                                presenceMap={presence}
                                onContextMenu={handleContextMenu}
                            />
                        ))}
                        {files.length === 0 && (
                            <p className={styles.emptyTree}>No files yet. Upload a ZIP to get started.</p>
                        )}
                    </div>
                </div>

                {/* Members Panel */}
                <div className={styles.sidebarSection}>
                    <div className={styles.sidebarHeader}>
                        <span>MEMBERS</span>
                        <span className={styles.onlineBadge}>{onlineMembers.length + 1} Online</span>
                    </div>
                    <div className={styles.membersList}>
                        <div className={styles.memberRow}>
                            <div className={styles.memberDot} style={{ background: '#34a853' }} />
                            <span className={styles.memberAvatar} style={{ background: MEMBER_COLORS[0] }}>
                                {getInitials(user?.displayName)}
                            </span>
                            <div className={styles.memberInfo}>
                                <span className={styles.memberName}>{user?.displayName} (you)</span>
                                <span className={styles.memberFile}>
                                    {activeFile ? `Editing ${activeFile.split('/').pop()}` : 'Idle'}
                                </span>
                            </div>
                        </div>
                        {onlineMembers.map(([uid, data]) => (
                            <div key={uid} className={styles.memberRow} onClick={() => {
                                if (data.currentFile) {
                                    const file = files.find(f => f.path === data.currentFile);
                                    if (file) selectFile({ path: file.path, name: file.path.split('/').pop() });
                                }
                            }}>
                                <div className={styles.memberDot} style={{
                                    background: Date.now() - (data.lastActive || 0) < LIMITS.PRESENCE_ACTIVE_THRESHOLD_MS ? '#34a853' : '#fbbc05'
                                }} />
                                <span className={styles.memberAvatar} style={{ background: data.color || MEMBER_COLORS[1] }}>
                                    {getInitials(data.displayName)}
                                </span>
                                <div className={styles.memberInfo}>
                                    <span className={styles.memberName}>{data.displayName}</span>
                                    <span className={styles.memberFile}>
                                        {data.currentFile ? `Editing ${data.currentFile.split('/').pop()}` : 'Idle'}
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Main Editor */}
            <div className={styles.mainArea}>
                {/* Tab Bar */}
                <div className={styles.tabBar}>
                    <div className={styles.tabs}>
                        {openTabs.map(tab => (
                            <div
                                key={tab.path}
                                className={`${styles.tab} ${activeFile === tab.path ? styles.tabActive : ''}`}
                                onClick={() => {
                                    const file = files.find(f => f.path === tab.path);
                                    setActiveFile(tab.path);
                                    setFileContent(file?.content || '');
                                }}
                            >
                                <span className={styles.tabDot} style={{ color: getFileIcon(tab.name).color }}>●</span>
                                <span className={styles.tabName}>{tab.name}</span>
                                {unsaved[tab.path] && <span className={styles.tabUnsaved}>●</span>}
                                <button className={styles.tabClose} onClick={e => { e.stopPropagation(); closeTab(tab.path); }}>×</button>
                            </div>
                        ))}
                    </div>
                    <div className={styles.tabBarRight}>
                        <button className="btn btn-sm btn-ghost" onClick={handleDownloadFile} disabled={!activeFile}>
                            ↓ Download
                        </button>
                        <button className="btn btn-sm btn-primary" onClick={handleDownloadProject}>
                            📦 Download ZIP
                        </button>
                    </div>
                </div>

                {/* Editor */}
                <div className={styles.editorContainer}>
                    {activeFile ? (
                        <CodeEditorPane
                            key={activeFile}
                            content={fileContent}
                            language={getFileExtension(activeFile)}
                            onChange={handleContentChange}
                            readOnly={false}
                        />
                    ) : (
                        <div className={styles.editorEmpty}>
                            <span className={styles.emptyIcon}>⟐</span>
                            <h3>PeopleWithProjects</h3>
                            <p>Select a file from the explorer to start editing</p>
                        </div>
                    )}
                </div>

                {/* Status Bar */}
                <div className={styles.statusBar}>
                    <div className={styles.statusLeft}>
                        <span className={styles.statusDot} style={{ background: '#34a853' }} />
                        <span>PROJECT SYNC: ONLINE</span>
                        <span className={styles.statusSep}>·</span>
                        <span>⎇ MAIN</span>
                    </div>
                    <div className={styles.statusRight}>
                        {activeFile && (
                            <>
                                <span>Spaces: 2</span>
                                <span className={styles.statusSep}>·</span>
                                <span>UTF-8</span>
                                <span className={styles.statusSep}>·</span>
                                <span>{getFileExtension(activeFile).toUpperCase()}</span>
                            </>
                        )}
                    </div>
                </div>
            </div>

            {/* Chat Toggle Button */}
            <button className={styles.chatToggle} onClick={() => setShowChat(!showChat)} id="chat-toggle">
                💬
            </button>

            {/* Chat Panel */}
            {showChat && <ChatPanel projectId={projectId} user={user} />}

            {/* Context Menu */}
            {contextMenu && (
                <>
                    <div className={styles.contextOverlay} onClick={() => setContextMenu(null)} />
                    <div className={styles.contextMenu} style={{ top: contextMenu.y, left: contextMenu.x }}>
                        {!contextMenu.node.isDir && (
                            <>
                                <button className={styles.contextItem} onClick={() => {
                                    navigator.clipboard.writeText(contextMenu.node.path);
                                    setContextMenu(null);
                                }}>📋 Copy Path</button>
                                <button className={styles.contextItem} onClick={() => {
                                    selectFile(contextMenu.node);
                                    setContextMenu(null);
                                }}>📄 Open File</button>
                            </>
                        )}
                        <button className={styles.contextItem} style={{ color: 'var(--accent-red)' }} onClick={() => {
                            setDeleteModal(contextMenu.node);
                            setContextMenu(null);
                        }}>🗑 Delete {contextMenu.node.isDir ? 'Folder' : 'File'}</button>
                    </div>
                </>
            )}

            {/* Delete Modal */}
            {deleteModal && (
                <div className="modal-overlay" onClick={() => setDeleteModal(null)}>
                    <div className="modal" onClick={e => e.stopPropagation()}>
                        <h3>Delete {deleteModal.isDir ? 'Folder' : 'File'}</h3>
                        <p>
                            {deleteModal.isDir
                                ? `This will delete the folder "${deleteModal.name}" and all files inside. This cannot be undone.`
                                : `Delete "${deleteModal.name}"? This cannot be undone.`}
                        </p>
                        <div className="modal-actions">
                            <button className="btn btn-ghost" onClick={() => setDeleteModal(null)}>Cancel</button>
                            <button className="btn btn-danger" onClick={handleDeleteFile}>Delete</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Replace Folder Modal */}
            {showReplaceModal && (
                <div className="modal-overlay" onClick={() => setShowReplaceModal(false)}>
                    <div className="modal" onClick={e => e.stopPropagation()}>
                        <h3>Replace Project Folder</h3>
                        <p>Upload a new ZIP file. This will replace ALL existing files in the project.</p>
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept=".zip"
                            onChange={handleReplaceFolder}
                            style={{ marginBottom: 16 }}
                        />
                        <div className="modal-actions">
                            <button className="btn btn-ghost" onClick={() => setShowReplaceModal(false)}>Cancel</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default function ProjectEditorPage() {
    return (
        <AuthGuard>
            <EditorContent />
        </AuthGuard>
    );
}
