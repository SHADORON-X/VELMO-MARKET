import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase, type CustomerOrder, type Shop } from '../lib/supabase';
import {
    CheckCircle2, Printer, Share2,
    MapPin, Phone, User, Calendar, Truck, Store,
    ArrowLeft, MessageCircle, Loader2
} from 'lucide-react';
import { motion } from 'framer-motion';

export default function OrderPage() {
    const { orderId } = useParams<{ orderId: string }>();
    const [order, setOrder] = useState<CustomerOrder | null>(null);
    const [shop, setShop] = useState<Shop | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (orderId) loadOrderDetails();
    }, [orderId]);

    const loadOrderDetails = async () => {
        try {
            setLoading(true);
            setError(null);

            // 1. Charger la commande
            const { data: orderData, error: orderError } = await supabase
                .from('customer_orders')
                .select('*')
                .eq('id', orderId)
                .single();

            if (orderError || !orderData) {
                console.error('Erreur commande:', orderError);
                throw new Error('Commande introuvable');
            }

            setOrder(orderData);

            // 2. Charger la boutique associée
            const { data: shopData, error: shopError } = await supabase
                .from('shops')
                .select('*')
                .eq('id', orderData.shop_id)
                .single();

            if (!shopError && shopData) {
                setShop(shopData);
            }

        } catch (err: any) {
            setError(err.message || 'Une erreur est survenue');
        } finally {
            setLoading(false);
        }
    };

    const formatPrice = (price: number | null | undefined) => {
        if (!price || isNaN(price)) return "0 GNF";
        return `${price.toLocaleString('fr-FR')} GNF`;
    };

    const getPublicImageUrl = (path: string | null | undefined) => {
        if (!path) return null;
        if (path.startsWith('http')) return path;

        const bucket = 'velmo-media';
        const projectUrl = import.meta.env.VITE_SUPABASE_URL;
        const cleanPath = path.startsWith('/') ? path.substring(1) : path;

        return `${projectUrl}/storage/v1/object/public/${bucket}/${cleanPath}`;
    };

    const formatDate = (dateStr?: string) => {
        if (!dateStr) return '';
        const date = new Date(dateStr);
        return date.toLocaleDateString('fr-FR', {
            day: 'numeric',
            month: 'long',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const handlePrint = () => {
        window.print();
    };

    const handleShare = () => {
        if (navigator.share) {
            navigator.share({
                title: `Reçu Velmo - Commande #${orderId?.slice(0, 8).toUpperCase()}`,
                text: `Voici le reçu de ma commande chez ${shop?.name || 'la boutique'}`,
                url: window.location.href,
            });
        } else {
            navigator.clipboard.writeText(window.location.href);
            alert('Lien copié dans le presse-papier !');
        }
    };

    const getStatusLabel = (status: string) => {
        switch (status) {
            case 'pending': return { label: 'En attente', color: '#f59e0b' };
            case 'confirmed': return { label: 'Confirmée', color: '#10b981' };
            case 'preparing': return { label: 'Préparation', color: '#3b82f6' };
            case 'ready': return { label: 'Prête', color: '#8b5cf6' };
            case 'shipped': return { label: 'Expédiée', color: '#6366f1' };
            case 'delivered': return { label: 'Livrée', color: '#10b981' };
            case 'cancelled': return { label: 'Annulée', color: '#ef4444' };
            default: return { label: status, color: '#6b7280' };
        }
    };

    if (loading) {
        return (
            <div className="order-page-loading">
                <Loader2 className="animate-spin" size={48} color="#ff5500" />
                <p>Chargement du reçu...</p>
            </div>
        );
    }

    if (error || !order) {
        return (
            <div className="order-error-screen">
                <AlertCircle size={64} color="#ef4444" />
                <h1>Oups !</h1>
                <p>{error || "Impossible de trouver cette commande."}</p>
                <Link to="/" className="btn-back-home">Retour à l'accueil</Link>
            </div>
        );
    }

    const statusStyle = getStatusLabel(order.status);

    return (
        <div className="order-receipt-container">
            {/* Header Mobile Fixe pour Actions */}
            <div className="receipt-actions-header no-print">
                <Link to={shop ? `/b/${shop.slug}` : '/'} className="btn-back">
                    <ArrowLeft size={20} />
                </Link>
                <div className="header-actions">
                    <button onClick={handleShare} className="action-btn">
                        <Share2 size={20} />
                    </button>
                    <button onClick={handlePrint} className="action-btn">
                        <Printer size={20} />
                    </button>
                </div>
            </div>

            <motion.div
                className="receipt-card"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
            >
                {/* 🏷️ Status Header */}
                <div className="receipt-status-banner" style={{ backgroundColor: statusStyle.color }}>
                    <CheckCircle2 size={24} />
                    <span>Commande {statusStyle.label}</span>
                </div>

                {/* 🏪 Shop Info */}
                <div className="receipt-header">
                    <div className="receipt-shop-info">
                        <h1>{shop ? shop.name : 'Boutique Velmo'}</h1>
                        <p className="order-ref">Référence: #{orderId?.slice(0, 8).toUpperCase()}</p>
                        <p className="order-date">
                            <Calendar size={14} />
                            {formatDate(order.created_at)}
                        </p>
                    </div>
                    {shop?.logo_url && (
                        <div className="receipt-logo">
                            <img src={shop.logo_url} alt={shop.name} />
                        </div>
                    )}
                </div>

                <div className="receipt-divider"></div>

                {/* 👤 Customer Info */}
                <div className="receipt-section">
                    <h3 className="section-title">Informations Client</h3>
                    <div className="info-grid">
                        <div className="info-item">
                            <User size={16} />
                            <div>
                                <label>Client</label>
                                <span>{order.customer_name}</span>
                            </div>
                        </div>
                        <div className="info-item">
                            <Phone size={16} />
                            <div>
                                <label>Téléphone</label>
                                <span>{order.customer_phone}</span>
                            </div>
                        </div>
                        {order.delivery_method === 'delivery' && (
                            <div className="info-item full">
                                <MapPin size={16} />
                                <div>
                                    <label>Adresse de livraison</label>
                                    <span>{order.customer_address || 'Non précisée'}</span>
                                    {order.customer_location && (
                                        <a
                                            href={`https://www.google.com/maps?q=${order.customer_location.lat},${order.customer_location.lng}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="gps-link no-print"
                                        >
                                            <MapPin size={14} /> Ouvrir dans Google Maps (Précis)
                                        </a>
                                    )}
                                </div>
                            </div>
                        )}
                        <div className="info-item">
                            {order.delivery_method === 'delivery' ? <Truck size={16} /> : <Store size={16} />}
                            <div>
                                <label>Mode de retrait</label>
                                <span>{order.delivery_method === 'delivery' ? 'Livraison à domicile' : 'Retrait en boutique'}</span>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="receipt-divider"></div>

                {/* 🛒 Items Table */}
                <div className="receipt-section">
                    <h3 className="section-title">Détails de la commande</h3>
                    <div className="receipt-items-list">
                        {(order.items_json || []).map((item, idx) => (
                            <div key={idx} className="receipt-item-row">
                                <div className="receipt-item-left">
                                    <div className="receipt-item-img">
                                        {item.photo_url ? (
                                            <img src={getPublicImageUrl(item.photo_url) || ''} alt={item.name} />
                                        ) : (
                                            <Store size={20} className="placeholder-icon" />
                                        )}
                                    </div>
                                    <div className="item-name">
                                        <span className="item-qty">{item.quantity}x</span>
                                        {item.name}
                                    </div>
                                </div>
                                <div className="item-price">
                                    {formatPrice(item.price * item.quantity)}
                                </div>
                            </div>
                        ))}
                    </div>

                    {order.order_note && (
                        <div className="receipt-note">
                            <label>Note spéciale :</label>
                            <p>{order.order_note}</p>
                        </div>
                    )}
                </div>

                <div className="receipt-totals">
                    <div className="total-row">
                        <span>Sous-total</span>
                        <span>{formatPrice(order.total_amount)}</span>
                    </div>
                    {order.delivery_method === 'delivery' && (
                        <div className="total-row">
                            <span>Frais de livraison</span>
                            <span>A définir avec le vendeur</span>
                        </div>
                    )}
                    <div className="total-row grand-total">
                        <span>TOTAL</span>
                        <span>{formatPrice(order.total_amount)}</span>
                    </div>
                </div>

                <div className="receipt-footer no-print">
                    <p>Merci pour votre confiance !</p>
                    <div className="footer-links">
                        {shop && (
                            <a
                                href={`https://wa.me/${(shop.whatsapp || shop.phone)?.replace(/\D/g, '')}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="whatsapp-help"
                            >
                                <MessageCircle size={18} />
                                Contacter le vendeur
                            </a>
                        )}
                    </div>
                </div>
            </motion.div>

            <style>{`
                .order-receipt-container {
                    min-height: 100vh;
                    background: var(--bg-primary);
                    padding: 2rem 1rem;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                }

                .receipt-card {
                    width: 100%;
                    max-width: 600px;
                    background: var(--bg-secondary);
                    border-radius: var(--radius-xl);
                    box-shadow: var(--shadow-xl);
                    overflow: hidden;
                    border: 1px solid var(--border-color);
                }

                .receipt-actions-header {
                    width: 100%;
                    max-width: 600px;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 1.5rem;
                }

                .action-btn, .btn-back {
                    width: 44px;
                    height: 44px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    background: var(--bg-tertiary);
                    border-radius: var(--radius-full);
                    color: var(--text-primary);
                    border: 1px solid var(--border-color);
                }

                .header-actions {
                    display: flex;
                    gap: 0.75rem;
                }

                .receipt-status-banner {
                    padding: 0.75rem;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 10px;
                    color: white;
                    font-weight: 700;
                    text-transform: uppercase;
                    font-size: 0.875rem;
                    letter-spacing: 0.025em;
                }

                .receipt-header {
                    padding: 2rem;
                    display: flex;
                    justify-content: space-between;
                    align-items: flex-start;
                }

                .receipt-shop-info h1 {
                    font-size: 1.75rem;
                    font-weight: 800;
                    color: var(--primary);
                    margin-bottom: 0.5rem;
                }

                .order-ref {
                    font-weight: 600;
                    color: var(--text-secondary);
                    margin-bottom: 4px;
                }

                .order-date {
                    display: flex;
                    align-items: center;
                    gap: 6px;
                    font-size: 0.875rem;
                    color: var(--text-muted);
                }

                .receipt-logo {
                    width: 80px;
                    height: 80px;
                    border-radius: var(--radius-lg);
                    overflow: hidden;
                    border: 2px solid var(--border-color);
                }

                .receipt-logo img {
                    width: 100%;
                    height: 100%;
                    object-fit: cover;
                }

                .receipt-divider {
                    height: 1px;
                    background: dashed var(--border-color);
                    margin: 0 2rem;
                    border-bottom: 1px dashed var(--border-color);
                }

                .receipt-section {
                    padding: 1.5rem 2rem;
                }

                .section-title {
                    font-size: 0.875rem;
                    font-weight: 700;
                    color: var(--text-muted);
                    text-transform: uppercase;
                    margin-bottom: 1.25rem;
                    letter-spacing: 0.05em;
                }

                .info-grid {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 1.5rem;
                }

                .info-item {
                    display: flex;
                    gap: 12px;
                    align-items: flex-start;
                }

                .info-item.full {
                    grid-column: 1 / -1;
                }

                .info-item svg {
                    color: var(--primary);
                    margin-top: 4px;
                }

                .info-item label {
                    display: block;
                    font-size: 0.75rem;
                    color: var(--text-muted);
                    margin-bottom: 2px;
                }

                .info-item span {
                    font-weight: 600;
                    color: var(--text-primary);
                }

                .gps-link {
                    display: inline-flex;
                    align-items: center;
                    gap: 6px;
                    margin-top: 8px;
                    padding: 6px 12px;
                    background: var(--primary);
                    color: white;
                    border-radius: var(--radius-md);
                    font-size: 0.8rem;
                    font-weight: 600;
                    text-decoration: none;
                    transition: transform 0.2s;
                }

                .gps-link:hover {
                    transform: translateY(-1px);
                    filter: brightness(1.1);
                }

                .receipt-items-list {
                    display: flex;
                    flex-direction: column;
                    gap: 1rem;
                }

                .receipt-item-row {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    gap: 1rem;
                }

                .receipt-item-left {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    flex: 1;
                }

                .receipt-item-img {
                    width: 48px;
                    height: 48px;
                    border-radius: var(--radius-md);
                    overflow: hidden;
                    background: var(--bg-tertiary);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    flex-shrink: 0;
                    border: 1px solid var(--border-color);
                }

                .receipt-item-img img {
                    width: 100%;
                    height: 100%;
                    object-fit: cover;
                }

                .item-qty {
                    background: var(--bg-tertiary);
                    padding: 2px 8px;
                    border-radius: 4px;
                    font-weight: 700;
                    color: var(--primary);
                    margin-right: 8px;
                    font-size: 0.875rem;
                }

                .item-name {
                    font-weight: 500;
                }

                .item-price {
                    font-weight: 700;
                    color: var(--text-primary);
                }

                .receipt-note {
                    margin-top: 1.5rem;
                    padding: 1rem;
                    background: var(--bg-tertiary);
                    border-radius: var(--radius-md);
                    font-size: 0.875rem;
                }

                .receipt-note label {
                    font-weight: 700;
                    margin-bottom: 4px;
                    display: block;
                }

                .receipt-totals {
                    background: var(--bg-secondary);
                    padding: 2rem;
                    border-top: 2px solid var(--border-color);
                }

                .total-row {
                    display: flex;
                    justify-content: space-between;
                    margin-bottom: 0.75rem;
                    color: var(--text-secondary);
                }

                .total-row.grand-total {
                    margin-top: 1rem;
                    padding-top: 1rem;
                    border-top: 2px solid var(--border-color);
                    color: var(--primary);
                    font-size: 1.5rem;
                    font-weight: 800;
                }

                .receipt-footer {
                    padding: 2rem;
                    text-align: center;
                    background: var(--bg-tertiary);
                }

                .whatsapp-help {
                    display: inline-flex;
                    align-items: center;
                    gap: 8px;
                    margin-top: 1rem;
                    padding: 8px 16px;
                    background: #25d366;
                    color: white;
                    border-radius: var(--radius-full);
                    font-weight: 600;
                    text-decoration: none;
                }

                @media print {
                    .no-print { display: none !important; }
                    .order-receipt-container { padding: 0; background: white; }
                    .receipt-card { box-shadow: none; border: none; max-width: none; }
                    .receipt-status-banner { -webkit-print-color-adjust: exact; }
                }

                @media (max-width: 480px) {
                    .info-grid { grid-template-columns: 1fr; }
                    .receipt-header { flex-direction: column-reverse; gap: 1rem; }
                    .receipt-logo { width: 60px; height: 60px; }
                }
            `}</style>
        </div>
    );
}

function AlertCircle({ size, color }: { size: number, color: string }) {
    return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
    );
}
