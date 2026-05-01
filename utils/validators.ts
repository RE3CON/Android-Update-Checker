export interface ValidationResult {
    isValid: boolean;
    errors: string[];
}

export function validateSemVer(version: string): ValidationResult {
    if (!version || typeof version !== 'string') {
        return { isValid: false, errors: ['Version must be a non-empty string'] };
    }
    const cleanVersion = version.replace(/^v/, '');
    const semverRegex = /^\d+\.\d+\.\d+(-[a-zA-Z0-9.-]+)?(\+[a-zA-Z0-9.-]+)?$/;
    const isValid = semverRegex.test(cleanVersion);
    return { isValid, errors: isValid ? [] : [`Invalid semantic version format: ${version}`] };
}

export function validatePackageName(packageName: string): ValidationResult {
    if (!packageName || typeof packageName !== 'string') {
        return { isValid: false, errors: ['Package name must be a non-empty string'] };
    }
    const packageRegex = /^[a-zA-Z][a-zA-Z0-9_]*(\.[a-zA-Z][a-zA-Z0-9_]*)+$/;
    const isValid = packageRegex.test(packageName);
    return { isValid, errors: isValid ? [] : [`Invalid Android package name format: ${packageName}`] };
}

export function validateUrl(url: string, allowedDomains?: string[]): ValidationResult {
    if (!url || typeof url !== 'string') {
        return { isValid: false, errors: ['URL must be a non-empty string'] };
    }
    try {
        const parsed = new URL(url);
        if (!['http', 'https', 'ftp'].includes(parsed.protocol.replace(':', ''))) {
            return { isValid: false, errors: ['URL must use http, https, or ftp protocol'] };
        }
        if (allowedDomains && allowedDomains.length > 0) {
            const domainMatches = allowedDomains.some(
                domain => parsed.hostname === domain || parsed.hostname?.endsWith('.' + domain)
            );
            if (!domainMatches) {
                return { isValid: false, errors: [`URL domain not allowed. Allowed domains: ${allowedDomains.join(', ')}]` };
            }
        }
        return { isValid: true, errors: [] };
    } catch (e) {
        return { isValid: false, errors: [`Invalid URL format: ${url}`] };
    }
}

export function sanitizeInput(input: unknown): string {
    if (!input) return '';
    const str = String(input);
    if (str.includes('\x00')) {
        return '';
    }
    return str.replace(/[^a-zA-Z0-9.\-_~+/]/g, '');
}

export function safeJsonParse<T = any>(json: string, fallback?: T): T | null {
    try {
        return JSON.parse(json) as T;
    } catch (e) {
        console.error('JSON parse error:', e);
        return fallback ?? null;
    }
}