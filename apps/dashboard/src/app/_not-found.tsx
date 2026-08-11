export default function NotFound() {
    return (
        <main style={{
            minHeight: '100vh',
            display: 'grid',
            placeItems: 'center',
            background: 'linear-gradient(135deg, #091413 0%, #285a48 100%)',
            color: '#b0e4cc',
            padding: '32px',
            textAlign: 'center',
        }}>
            <div>
                <h1 style={{ fontSize: 'clamp(2rem, 4vw, 3rem)', margin: 0 }}>
                    Page not found
                </h1>
                <p style={{ marginTop: '16px', color: '#d9f2dc', fontSize: '1rem' }}>
                    The route you tried to access does not exist. Return to the home page and try again.
                </p>
                <a
                    href="/"
                    style={{
                        display: 'inline-flex',
                        marginTop: '24px',
                        padding: '12px 22px',
                        borderRadius: '999px',
                        background: '#408a71',
                        color: '#091413',
                        textDecoration: 'none',
                        fontWeight: 700,
                    }}
                >
                    Back to home
                </a>
            </div>
        </main>
    )
}
