import { useState } from 'react';
import Poster from '../Poster/Poster.jsx';
import { DEFAULT_POSTER_CONFIG } from '../Poster/templates/index.js';
import './PosterDesignEditor.css';

const TEMPLATE_OPTIONS = [
    { value: 'modern', label: '🎨 Modern' },
    { value: 'classic', label: '📜 Classic' },
    { value: 'minimal', label: '⚪ Minimal' },
];

const DEFAULT_COLORS = {
    modern: {
        primary: '#FF6B6B',
        secondary: '#4ECDC4',
        background: '#1A1A2E',
        text: '#FFFFFF',
    },
    classic: {
        primary: '#2C3E50',
        secondary: '#E74C3C',
        background: '#ECF0F1',
        text: '#2C3E50',
    },
    minimal: {
        primary: '#000000',
        secondary: '#666666',
        background: '#FFFFFF',
        text: '#000000',
    },
};

export default function PosterDesignEditor({ initialConfig = null, onConfigChange }) {
    const config = initialConfig || DEFAULT_POSTER_CONFIG;
    const [template, setTemplate] = useState(config.template || 'modern');
    const [colors, setColors] = useState(config.colors || DEFAULT_COLORS.modern);
    const [showFields, setShowFields] = useState(
        config.showFields || DEFAULT_POSTER_CONFIG.showFields
    );

    const handleTemplateChange = (newTemplate) => {
        setTemplate(newTemplate);
        setColors(DEFAULT_COLORS[newTemplate] || colors);
        const updatedConfig = {
            template: newTemplate,
            colors: DEFAULT_COLORS[newTemplate] || colors,
            showFields,
            logo: config.logo,
            backgroundImage: config.backgroundImage,
        };
        onConfigChange(updatedConfig);
    };

    const handleColorChange = (colorKey, value) => {
        const updatedColors = { ...colors, [colorKey]: value };
        setColors(updatedColors);
        const updatedConfig = {
            template,
            colors: updatedColors,
            showFields,
            logo: config.logo,
            backgroundImage: config.backgroundImage,
        };
        onConfigChange(updatedConfig);
    };

    const handleFieldToggle = (fieldName) => {
        const updatedFields = { ...showFields, [fieldName]: !showFields[fieldName] };
        setShowFields(updatedFields);
        const updatedConfig = {
            template,
            colors,
            showFields: updatedFields,
            logo: config.logo,
            backgroundImage: config.backgroundImage,
        };
        onConfigChange(updatedConfig);
    };

    // Sample registrant for preview
    const sampleRegistrant = {
        name: 'John Doe',
        company: 'Acme Corp',
        position: 'Senior Developer',
        email: 'john@example.com',
        photoUrl:
            'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="150" height="150"><rect fill="%23ddd" width="100%" height="100%"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="%23999" font-size="14">Photo</text></svg>',
        qrCode: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect fill="white" width="100%" height="100%"/><rect fill="black" x="10" y="10" width="30" height="30"/></svg>',
    };

    return (
        <div className="poster-design-editor">
            <div className="editor-header">
                <h3>🎨 Poster Design</h3>
            </div>

            <div className="editor-container">
                <div className="editor-controls">
                    <div className="control-section">
                        <label className="control-label">Template</label>
                        <div className="template-buttons">
                            {TEMPLATE_OPTIONS.map((opt) => (
                                <button
                                    key={opt.value}
                                    className={`template-btn ${
                                        template === opt.value ? 'active' : ''
                                    }`}
                                    onClick={() => handleTemplateChange(opt.value)}
                                >
                                    {opt.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="control-section">
                        <label className="control-label">Colors</label>
                        <div className="color-controls">
                            {Object.entries(colors).map(([key, value]) => (
                                <div key={key} className="color-input-group">
                                    <label className="color-label">{key}</label>
                                    <div className="color-picker-wrapper">
                                        <input
                                            type="color"
                                            value={value}
                                            onChange={(e) => handleColorChange(key, e.target.value)}
                                            className="color-picker"
                                        />
                                        <input
                                            type="text"
                                            value={value}
                                            onChange={(e) => handleColorChange(key, e.target.value)}
                                            className="color-text"
                                        />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="control-section">
                        <label className="control-label">Display Fields</label>
                        <div className="field-toggles">
                            {Object.entries(showFields).map(([fieldName, isShown]) => (
                                <label key={fieldName} className="field-toggle">
                                    <input
                                        type="checkbox"
                                        checked={isShown}
                                        onChange={() => handleFieldToggle(fieldName)}
                                    />
                                    <span>{fieldName}</span>
                                </label>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="editor-preview">
                    <div className="preview-label">Preview</div>
                    <div className="preview-container">
                        <Poster
                            registrant={sampleRegistrant}
                            config={{ template, colors, showFields }}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
}
