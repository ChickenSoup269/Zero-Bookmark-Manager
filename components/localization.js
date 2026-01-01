// components/localization.js
import { translations } from './utils/utils.js';

export function updateBookmarksPageText() {
    const lang = localStorage.getItem('appLanguage') || 'en';
    const t = (key) => translations[lang][key] || key;

    // Update sidebar section titles
    document.getElementById('filters-title').textContent = t('filtersTitle');
    document.getElementById('search-title').textContent = t('searchTitle');
    document.getElementById('folder-actions-title').textContent = t('folderActionsTitle');
    document.getElementById('selection-title').textContent = t('selectionTitle');

    // Update other elements (example: placeholder, button texts)
    // This part assumes that other elements like select options, button spans etc.
    // are either handled by existing UI update functions or need individual updates here.
    // For now, focusing on the requested section titles.
}

// Ensure the text is updated on load
document.addEventListener('DOMContentLoaded', updateBookmarksPageText);

// Listen for language changes (assuming you have an event for this)
window.addEventListener('languageChanged', updateBookmarksPageText);
