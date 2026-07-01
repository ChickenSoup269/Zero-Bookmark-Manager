// Google Drive Sync Component
// Handles Backup and Restore of Bookmarks to Google Drive

const SYNC_FILE_NAME = 'zero_bookmark_manager_backup.json';

document.addEventListener('DOMContentLoaded', () => {
    const syncBtn = document.getElementById('google-drive-sync-btn');
    const syncPopup = document.getElementById('cloud-sync-popup');
    const closeSyncPopupBtn = document.getElementById('cloud-sync-close');
    const backupBtn = document.getElementById('btn-backup-drive');
    const restoreBtn = document.getElementById('btn-restore-drive');
    const statusMsg = document.getElementById('sync-status-message');

    if (syncBtn && syncPopup) {
        syncBtn.addEventListener('click', () => {
            syncPopup.classList.remove('hidden');
            statusMsg.textContent = '';
            statusMsg.style.color = 'var(--text-color)';
        });

        closeSyncPopupBtn.addEventListener('click', () => {
            syncPopup.classList.add('hidden');
        });
    }

    if (backupBtn) {
        backupBtn.addEventListener('click', async () => {
            await handleBackup();
        });
    }

    if (restoreBtn) {
        restoreBtn.addEventListener('click', async () => {
            await handleRestore();
        });
    }

    async function getAuthToken() {
        return new Promise((resolve, reject) => {
            if (!chrome.identity) {
                reject(new Error('chrome.identity API is not available. Please check manifest permissions.'));
                return;
            }
            chrome.identity.getAuthToken({ interactive: true }, function (token) {
                if (chrome.runtime.lastError) {
                    reject(new Error(chrome.runtime.lastError.message));
                } else if (token) {
                    resolve(token);
                } else {
                    reject(new Error('Failed to obtain token'));
                }
            });
        });
    }

    async function findSyncFile(token) {
        const query = `name='${SYNC_FILE_NAME}' and trashed=false`;
        const response = await fetch(`https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&spaces=drive`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        const data = await response.json();
        if (data.files && data.files.length > 0) {
            return data.files[0];
        }
        return null;
    }

    async function handleBackup() {
        try {
            statusMsg.textContent = 'Authenticating...';
            statusMsg.style.color = 'var(--text-color)';
            const token = await getAuthToken();

            statusMsg.textContent = 'Preparing bookmarks data...';
            const tree = await chrome.bookmarks.getTree();
            const bookmarksData = JSON.stringify(tree);
            const metadata = {
                name: SYNC_FILE_NAME,
                mimeType: 'application/json'
            };

            const existingFile = await findSyncFile(token);

            statusMsg.textContent = 'Uploading to Google Drive...';
            let url = 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart';
            let method = 'POST';

            if (existingFile) {
                url = `https://www.googleapis.com/upload/drive/v3/files/${existingFile.id}?uploadType=multipart`;
                method = 'PATCH';
            }

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
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': `multipart/related; boundary="${boundary}"`
                },
                body: multipartRequestBody
            });

            if (response.ok) {
                statusMsg.textContent = 'Backup to Google Drive successful!';
                statusMsg.style.color = 'var(--primary-color)';
            } else {
                const err = await response.json();
                throw new Error(err.error.message || 'Upload failed');
            }

        } catch (error) {
            console.error('Backup error:', error);
            statusMsg.textContent = `Backup failed: ${error.message}`;
            statusMsg.style.color = '#ef4444'; // red
        }
    }

    async function handleRestore() {
        try {
            statusMsg.textContent = 'Authenticating...';
            statusMsg.style.color = 'var(--text-color)';
            const token = await getAuthToken();

            statusMsg.textContent = 'Searching for backup file...';
            const existingFile = await findSyncFile(token);

            if (!existingFile) {
                throw new Error('No backup file found on Google Drive.');
            }

            statusMsg.textContent = 'Downloading bookmarks data...';
            const response = await fetch(`https://www.googleapis.com/drive/v3/files/${existingFile.id}?alt=media`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (!response.ok) {
                throw new Error('Failed to download backup file.');
            }

            const backupData = await response.json();
            
            statusMsg.textContent = 'Please wait, checking data... (Restore logic needs careful merging to avoid duplicates)';
            
            // NOTE: A complete replace of bookmarks requires deleting existing ones or merging.
            // For safety in this prototype, we'll stop here to prevent deleting user's current bookmarks,
            // or we can implement a logic to import them into a new "Restored from Drive" folder.
            
            await importToRestoredFolder(backupData);

            statusMsg.textContent = 'Restore successful! Check the "Restored from Drive" folder.';
            statusMsg.style.color = 'var(--primary-color)';
        } catch (error) {
            console.error('Restore error:', error);
            statusMsg.textContent = `Restore failed: ${error.message}`;
            statusMsg.style.color = '#ef4444';
        }
    }

    async function importToRestoredFolder(backupTree) {
        // Find or create a 'Restored from Drive' folder in the "Other Bookmarks" or main root
        const rootNodes = await chrome.bookmarks.getTree();
        const otherBookmarks = rootNodes[0].children.find(c => c.id === '2') || rootNodes[0].children[0];

        const restoredFolder = await chrome.bookmarks.create({
            parentId: otherBookmarks.id,
            title: `Restored from Drive (${new Date().toLocaleString()})`
        });

        // The backup tree usually has root -> [Bookmarks Bar, Other Bookmarks]
        // We traverse the backup and import everything into `restoredFolder`
        if (backupTree && backupTree.length > 0) {
            const root = backupTree[0];
            if (root.children) {
                for (const child of root.children) {
                    await traverseAndCreate(child, restoredFolder.id);
                }
            }
        }
    }

    async function traverseAndCreate(node, parentId) {
        const newNode = await chrome.bookmarks.create({
            parentId: parentId,
            title: node.title,
            url: node.url
        });

        if (node.children) {
            for (const child of node.children) {
                await traverseAndCreate(child, newNode.id);
            }
        }
    }
});
