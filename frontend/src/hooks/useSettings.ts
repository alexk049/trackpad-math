import { useState, useEffect } from 'react';
import { apiClient } from '../api/client';
import type { Settings } from '../types';

export function useSettings() {
    const [settings, setSettings] = useState<Settings | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        apiClient<Settings>('/api/settings')
            .then(data => {
                setSettings(data);
                setLoading(false);
            })
            .catch(err => {
                console.error("Failed to fetch settings:", err);
                setError(err.message);
                setLoading(false);
            });
    }, []);

    const updateSettings = async (newSettings: Partial<Settings>) => {
        try {
            const merged = { ...settings, ...newSettings } as Settings;
            setSettings(merged); // Optimistic update

            await apiClient('/api/settings', {
                method: 'POST',
                body: JSON.stringify(merged),
            });
        } catch (err) {
            console.error("Failed to update settings:", err);
            // Revert? For now just log
        }
    };

    return { settings, loading, error, updateSettings };
}
