// Free tier limits
export const LIMITS = {
    MAX_PROJECTS_PER_USER: 1,
    MAX_MEMBERS_PER_PROJECT: 5,
    MAX_PROJECT_SIZE_MB: 50,
    MAX_PROJECT_SIZE_BYTES: 50 * 1024 * 1024,
    MAX_FILE_SIZE_MB: 1,
    MAX_FILE_SIZE_BYTES: 1 * 1024 * 1024,
    MAX_CHAT_MESSAGES: 100,
    MAX_SNAPSHOTS_PER_FILE: 10,
    DEBOUNCE_SAVE_MS: 2000,
    DEBOUNCE_CURSOR_MS: 100,
    PRESENCE_ACTIVE_THRESHOLD_MS: 30000,
};

export const SENSITIVE_FILE_PATTERNS = [
    /\.env$/i,
    /\.env\..+$/i,
    /\.db$/i,
    /config\..+$/i,
    /secrets?\..+$/i,
    /\.pem$/i,
    /\.key$/i,
    /credentials/i,
];

export const FILE_ICONS = {
    js: { color: '#f7df1e', label: 'JS' },
    jsx: { color: '#61dafb', label: 'JSX' },
    ts: { color: '#3178c6', label: 'TS' },
    tsx: { color: '#3178c6', label: 'TSX' },
    py: { color: '#3776ab', label: 'PY' },
    go: { color: '#00add8', label: 'GO' },
    rs: { color: '#dea584', label: 'RS' },
    html: { color: '#e34f26', label: 'HTML' },
    css: { color: '#1572b6', label: 'CSS' },
    json: { color: '#a8b9cc', label: 'JSON' },
    md: { color: '#ffffff', label: 'MD' },
    txt: { color: '#888888', label: 'TXT' },
    yaml: { color: '#cb171e', label: 'YAML' },
    yml: { color: '#cb171e', label: 'YML' },
    xml: { color: '#f16529', label: 'XML' },
    svg: { color: '#ffb13b', label: 'SVG' },
    png: { color: '#a4c639', label: 'PNG' },
    jpg: { color: '#a4c639', label: 'JPG' },
    gif: { color: '#a4c639', label: 'GIF' },
    default: { color: '#555555', label: 'FILE' },
};

export const MEMBER_COLORS = [
    '#4285f4', '#ea4335', '#fbbc05', '#34a853',
    '#ff6d01', '#46bdc6', '#7b1fa2', '#c2185b',
    '#00897b', '#6d4c41',
];

export function getFileExtension(filename) {
    const parts = filename.split('.');
    return parts.length > 1 ? parts.pop().toLowerCase() : '';
}

export function getFileIcon(filename) {
    const ext = getFileExtension(filename);
    return FILE_ICONS[ext] || FILE_ICONS.default;
}

export function isSensitiveFile(filepath) {
    return SENSITIVE_FILE_PATTERNS.some(pattern => pattern.test(filepath));
}

export function formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

export function getInitials(name) {
    if (!name) return '??';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
}

export function getTimeSince(date) {
    if (!date) return '';
    const now = new Date();
    const then = date instanceof Date ? date : date.toDate ? date.toDate() : new Date(date);
    const seconds = Math.floor((now - then) / 1000);
    if (seconds < 60) return 'just now';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
}
