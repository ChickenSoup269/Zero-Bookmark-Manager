// Cloud Sync Component
// Handles Multi-Provider Cloud Sync (GitHub Gist, GitLab Snippet, Google Drive)

import { generateJSONPayload } from './export/json.js';
import { importNonDuplicateBookmarks } from './export/export.js';

const DEFAULT_SYNC_FILE_NAME = 'zero_bookmark_manager_backup.json';
const STORAGE_KEY = 'cloud_sync_config';

let isInitialized = false;

export function initSync(elements) {
    if (isInitialized && !elements) return;

    const syncBtns = document.querySelectorAll('#google-drive-sync-btn, .cloud-sync-trigger');
    const syncPopup = document.getElementById('cloud-sync-popup');
    const closeSyncPopupBtn = document.getElementById('cloud-sync-close');
    const statusMsg = document.getElementById('sync-status-message');
    const guideBox = document.getElementById('cloud-sync-guide');

    // Provider Tabs
    const tabGithub = document.getElementById('tab-provider-github');
    const tabGitlab = document.getElementById('tab-provider-gitlab');
    const tabGdrive = document.getElementById('tab-provider-gdrive');

    // Provider Panels
    const panelGithub = document.getElementById('cloud-panel-github');
    const panelGitlab = document.getElementById('cloud-panel-gitlab');
    const panelGdrive = document.getElementById('cloud-panel-gdrive');

    // GitHub Elements
    const githubTokenInput = document.getElementById('github-token-input');
    const githubGistIdInput = document.getElementById('github-gist-id-input');
    const btnBackupGithub = document.getElementById('btn-backup-github');
    const btnRestoreGithub = document.getElementById('btn-restore-github');

    // GitLab Elements
    const gitlabHostInput = document.getElementById('gitlab-host-input');
    const gitlabTokenInput = document.getElementById('gitlab-token-input');
    const gitlabSnippetIdInput = document.getElementById('gitlab-snippet-id-input');
    const gitlabTokenLink = document.getElementById('gitlab-token-link');
    const btnBackupGitlab = document.getElementById('btn-backup-gitlab');
    const btnRestoreGitlab = document.getElementById('btn-restore-gitlab');

    // Google Drive Elements
    const fileSelect = document.getElementById('sync-file-select');
    const fileNameInput = document.getElementById('sync-filename-input');
    const btnBackupDrive = document.getElementById('btn-backup-drive');
    const btnRestoreDrive = document.getElementById('btn-restore-drive');

    // Password Toggles
    const togglePwdBtns = document.querySelectorAll('.cloud-sync-toggle-pwd');

    let currentDriveToken = null;
    let driveFiles = [];
    let activeProvider = 'github';

    isInitialized = true;

    // Load saved settings from chrome.storage.local
    loadConfig();

    // Attach open modal listener
    if (syncBtns.length > 0 && syncPopup) {
        syncBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                openSyncModal();
            });
        });

        if (closeSyncPopupBtn) {
            closeSyncPopupBtn.addEventListener('click', () => {
                closeSyncModal();
            });
        }

        // Close on backdrop click
        syncPopup.addEventListener('click', (e) => {
            if (e.target === syncPopup) {
                closeSyncModal();
            }
        });
    }

    // Provider Tab Switching
    if (tabGithub) {
        tabGithub.addEventListener('click', () => switchProvider('github'));
    }
    if (tabGitlab) {
        tabGitlab.addEventListener('click', () => switchProvider('gitlab'));
    }
    if (tabGdrive) {
        tabGdrive.addEventListener('click', () => switchProvider('gdrive'));
    }

    // Password Visibility Toggles
    togglePwdBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const targetId = btn.getAttribute('data-target');
            const targetInput = document.getElementById(targetId);
            if (!targetInput) return;

            const icon = btn.querySelector('i');
            if (targetInput.type === 'password') {
                targetInput.type = 'text';
                if (icon) {
                    icon.classList.remove('fa-eye');
                    icon.classList.add('fa-eye-slash');
                }
            } else {
                targetInput.type = 'password';
                if (icon) {
                    icon.classList.remove('fa-eye-slash');
                    icon.classList.add('fa-eye');
                }
            }
        });
    });

    // Auto-save input changes
    const inputsToWatch = [
        githubTokenInput,
        githubGistIdInput,
        gitlabHostInput,
        gitlabTokenInput,
        gitlabSnippetIdInput,
        fileNameInput
    ];
    inputsToWatch.forEach(input => {
        if (!input) return;
        input.addEventListener('input', () => {
            saveConfig();
            if (input === gitlabHostInput) {
                updateGitLabLink();
            }
        });
    });

    // Google Drive File Select change
    if (fileSelect && fileNameInput) {
        fileSelect.addEventListener('change', () => {
            if (fileSelect.value === 'new') {
                fileNameInput.style.display = 'block';
            } else {
                fileNameInput.style.display = 'none';
            }
        });
    }

    // Action Buttons
    if (btnBackupGithub) {
        btnBackupGithub.addEventListener('click', handleGitHubBackup);
    }
    if (btnRestoreGithub) {
        btnRestoreGithub.addEventListener('click', handleGitHubRestore);
    }

    if (btnBackupGitlab) {
        btnBackupGitlab.addEventListener('click', handleGitLabBackup);
    }
    if (btnRestoreGitlab) {
        btnRestoreGitlab.addEventListener('click', handleGitLabRestore);
    }

    if (btnBackupDrive) {
        btnBackupDrive.addEventListener('click', handleDriveBackup);
    }
    if (btnRestoreDrive) {
        btnRestoreDrive.addEventListener('click', handleDriveRestore);
    }

    function openSyncModal() {
        if (!syncPopup) return;
        if (typeof window.closeSettingsAndSidebar === 'function') {
            window.closeSettingsAndSidebar();
        }
        syncPopup.classList.remove('hidden');
        clearStatus();
        loadConfig(() => {
            switchProvider(activeProvider || 'github');
        });
    }

    function closeSyncModal() {
        if (!syncPopup) return;
        syncPopup.classList.add('hidden');
        clearStatus();
    }

    function switchProvider(provider) {
        activeProvider = provider;

        // Update Tab Classes
        [tabGithub, tabGitlab, tabGdrive].forEach(tab => {
            if (!tab) return;
            if (tab.getAttribute('data-provider') === provider) {
                tab.classList.add('active');
            } else {
                tab.classList.remove('active');
            }
        });

        // Update Panel Classes
        if (panelGithub) panelGithub.classList.toggle('active', provider === 'github');
        if (panelGitlab) panelGitlab.classList.toggle('active', provider === 'gitlab');
        if (panelGdrive) panelGdrive.classList.toggle('active', provider === 'gdrive');

        // Render Dynamic Guide
        renderGuide(provider);
        clearStatus();
        saveConfig();

        // If Google Drive, attempt silent token check to load file list
        if (provider === 'gdrive' && !currentDriveToken) {
            checkDriveTokenSilently();
        }
    }

    function updateGitLabLink() {
        if (!gitlabTokenLink) return;
        let host = gitlabHostInput ? gitlabHostInput.value.trim() : 'https://gitlab.com';
        if (!host) host = 'https://gitlab.com';
        host = host.replace(/\/+$/, '');
        gitlabTokenLink.href = `${host}/-/user_settings/personal_access_tokens`;
    }

    function renderGuide(provider) {
        if (!guideBox) return;
        const lang = localStorage.getItem('appLanguage') || 'en';
        const isVi = lang === 'vi';

        let host = (gitlabHostInput && gitlabHostInput.value.trim()) || 'https://gitlab.com';
        host = host.replace(/\/+$/, '');

        if (provider === 'github') {
            guideBox.innerHTML = `
                <div class="cloud-sync-guide-step">
                    <span class="cloud-sync-step-badge">1</span>
                    <div>
                        ${isVi ? 'Tạo GitHub Personal Access Token (classic hoặc fine-grained):' : 'Create a GitHub Personal Access Token (classic or fine-grained):'}
                        <a href="https://github.com/settings/tokens/new?scopes=gist&description=ZeroBookmarkManager" target="_blank" class="cloud-sync-guide-link">
                            ${isVi ? 'Tạo Token trên GitHub &nearr;' : 'Generate Token &nearr;'}
                        </a>
                    </div>
                </div>
                <div class="cloud-sync-guide-step">
                    <span class="cloud-sync-step-badge">2</span>
                    <div>
                        ${isVi ? 'Đảm bảo đã tích chọn phạm vi quyền <code>gist</code> (cho phép lưu trữ dữ liệu an toàn).' : 'Ensure the <code>gist</code> scope is checked (allows private backup storage).'}
                    </div>
                </div>
                <div class="cloud-sync-guide-step">
                    <span class="cloud-sync-step-badge">3</span>
                    <div>
                        ${isVi ? 'Dán Token vào ô bên dưới. Nếu là lần đầu sao lưu, để trống ô <b>Gist ID</b> để tiện ích tự tạo Gist bí mật mới.' : 'Paste your token below. Leave <b>Gist ID</b> blank to automatically create a new Secret Gist.'}
                    </div>
                </div>
                <div class="cloud-sync-guide-step">
                    <span class="cloud-sync-step-badge">4</span>
                    <div>
                        ${isVi ? 'Bấm <b>Sao lưu lên Cloud</b> để đẩy dữ liệu lên, hoặc <b>Khôi phục từ Cloud</b> để tải về.' : 'Click <b>Backup to Cloud</b> to upload, or <b>Restore from Cloud</b> to import your bookmarks.'}
                    </div>
                </div>
            `;
        } else if (provider === 'gitlab') {
            guideBox.innerHTML = `
                <div class="cloud-sync-guide-step">
                    <span class="cloud-sync-step-badge">1</span>
                    <div>
                        ${isVi ? 'Truy cập trang tạo Personal Access Token của GitLab:' : 'Open GitLab Personal Access Tokens page:'}
                        <a href="${host}/-/user_settings/personal_access_tokens" target="_blank" class="cloud-sync-guide-link">
                            ${isVi ? 'Tạo Token GitLab &nearr;' : 'Generate Token &nearr;'}
                        </a>
                    </div>
                </div>
                <div class="cloud-sync-guide-step">
                    <span class="cloud-sync-step-badge">2</span>
                    <div>
                        ${isVi ? 'Chọn phạm vi quyền (scopes) là <code>api</code> (hoặc <code>read_api</code> nếu chỉ khôi phục).' : 'Select the <code>api</code> scope (or <code>read_api</code> for restore only).'}
                    </div>
                </div>
                <div class="cloud-sync-guide-step">
                    <span class="cloud-sync-step-badge">3</span>
                    <div>
                        ${isVi ? 'Dán Token và máy chủ (mặc định gitlab.com hoặc máy chủ riêng). Để trống <b>Snippet ID</b> khi sao lưu lần đầu.' : 'Paste your Token and Host URL. Leave <b>Snippet ID</b> blank for initial backup (auto-created).'}
                    </div>
                </div>
                <div class="cloud-sync-guide-step">
                    <span class="cloud-sync-step-badge">4</span>
                    <div>
                        ${isVi ? 'Bấm <b>Sao lưu</b> để lưu vào Private Snippet hoặc <b>Khôi phục</b> để tải bookmark.' : 'Click <b>Backup</b> to save to a private Snippet, or <b>Restore</b> to download bookmarks.'}
                    </div>
                </div>
            `;
        } else if (provider === 'gdrive') {
            const formUrl = 'https://docs.google.com/forms/d/e/1FAIpQLSe0MVV6-Z7sxb-4Zpv5wRyBcKPsl8EbOqRAnntgrdBc_gOXpQ/viewform?usp=dialog';
            guideBox.innerHTML = `
                <div class="cloud-sync-guide-step">
                    <span class="cloud-sync-step-badge">1</span>
                    <div>
                        ${isVi ? 'Tiện ích kết nối an toàn với Google Drive cá nhân của bạn qua Chrome Identity.' : 'Connect securely to your personal Google Drive via Chrome Identity API.'}
                    </div>
                </div>
                <div class="cloud-sync-guide-step">
                    <span class="cloud-sync-step-badge">2</span>
                    <div>
                        ${isVi ? 'Khi bấm Sao lưu hoặc Khôi phục lần đầu, hãy đăng nhập và cho phép quyền truy cập Drive.' : 'When clicking Backup or Restore for the first time, authorize Google account access when prompted.'}
                    </div>
                </div>
                <div class="cloud-sync-guide-step">
                    <span class="cloud-sync-step-badge">3</span>
                    <div>
                        ${isVi ? 'Chọn file sao lưu hiện có từ danh sách thả xuống, hoặc nhập tên file mới (.json).' : 'Select an existing backup file or enter a new custom backup file name (.json).'}
                    </div>
                </div>
                <div class="cloud-sync-guide-step">
                    <span class="cloud-sync-step-badge">4</span>
                    <div>
                        ${isVi ? 'Bấm <b>Sao lưu lên Cloud</b> hoặc <b>Khôi phục từ Cloud</b> để thực hiện.' : 'Click <b>Backup to Cloud</b> or <b>Restore from Cloud</b> to synchronize.'}
                    </div>
                </div>
                <div class="cloud-sync-notice-box">
                    <i class="fas fa-circle-info" style="margin-right: 4px; color: var(--accent-color);"></i>
                    ${isVi 
                        ? `<b>Lưu ý thử nghiệm:</b> Do chưa có domain xác minh chính thức từ Google, nếu bạn bị chặn đăng nhập hoặc gặp thông báo truy cập bị hạn chế, hãy <a href="${formUrl}" target="_blank" class="cloud-sync-guide-link" style="font-weight: 600;">nhập email vào form này &nearr;</a> để tác giả cấp quyền dùng thử nhé!`
                        : `<b>Testing Note:</b> Pending custom domain verification, if your Google sign-in is blocked or restricted, please <a href="${formUrl}" target="_blank" class="cloud-sync-guide-link" style="font-weight: 600;">submit your email via this form &nearr;</a> to be granted access!`
                    }
                </div>
            `;
        }
    }

    function setStatus(text, type = 'info', extraHtml = '') {
        if (!statusMsg) return;
        statusMsg.innerHTML = text + (extraHtml ? ` ${extraHtml}` : '');
        if (type === 'error') {
            statusMsg.style.color = '#ef4444';
        } else if (type === 'success') {
            statusMsg.style.color = 'var(--primary-color, #10b981)';
        } else {
            statusMsg.style.color = 'var(--text-color, #64748b)';
        }
    }

    function clearStatus() {
        if (!statusMsg) return;
        statusMsg.textContent = '';
        statusMsg.innerHTML = '';
    }

    function saveConfig() {
        const config = {
            activeProvider: activeProvider || 'github',
            githubToken: githubTokenInput ? githubTokenInput.value.trim() : '',
            githubGistId: githubGistIdInput ? githubGistIdInput.value.trim() : '',
            gitlabHost: gitlabHostInput ? gitlabHostInput.value.trim() : 'https://gitlab.com',
            gitlabToken: gitlabTokenInput ? gitlabTokenInput.value.trim() : '',
            gitlabSnippetId: gitlabSnippetIdInput ? gitlabSnippetIdInput.value.trim() : '',
            fileName: fileNameInput ? fileNameInput.value.trim() : ''
        };
        try {
            if (chrome && chrome.storage && chrome.storage.local) {
                chrome.storage.local.set({ [STORAGE_KEY]: config });
            }
        } catch (e) {
            console.warn('Unable to save cloud sync config:', e);
        }
    }

    function loadConfig(callback) {
        try {
            if (chrome && chrome.storage && chrome.storage.local) {
                chrome.storage.local.get([STORAGE_KEY], (res) => {
                    const cfg = res[STORAGE_KEY] || {};
                    if (cfg.activeProvider) activeProvider = cfg.activeProvider;
                    if (githubTokenInput && cfg.githubToken) githubTokenInput.value = cfg.githubToken;
                    if (githubGistIdInput && cfg.githubGistId) githubGistIdInput.value = cfg.githubGistId;
                    if (gitlabHostInput && cfg.gitlabHost) gitlabHostInput.value = cfg.gitlabHost;
                    if (gitlabTokenInput && cfg.gitlabToken) gitlabTokenInput.value = cfg.gitlabToken;
                    if (gitlabSnippetIdInput && cfg.gitlabSnippetId) gitlabSnippetIdInput.value = cfg.gitlabSnippetId;
                    if (fileNameInput && cfg.fileName) fileNameInput.value = cfg.fileName;
                    updateGitLabLink();
                    if (callback) callback();
                });
            } else if (callback) {
                callback();
            }
        } catch (e) {
            console.warn('Unable to load cloud sync config:', e);
            if (callback) callback();
        }
    }

    // --- Data Extraction & Restore Helpers ---
    async function getBookmarksExportPayload() {
        let tree = null;
        if (window.BookmarkCache && typeof window.BookmarkCache.getTreeAsync === 'function') {
            tree = await window.BookmarkCache.getTreeAsync();
        } else if (chrome && chrome.bookmarks && typeof chrome.bookmarks.getTree === 'function') {
            tree = await new Promise((resolve) => chrome.bookmarks.getTree(resolve));
        } else {
            throw new Error('Bookmarks API not available');
        }

        const exportData = {
            timestamp: new Date().toISOString(),
            bookmarks: tree,
        };
        const payload = await generateJSONPayload(exportData);
        return payload;
    }

    async function applyRestoredBackup(backupData) {
        const bookmarksToImport = backupData.bookmarks || backupData;
        const themeData = backupData.theme || {};
        const appSettings = backupData.appSettings || {};

        await importNonDuplicateBookmarks(
            bookmarksToImport,
            themeData,
            elements,
            appSettings,
            backupData
        );
    }

    // ==========================================
    // GITHUB GIST SYNC ENGINE
    // ==========================================
    async function handleGitHubBackup() {
        const token = githubTokenInput ? githubTokenInput.value.trim() : '';
        const gistId = githubGistIdInput ? githubGistIdInput.value.trim() : '';

        if (!token) {
            setStatus('Please enter your GitHub Personal Access Token.', 'error');
            return;
        }

        try {
            setStatus('Preparing bookmarks payload...', 'info');
            const payload = await getBookmarksExportPayload();
            const jsonString = JSON.stringify(payload, null, 2);

            setStatus('Uploading to GitHub Gist...', 'info');

            let url = 'https://api.github.com/gists';
            let method = 'POST';
            const bodyData = {
                description: 'Zero Bookmark Manager Cloud Backup',
                files: {
                    [DEFAULT_SYNC_FILE_NAME]: {
                        content: jsonString
                    }
                }
            };

            if (gistId) {
                url = `https://api.github.com/gists/${gistId}`;
                method = 'PATCH';
            } else {
                bodyData.public = false;
            }

            const response = await fetch(url, {
                method: method,
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Accept': 'application/vnd.github+json',
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(bodyData)
            });

            if (!response.ok) {
                const errData = await response.json().catch(() => ({}));
                throw new Error(errData.message || `GitHub error: ${response.status} ${response.statusText}`);
            }

            const data = await response.json();
            if (data.id && githubGistIdInput) {
                githubGistIdInput.value = data.id;
                saveConfig();
            }

            const gistLink = data.html_url ? `<a href="${data.html_url}" target="_blank" style="color:var(--primary-color);text-decoration:underline;margin-left:6px;">View Gist &nearr;</a>` : '';
            setStatus('Backup to GitHub Gist successful!', 'success', gistLink);

        } catch (err) {
            console.error('GitHub Backup error:', err);
            setStatus(`Backup failed: ${err.message}`, 'error');
        }
    }

    async function handleGitHubRestore() {
        const token = githubTokenInput ? githubTokenInput.value.trim() : '';
        const gistId = githubGistIdInput ? githubGistIdInput.value.trim() : '';

        if (!gistId) {
            setStatus('Please enter the Gist ID to restore from.', 'error');
            return;
        }

        try {
            setStatus('Fetching backup from GitHub Gist...', 'info');

            const headers = {
                'Accept': 'application/vnd.github+json'
            };
            if (token) {
                headers['Authorization'] = `Bearer ${token}`;
            }

            const response = await fetch(`https://api.github.com/gists/${gistId}`, {
                method: 'GET',
                headers: headers
            });

            if (!response.ok) {
                const errData = await response.json().catch(() => ({}));
                throw new Error(errData.message || `GitHub error: ${response.status} ${response.statusText}`);
            }

            const data = await response.json();
            const files = data.files || {};
            let backupFile = files[DEFAULT_SYNC_FILE_NAME];

            if (!backupFile) {
                // Find first json file
                const firstKey = Object.keys(files).find(k => k.endsWith('.json')) || Object.keys(files)[0];
                if (firstKey) backupFile = files[firstKey];
            }

            if (!backupFile) {
                throw new Error('No valid backup JSON file found in this Gist.');
            }

            let rawContent = backupFile.content;
            if (backupFile.truncated && backupFile.raw_url) {
                setStatus('Downloading complete file...', 'info');
                const rawRes = await fetch(backupFile.raw_url);
                rawContent = await rawRes.text();
            }

            const backupData = JSON.parse(rawContent);
            setStatus('Applying restored bookmarks...', 'info');

            await applyRestoredBackup(backupData);
            setStatus('Restore from GitHub Gist successful!', 'success');

        } catch (err) {
            console.error('GitHub Restore error:', err);
            setStatus(`Restore failed: ${err.message}`, 'error');
        }
    }

    // ==========================================
    // GITLAB SNIPPET SYNC ENGINE
    // ==========================================
    async function handleGitLabBackup() {
        let host = gitlabHostInput ? gitlabHostInput.value.trim() : 'https://gitlab.com';
        if (!host) host = 'https://gitlab.com';
        host = host.replace(/\/+$/, '');

        const token = gitlabTokenInput ? gitlabTokenInput.value.trim() : '';
        const snippetId = gitlabSnippetIdInput ? gitlabSnippetIdInput.value.trim() : '';

        if (!token) {
            setStatus('Please enter your GitLab Personal Access Token.', 'error');
            return;
        }

        try {
            setStatus('Preparing bookmarks payload...', 'info');
            const payload = await getBookmarksExportPayload();
            const jsonString = JSON.stringify(payload, null, 2);

            setStatus('Uploading to GitLab Snippet...', 'info');

            let url = `${host}/api/v4/snippets`;
            let method = 'POST';
            let reqBody = {};

            if (snippetId) {
                url = `${host}/api/v4/snippets/${snippetId}`;
                method = 'PUT';
                reqBody = {
                    title: 'Zero Bookmark Manager Cloud Backup',
                    files: [
                        {
                            action: 'update',
                            file_path: DEFAULT_SYNC_FILE_NAME,
                            content: jsonString
                        }
                    ]
                };
            } else {
                reqBody = {
                    title: 'Zero Bookmark Manager Cloud Backup',
                    visibility: 'private',
                    files: [
                        {
                            file_path: DEFAULT_SYNC_FILE_NAME,
                            content: jsonString
                        }
                    ]
                };
            }

            const response = await fetch(url, {
                method: method,
                headers: {
                    'PRIVATE-TOKEN': token,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(reqBody)
            });

            if (!response.ok) {
                const errData = await response.json().catch(() => ({}));
                throw new Error(errData.message || `GitLab error: ${response.status} ${response.statusText}`);
            }

            const data = await response.json();
            if (data.id && gitlabSnippetIdInput) {
                gitlabSnippetIdInput.value = data.id;
                saveConfig();
            }

            const snippetLink = data.web_url ? `<a href="${data.web_url}" target="_blank" style="color:var(--primary-color);text-decoration:underline;margin-left:6px;">View Snippet &nearr;</a>` : '';
            setStatus('Backup to GitLab Snippet successful!', 'success', snippetLink);

        } catch (err) {
            console.error('GitLab Backup error:', err);
            setStatus(`Backup failed: ${err.message}`, 'error');
        }
    }

    async function handleGitLabRestore() {
        let host = gitlabHostInput ? gitlabHostInput.value.trim() : 'https://gitlab.com';
        if (!host) host = 'https://gitlab.com';
        host = host.replace(/\/+$/, '');

        const token = gitlabTokenInput ? gitlabTokenInput.value.trim() : '';
        const snippetId = gitlabSnippetIdInput ? gitlabSnippetIdInput.value.trim() : '';

        if (!snippetId) {
            setStatus('Please enter the GitLab Snippet ID to restore from.', 'error');
            return;
        }

        try {
            setStatus('Downloading backup from GitLab Snippet...', 'info');

            const headers = {};
            if (token) {
                headers['PRIVATE-TOKEN'] = token;
            }

            const response = await fetch(`${host}/api/v4/snippets/${snippetId}/raw`, {
                method: 'GET',
                headers: headers
            });

            if (!response.ok) {
                const errData = await response.json().catch(() => ({}));
                throw new Error(errData.message || `GitLab error: ${response.status} ${response.statusText}`);
            }

            const rawText = await response.text();
            const backupData = JSON.parse(rawText);

            setStatus('Applying restored bookmarks...', 'info');
            await applyRestoredBackup(backupData);

            setStatus('Restore from GitLab Snippet successful!', 'success');

        } catch (err) {
            console.error('GitLab Restore error:', err);
            setStatus(`Restore failed: ${err.message}`, 'error');
        }
    }

    // ==========================================
    // GOOGLE DRIVE SYNC ENGINE
    // ==========================================
    async function getDriveAuthToken(interactive = true) {
        return new Promise((resolve, reject) => {
            if (!chrome.identity) {
                reject(new Error('chrome.identity API is not available. Please check manifest permissions.'));
                return;
            }
            chrome.identity.getAuthToken({ interactive }, function (token) {
                if (chrome.runtime.lastError) {
                    reject(new Error(chrome.runtime.lastError.message));
                } else if (token) {
                    resolve(token);
                } else {
                    reject(new Error('Failed to obtain Google Drive token'));
                }
            });
        });
    }

    async function checkDriveTokenSilently() {
        try {
            const token = await getDriveAuthToken(false);
            if (token) {
                currentDriveToken = token;
                await loadDriveFilesList(token);
            }
        } catch {
            // Silently ignore if not authorized yet
        }
    }

    async function loadDriveFilesList(token) {
        if (!fileSelect) return;
        fileSelect.innerHTML = '<option value="new">-- Create New File --</option>';
        driveFiles = [];

        try {
            const query = `name contains '.json' and trashed=false`;
            const response = await fetch(`https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&spaces=drive`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            const data = await response.json();
            if (data.files && data.files.length > 0) {
                driveFiles = data.files;
                data.files.forEach(f => {
                    const option = document.createElement('option');
                    option.value = f.id;
                    option.textContent = f.name;
                    fileSelect.appendChild(option);
                });
            }
        } catch (error) {
            console.error('Error loading Google Drive files list:', error);
        }

        fileSelect.dispatchEvent(new Event('change'));
    }

    function getDriveSyncFileName() {
        if (fileNameInput && fileNameInput.value.trim() !== '') {
            let name = fileNameInput.value.trim();
            if (!name.endsWith('.json')) {
                name += '.json';
            }
            return name;
        }
        return DEFAULT_SYNC_FILE_NAME;
    }

    async function handleDriveBackup() {
        try {
            if (!currentDriveToken) {
                setStatus('Authenticating with Google Drive...', 'info');
                currentDriveToken = await getDriveAuthToken(true);
                await loadDriveFilesList(currentDriveToken);
            }

            setStatus('Preparing bookmarks data...', 'info');
            const payload = await getBookmarksExportPayload();
            const bookmarksData = JSON.stringify(payload);

            let url = 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart';
            let method = 'POST';
            let metadata = {
                mimeType: 'application/json'
            };

            const selectedOption = fileSelect ? fileSelect.value : 'new';
            if (selectedOption === 'new') {
                metadata.name = getDriveSyncFileName();
            } else {
                url = `https://www.googleapis.com/upload/drive/v3/files/${selectedOption}?uploadType=multipart`;
                method = 'PATCH';
                const fileObj = driveFiles.find(f => f.id === selectedOption);
                if (fileObj) metadata.name = fileObj.name;
            }

            setStatus('Uploading to Google Drive...', 'info');

            const boundary = '-------314159265358979323846';
            const delimiter = "\r\n--" + boundary + "\r\n";
            const close_delim = "\r\n--" + boundary + "--";

            const multipartRequestBody =
                delimiter +
                'Content-Type: application/json\r\n\r\n' +
                JSON.stringify(metadata) +
                delimiter +
                'Content-Type: application/json\r\n\r\n' +
                bookmarksData +
                close_delim;

            const response = await fetch(url, {
                method: method,
                headers: {
                    'Authorization': `Bearer ${currentDriveToken}`,
                    'Content-Type': `multipart/related; boundary="${boundary}"`
                },
                body: multipartRequestBody
            });

            if (response.ok) {
                setStatus('Backup to Google Drive successful!', 'success');
                await loadDriveFilesList(currentDriveToken);
            } else {
                const err = await response.json().catch(() => ({}));
                throw new Error(err.error?.message || 'Upload failed');
            }

        } catch (error) {
            console.error('Google Drive Backup error:', error);
            setStatus(`Backup failed: ${error.message}`, 'error');
        }
    }

    async function handleDriveRestore() {
        try {
            const selectedOption = fileSelect ? fileSelect.value : 'new';
            if (selectedOption === 'new') {
                throw new Error('Please select an existing backup file to restore.');
            }

            if (!currentDriveToken) {
                setStatus('Authenticating with Google Drive...', 'info');
                currentDriveToken = await getDriveAuthToken(true);
            }

            setStatus('Downloading bookmarks data from Google Drive...', 'info');

            const response = await fetch(`https://www.googleapis.com/drive/v3/files/${selectedOption}?alt=media`, {
                headers: {
                    'Authorization': `Bearer ${currentDriveToken}`
                }
            });

            if (!response.ok) {
                throw new Error('Failed to download backup file from Google Drive.');
            }

            const backupData = await response.json();
            setStatus('Applying restored bookmarks...', 'info');

            await applyRestoredBackup(backupData);
            setStatus('Restore from Google Drive successful!', 'success');

        } catch (error) {
            console.error('Google Drive Restore error:', error);
            setStatus(`Restore failed: ${error.message}`, 'error');
        }
    }
}

// Auto-init on DOMContentLoaded for contexts without explicit initSync(elements) call
if (typeof document !== 'undefined') {
    document.addEventListener('DOMContentLoaded', () => {
        if (!isInitialized) {
            initSync(window.elements || {});
        }
    });
}
