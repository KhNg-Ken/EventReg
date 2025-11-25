// DemoForm.jsx (deprecated)
// This component was replaced by `RegisterForm.jsx` — keep a small no-op
// stub here to avoid accidental imports failing during refactors.
import React from 'react';

export default function DemoFormDeprecated() {
    if (typeof console !== 'undefined') {
        console.warn('DemoForm is deprecated — use RegisterForm.jsx instead.');
    }
    return null;
}
