import { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import ShopPage from './pages/ShopPage';
import { Search, ArrowRight, Loader2, AlertCircle } from 'lucide-react';
import { supabase } from './lib/supabase';
import { Toaster, toast } from 'sonner';

function App() {
  return (
    <Router>
      <Toaster position="top-center" />
      <Routes>
        <Route path="/b/:slug" element={<ShopPage />} />
        <Route path="/" element={<LandingPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}

function LandingPage() {
  const [slug, setSlug] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!slug.trim()) return;

    setLoading(true);
    setError('');

    try {
      // Check if shop exists
      const { data, error } = await supabase
        .from('shops')
        .select('slug')
        .eq('slug', slug.trim()) // Removed .eq('is_public', true) for testing, or keep it if crucial
        .single();

      if (error || !data) {
        setError('Boutique introuvable');
        toast.error("Cette boutique n'existe pas.");
      } else {
        navigate(`/b/${data.slug}`);
      }
    } catch (err) {
      setError('Une erreur est survenue');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="landing-page">
      {/* ✨ Particles Background (Reused) */}
      <div className="particles-container">
        {[...Array(10)].map((_, i) => (
          <div
            key={i}
            className={`particle ${i % 3 === 0 ? 'glow' : ''}`}
            style={{
              left: `${Math.random() * 100}%`,
              width: `${Math.random() * 4 + 2}px`,
              height: `${Math.random() * 4 + 2}px`,
              animationDuration: `${Math.random() * 10 + 10}s`,
              animationDelay: `${Math.random() * 5}s`
            }}
          />
        ))}
      </div>

      <div className="landing-content">
        {/* 🍊 Velmo Logo SVG */}
        <div className="brand-logo-large">
          <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect width="100" height="100" rx="28" fill="#ff5500" />
            <path d="M32 38L50 72L68 38" stroke="white" strokeWidth="10" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>

        <h1 className="landing-title">Bienvenue sur Velmo</h1>
        <p className="landing-subtitle">Entrez le nom de la boutique pour y accéder.</p>

        <form onSubmit={handleSearch} className="landing-form">
          <div className="input-group">
            <Search className="input-icon" size={24} />
            <input
              type="text"
              placeholder="Ex: mon-magasin"
              value={slug}
              onChange={(e) => {
                setSlug(e.target.value);
                setError('');
              }}
              className="landing-input"
              autoFocus
            />
          </div>

          {error && (
            <div className="error-message">
              <AlertCircle size={16} />
              <span>{error}</span>
            </div>
          )}

          <button type="submit" className="btn-landing-submit" disabled={loading || !slug}>
            {loading ? <Loader2 className="animate-spin" /> : <ArrowRight size={24} />}
            <span>Accéder à la boutique</span>
          </button>
        </form>
      </div>
    </div>
  );
}

export default App;
