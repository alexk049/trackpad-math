import { getApiBaseUrl } from './config';

export async function apiClient<T>(endpoint: string, options?: RequestInit): Promise<T> {
    const baseUrl = getApiBaseUrl();
    const url = `${baseUrl}${endpoint.startsWith('/') ? endpoint : '/' + endpoint}`;

    const headers = {
        'Content-Type': 'application/json',
        ...options?.headers,
    };

    const res = await fetch(url, { ...options, headers });

    if (!res.ok) {
        let errorMsg = `API Error: ${res.status} ${res.statusText}`;
        try {
            const data = await res.json();
            if (data.detail) errorMsg = data.detail;
            else if (data.message) errorMsg = data.message;
        } catch (e) {
            // Ignore JSON parse error if response is not JSON
        }
        throw new Error(errorMsg);
    }

    // Return empty object for 204 or empty response ?
    // For now assuming JSON
    return res.json() as Promise<T>;
}
