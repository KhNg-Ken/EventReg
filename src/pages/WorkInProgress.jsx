export default function WorkInProgress() {
    return (
        <div style={{ 
            display: 'flex', 
            flexDirection: 'column', 
            alignItems: 'center', 
            justifyContent: 'center', 
            minHeight: '100vh',
            backgroundColor: '#f5f5f5'
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