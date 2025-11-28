export default function Avatar({ src, name, size = 56, style = {} } = {}) {
    const initials =
        (name || '')
            .split(' ')
            .filter(Boolean)
            .slice(0, 2)
            .map((n) => n[0].toUpperCase())
            .join('') || '—';

    const rootStyle = { width: size, height: size, ...style };

    return (
        <div className="avatar-root" style={rootStyle}>
            {src ? (
                <img className="avatar-img" src={src} alt={name || 'avatar'} />
            ) : (
                <div
                    style={{
                        width: '100%',
                        height: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#666',
                        fontWeight: 700,
                        fontSize: Math.max(12, size / 3),
                    }}
                >
                    {initials}
                </div>
            )}
        </div>
    );
}
