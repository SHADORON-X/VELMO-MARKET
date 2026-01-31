import { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import ShopPage from './pages/ShopPage';
import OrderPage from './pages/OrderPage';
import { Search, ArrowRight, Loader2, AlertCircle } from 'lucide-react';
import { supabase } from './lib/supabase';
import { Toaster, toast } from 'sonner';

// ============================================================
// 📱 APP PRINCIPAL
// ============================================================

function App() {
    return (
        <Router>
            <Toaster position="top-center" richColors />
            <Routes>
                {/* Route dynamique pour les boutiques */}
                <Route path="/b/:slug" element={<ShopPage />} />
                <Route path="/order/:orderId" element={<OrderPage />} />
                <Route path="/receipt/:orderId" element={<OrderPage />} />
                {/* Alias alternatif */}
                <Route path="/:slug" element={<ShopPage />} />
                {/* Page d'accueil */}
                <Route path="/" element={<LandingPage />} />
                {/* Fallback */}
                <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
        </Router>
    );
}

// ============================================================
// 🏠 LANDING PAGE
// ============================================================

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
            // Vérifier si la boutique existe ET est publique
            const { data, error } = await supabase
                .from('shops')
                .select('slug')
                .ilike('slug', slug.trim())
                .eq('is_public', true)
                .single();

            if (error || !data) {
                setError('Boutique introuvable ou non publique');
                toast.error("Cette boutique n'existe pas ou n'est pas accessible.");
            } else {
                navigate(`/b/${data.slug}`);
            }
        } catch (err) {
            setError('Une erreur est survenue');
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="landing-page">
            {/* ✨ Particles Background */}
            <div className="particles-container">
                {[...Array(15)].map((_, i) => (
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
                            placeholder="Ex: boutique-mamadou"
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
                        {loading ? <Loader2 className="animate-spin" size={24} /> : <ArrowRight size={24} />}
                        <span>Accéder à la boutique</span>
                    </button>
                </form>

                {/* 💡 Hint */}
                <p style={{ marginTop: '2rem', fontSize: '0.875rem', color: 'var(--text-muted)' }}>
                    Tu es commerçant ? Télécharge l'app{' '}
                    <a href="https://velmo.market" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--primary)' }}>
                        Velmo
                    </a>{' '}
                    pour créer ta boutique.
                </p>
            </div>
        </div>
    );
}

export default App;
