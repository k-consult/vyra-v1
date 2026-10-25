const STORAGE_KEY = 'vyra.activeTenant';

// null = default tenant (no X-Tenant header sent, server falls back to DB_NAME).
export const getActiveTenant = (): string | null => {
    if (typeof window === 'undefined') return null;
    return window.localStorage.getItem(STORAGE_KEY);
};

export const setActiveTenant = (name: string | null): void => {
    if (typeof window === 'undefined') return;
    if (name) window.localStorage.setItem(STORAGE_KEY, name);
    else window.localStorage.removeItem(STORAGE_KEY);
};
