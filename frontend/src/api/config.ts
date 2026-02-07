import { info } from "@tauri-apps/plugin-log";

// Internal mutable state
let _API_BASE_URL = "http://localhost:8000";

// Getter function - always returns the current value
export const getApiBaseUrl = () => _API_BASE_URL;

// Setter function - updates the port
export const setApiPort = (port: number) => {
    _API_BASE_URL = `http://localhost:${port}`;
    info(`API Base URL set to: ${_API_BASE_URL}`);
};

export const getWsUrl = (path: string) => {
    const baseUrl = getApiBaseUrl();
    const wsBase = baseUrl.replace('http', 'ws');
    // Ensure path starts with /
    const cleanPath = path.startsWith('/') ? path : `/${path}`;
    return `${wsBase}${cleanPath}`;
}

// For backward compatibility/ease of use
export const API_BASE_URL = getApiBaseUrl;
