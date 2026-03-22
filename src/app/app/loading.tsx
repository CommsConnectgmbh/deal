export default function AppLoading() {
  return (
    <div style={{
      minHeight: '100vh', background: '#060606', display: 'flex',
      flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      fontFamily: 'Oswald, sans-serif',
    }}>
      <div style={{
        width: 48, height: 48, borderRadius: '50%',
        border: '3px solid #222', borderTopColor: '#FFB800',
        animation: 'spin 0.8s linear infinite',
      }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}
