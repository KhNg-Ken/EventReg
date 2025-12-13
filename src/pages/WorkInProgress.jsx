export default function WorkInProgress() {
    return (
        <div style={{ 
            display: 'flex', 
            flexDirection: 'column', 
            alignItems: 'center', 
            justifyContent: 'center', 
            height: '100%',
            width: '100%',
            backgroundColor: '#000000ff',
            font: '24px Oswald, sans-serif'
        }}>
            <h1>Work In Progress</h1>
            <p style={{ fontSize: '18px', color: '#666' }}>
                This page is currently under development.
            </p>
            <p style={{ fontSize: '14px', color: '#999' }}>
                Please check back soon!
            </p>
        </div>
    );
}