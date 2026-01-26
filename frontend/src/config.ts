// Internal mutable state
let _API_BASE_URL = "http://localhost:8000";

// Getter function - always returns the current value
export const getApiBaseUrl = () => _API_BASE_URL;

// Setter function - updates the port
export const setApiPort = (port: number) => {
    _API_BASE_URL = `http://localhost:${port}`;
    console.log(`API Base URL set to: ${_API_BASE_URL}`);
};

// For backward compatibility, export a getter that can be used in template literals
// Usage: `${API_BASE_URL()}/api/endpoint`
export const API_BASE_URL = getApiBaseUrl;
