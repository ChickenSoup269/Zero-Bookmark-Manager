// Google Drive Sync Component
// Handles Backup and Restore of Bookmarks to Google Drive

const DEFAULT_SYNC_FILE_NAME = 'zero_bookmark_manager_backup.json';

document.addEventListener('DOMContentLoaded', () => {
    const syncBtn = document.getElementById('google-drive-sync-btn');
    const syncPopup = document.getElementById('cloud-sync-popup');
    const closeSyncPopupBtn = document.getElementById('cloud-sync-close');
    const backupBtn = document.getElementById('btn-backup-drive');
    const restoreBtn = document.getElementById('btn-restore-drive');
    const statusMsg = document.getElementById('sync-status-message');
    const fileSelect = document.getElementById('sync-file-select');
    const fileNameInput = document.getElementById('sync-filename-input');
    
    let currentToken = null;
    let driveFiles = [];

    if (fileSelect && fileNameInput) {
        fileSelect.addEventListener('change', () => {
            if (fileSelect.value === 'new') {
                fileNameInput.style.display = 'block';
            } else {
                fileNameInput.style.display = 'none';
            }
        });
    }

    if (syncBtn && syncPopup) {
        syncBtn.addEventListener('click', async () => {
            // Do not show popup immediately. Try login first.
            try {
                // Change cursor to indicate loading
                document.body.style.cursor = 'wait';
                const token = await getAuthToken();
                currentToken = token;
                await loadFilesList(token);
                
                document.body.style.cursor = 'default';
                syncPopup.classList.remove('hidden');
                statusMsg.textContent = '';
                statusMsg.style.color = 'var(--text-color)';
            } catch (error) {
                document.body.style.cursor = 'default';
                console.error('Authentication error:', error);
                alert(`Authentication failed: ${error.message}\nMake sure to check the instructions for Google Drive Sync.`);
            }
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

    async function loadFilesList(token) {
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
            console.error('Error loading files list:', error);
        }
        
        // Trigger change event to set input visibility
        fileSelect.dispatchEvent(new Event('change'));
    }

    function getSyncFileName() {
        if (fileNameInput && fileNameInput.value.trim() !== '') {
            let name = fileNameInput.value.trim();
            if (!name.endsWith('.json')) {
                name += '.json';
            }
            return name;
        }
        return DEFAULT_SYNC_FILE_NAME;
    }

    async function handleBackup() {
        try {
            if (!currentToken) currentToken = await getAuthToken();

            statusMsg.textContent = 'Preparing bookmarks data...';
            statusMsg.style.color = 'var(--text-color)';
            
            const tree = await window.BookmarkCache.getTreeAsync();
            const bookmarksData = JSON.stringify(tree);
            
            let url = 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart';
            let method = 'POST';
            let metadata = {
                mimeType: 'application/json'
            };

            const selectedOption = fileSelect.value;
            if (selectedOption === 'new') {
                metadata.name = getSyncFileName();
            } else {
                url = `https://www.googleapis.com/upload/drive/v3/files/${selectedOption}?uploadType=multipart`;
                method = 'PATCH';
                const fileObj = driveFiles.find(f => f.id === selectedOption);
                if (fileObj) metadata.name = fileObj.name;
            }

            statusMsg.textContent = 'Uploading to Google Drive...';
            
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
                    'Authorization': `Bearer ${currentToken}`,
                    'Content-Type': `multipart/related; boundary="${boundary}"`
                },
                body: multipartRequestBody
            });

            if (response.ok) {
                statusMsg.textContent = 'Backup to Google Drive successful!';
                statusMsg.style.color = 'var(--primary-color)';
                // Reload files list
                await loadFilesList(currentToken);
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
            const selectedOption = fileSelect.value;
            if (selectedOption === 'new') {
                throw new Error('Please select an existing backup file to restore.');
            }

            if (!currentToken) currentToken = await getAuthToken();

            statusMsg.textContent = 'Downloading bookmarks data...';
            statusMsg.style.color = 'var(--text-color)';
            
            const response = await fetch(`https://www.googleapis.com/drive/v3/files/${selectedOption}?alt=media`, {
                headers: {
                    'Authorization': `Bearer ${currentToken}`
                }
            });

            if (!response.ok) {
                throw new Error('Failed to download backup file.');
            }

            const backupData = await response.json();
            
            statusMsg.textContent = 'Please wait, checking data...';
            
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
        const rootNodes = await window.BookmarkCache.getTreeAsync();
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
