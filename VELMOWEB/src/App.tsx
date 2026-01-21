import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import ShopPage from './pages/ShopPage';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/b/:slug" element={<ShopPage />} />
        <Route path="/" element={<HomePlaceholder />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}

function HomePlaceholder() {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      padding: '24px',
      textAlign: 'center'
    }}>
      <h1 className="shop-title" style={{ fontSize: '2.5rem' }}>Velmo</h1>
      <p style={{ color: 'var(--text-secondary)', marginTop: '8px', fontSize: '1.125rem' }}>
        La vitrine web simple pour les commerçants.
      </p>
      <div style={{ marginTop: '32px', padding: '16px', background: '#F1F5F9', borderRadius: '12px', fontSize: '0.9rem', color: '#64748B' }}>
        Exemple d'URL : <code style={{ color: '#0F766E', fontWeight: 'bold' }}>/b/mon-magasin</code>
      </div>
    </div>
  );
}

export default App;
