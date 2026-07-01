export function initTerminal() {
    // Create terminal HTML structure
    const terminalHtml = `
    <div id="easter-egg-terminal" class="rename-popup hidden" role="dialog" style="z-index: 9999;">
        <div class="rename-popup-content" style="background-color: #1e1e1e; color: #00ff00; font-family: monospace; text-align: left; width: 80%; max-width: 600px; height: 400px; max-height: 80vh; overflow-y: auto; box-shadow: 0 0 20px rgba(0,255,0,0.2); border: 1px solid #00ff00; padding: 20px;">
            <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #00ff00; margin-bottom: 10px; padding-bottom: 5px;">
                <h3 style="color: #00ff00; margin: 0; font-size: 16px;">System Terminal</h3>
                <button id="close-terminal-btn" style="background: transparent; color: #00ff00; border: none; cursor: pointer; font-size: 16px;">✖</button>
            </div>
            <div id="terminal-output" style="white-space: pre-wrap; margin-bottom: 10px; font-size: 14px; line-height: 1.5; text-shadow: 0 0 2px #00ff00;"></div>
            <div style="display: flex; align-items: center; font-size: 14px;">
                <span style="color: #00ff00; margin-right: 8px;">user@zero:~$</span>
                <input type="text" id="terminal-input" style="flex: 1; background: transparent; border: none; color: #00ff00; font-family: monospace; outline: none; font-size: 14px; text-shadow: 0 0 2px #00ff00;" autocomplete="off" spellcheck="false">
            </div>
        </div>
    </div>
    `;

    document.body.insertAdjacentHTML('beforeend', terminalHtml);

    const terminalEl = document.getElementById('easter-egg-terminal');
    const outputEl = document.getElementById('terminal-output');
    const inputEl = document.getElementById('terminal-input');
    const closeBtn = document.getElementById('close-terminal-btn');

    let isProcessing = false;

    // Toggle terminal on '`' (backtick) keypress
    document.addEventListener('keydown', (e) => {
        if (e.code === 'Backquote' && !isProcessing) {
            // Prevent default behavior (like typing '`' into an input)
            if (e.target.tagName !== 'INPUT' && e.target.tagName !== 'TEXTAREA') {
                e.preventDefault();
                toggleTerminal();
            }
        }
    });

    closeBtn.addEventListener('click', () => {
        terminalEl.classList.add('hidden');
    });

    function toggleTerminal() {
        if (terminalEl.classList.contains('hidden')) {
            terminalEl.classList.remove('hidden');
            setTimeout(() => inputEl.focus(), 100);
            if (outputEl.innerHTML === '') {
                printToTerminal("Welcome to Zero System.\nType 'start' to initialize.");
            }
        } else {
            terminalEl.classList.add('hidden');
        }
    }

    inputEl.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !isProcessing) {
            const command = inputEl.value.trim().toLowerCase();
            inputEl.value = '';
            printToTerminal(`\nuser@zero:~$ ${command}`);
            handleCommand(command);
        }
    });

    function printToTerminal(text) {
        outputEl.innerHTML += `<div>${text.replace(/\n/g, '<br>')}</div>`;
        scrollToBottom();
    }

    function updateLastLine(text) {
        if (outputEl.lastChild) {
            outputEl.lastChild.innerHTML = text.replace(/\n/g, '<br>');
        } else {
            printToTerminal(text);
        }
        scrollToBottom();
    }

    function scrollToBottom() {
        const content = terminalEl.querySelector('.rename-popup-content');
        content.scrollTop = content.scrollHeight;
    }

    async function handleCommand(command) {
        if (command === 'start') {
            isProcessing = true;
            inputEl.disabled = true;
            
            printToTerminal("Initializing system sequences...");
            
            // Progress bar simulation
            printToTerminal("0%");
            for (let i = 1; i <= 100; i += Math.floor(Math.random() * 15) + 5) {
                if (i > 100) i = 100;
                await new Promise(resolve => setTimeout(resolve, Math.random() * 150 + 50));
                updateLastLine(`Progress: [${'#'.repeat(Math.floor(i / 5))}${' '.repeat(20 - Math.floor(i / 5))}] ${i}%`);
            }
            updateLastLine(`Progress: [####################] 100%`);
            
            await new Promise(resolve => setTimeout(resolve, 500));
            printToTerminal("\n--- USER SETTINGS LOADED ---");
            
            // Output settings
            const settings = [];
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                const value = localStorage.getItem(key);
                settings.push(`${key}: ${value}`);
            }
            
            if (settings.length === 0) {
                printToTerminal("No settings found in local storage.");
            } else {
                for (const setting of settings) {
                    await new Promise(resolve => setTimeout(resolve, 50));
                    printToTerminal(setting);
                }
            }
            
            printToTerminal("\nSystem ready.");
            
            isProcessing = false;
            inputEl.disabled = false;
            inputEl.focus();
        } else if (command === 'clear') {
            outputEl.innerHTML = '';
        } else if (command === 'exit') {
            terminalEl.classList.add('hidden');
        } else if (command !== '') {
            printToTerminal(`Command not found: ${command}`);
        }
    }
}

// Auto-initialize when script is loaded
document.addEventListener('DOMContentLoaded', initTerminal);
