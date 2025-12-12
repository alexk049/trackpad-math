export function initTheme() {
    // Load and apply saved theme preference
    const savedTheme = localStorage.getItem('theme') || 'system';
    applyTheme(savedTheme);
    updateThemeButtons(savedTheme);

    // Theme toggle in header (cycles: light -> dark -> system)
    const toggleBtn = document.getElementById('theme-toggle');
    if (toggleBtn) {
        toggleBtn.addEventListener('click', () => {
            const currentTheme = localStorage.getItem('theme') || 'system';
            let newTheme = 'light';

            if (currentTheme === 'light') newTheme = 'dark';
            else if (currentTheme === 'dark') newTheme = 'system';
            else newTheme = 'light';

            localStorage.setItem('theme', newTheme);
            applyTheme(newTheme);
            updateThemeButtons(newTheme);
        });
    }

    // Theme buttons in settings
    document.querySelectorAll('.theme-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const theme = btn.dataset.theme;
            localStorage.setItem('theme', theme);
            applyTheme(theme);
            updateThemeButtons(theme);
        });
    });

    // Listen for system theme changes
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
        const currentTheme = localStorage.getItem('theme') || 'system';
        if (currentTheme === 'system') {
            applyTheme('system');
        }
    });
}

function applyTheme(theme) {
    const body = document.body;
    const icon = document.getElementById('theme-icon');

    // Remove existing dark mode
    body.classList.remove('dark-mode');

    let isDark = false;

    if (theme === 'dark') {
        isDark = true;
    } else if (theme === 'system') {
        isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    // 'light' leaves isDark as false

    if (isDark) {
        body.classList.add('dark-mode');
        if (icon) icon.className = 'fa-solid fa-sun';
    } else {
        if (icon) icon.className = 'fa-solid fa-moon';
    }
}

function updateThemeButtons(activeTheme) {
    document.querySelectorAll('.theme-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.dataset.theme === activeTheme) {
            btn.classList.add('active');
        }
    });
}
