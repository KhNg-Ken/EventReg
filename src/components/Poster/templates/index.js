import ClassicTemplate from './ClassicTemplate.jsx';
import MinimalTemplate from './MinimalTemplate.jsx';
import ModernTemplate from './ModernTemplate.jsx';

export const POSTER_TEMPLATES = {
    modern: ModernTemplate,
    classic: ClassicTemplate,
    minimal: MinimalTemplate,
};

export const DEFAULT_POSTER_CONFIG = {
    template: 'modern',
    colors: {
        primary: '#FF6B6B',
        secondary: '#4ECDC4',
        background: '#1A1A2E',
        text: '#FFFFFF',
    },
    showFields: {
        company: true,
        position: true,
        photo: true,
        email: false,
        qrCode: false,
    },
    logo: null,
    backgroundImage: null,
};

export function getDefaultConfig(overrides = {}) {
    return {
        ...DEFAULT_POSTER_CONFIG,
        ...overrides,
    };
}
