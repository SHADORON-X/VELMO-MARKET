import { useState, useEffect, useMemo, useCallback, memo, type FormEvent } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { supabase, type Shop, type Product, type OrderItem } from '../lib/supabase';
import {
    ShoppingBag, Plus, Minus, Trash2, X, Check, Loader2, Store, ShoppingCart,
    Moon, Sun, MapPin, Truck, Search, Clock, Heart, Share2, MessageCircle,
    Shield, CreditCard, Users, Filter, ChevronDown, Copy, CheckCircle2, BadgeCheck, Printer, Package
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// ============================================================
// 🛒 TYPES LOCAUX
// ============================================================

interface CartItem {
    product: Product;
    quantity: number;
}

type SortOption = 'default' | 'price-asc' | 'price-desc' | 'name' | 'popular';
type FilterOption = 'all' | 'available' | 'new';

// ============================================================
// 📦 COMPOSANT PRINCIPAL
// ============================================================

export default function ShopPage() {
    const { slug } = useParams<{ slug: string }>();
    const navigate = useNavigate();
    const [shop, setShop] = useState<Shop | null>(null);

    // 🕵️ Track Order
    const [isTrackOpen, setIsTrackOpen] = useState(false);
    const [trackInput, setTrackInput] = useState(() => {
        return localStorage.getItem('velmo_last_order_ref') || '';
    });
    const [products, setProducts] = useState<Product[]>([]);
    const [loading, setLoading] = useState(true);

    // 🌙 Theme Management
    const [theme, setTheme] = useState<'light' | 'dark'>(() => {
        const saved = localStorage.getItem('theme');
        if (saved === 'light' || saved === 'dark') return saved;
        return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    });

    useEffect(() => {
        document.documentElement.setAttribute('data-theme', theme);
        localStorage.setItem('theme', theme);
    }, [theme]);

    // 🛒 Cart State
    const [cart, setCart] = useState<CartItem[]>(() => {
        const saved = localStorage.getItem('velmo_cart');
        return saved ? JSON.parse(saved) : [];
    });
    const [isCartOpen, setIsCartOpen] = useState(false);
    const [addedId, setAddedId] = useState<string | null>(null);

    // 📝 Order State
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [orderSuccess, setOrderSuccess] = useState(false);
    const [submittedOrderId, setSubmittedOrderId] = useState<string | null>(null);
    const [submittedOrderRef, setSubmittedOrderRef] = useState<string | null>(null);

    // 📋 Form State
    const [customerInfo, setCustomerInfo] = useState<{
        name: string;
        phone: string;
        address: string;
        location?: { lat: number; lng: number };
    }>(() => {
        const saved = localStorage.getItem('velmo_customer_info');
        return saved ? JSON.parse(saved) : { name: '', phone: '', address: '' };
    });

    // 🕵️ Analytique locale (Produits les plus vus)
    const [productViews, setProductViews] = useState<Record<string, number>>(() => {
        const saved = localStorage.getItem('velmo_product_views');
        return saved ? JSON.parse(saved) : {};
    });
    const [orderNote, setOrderNote] = useState('');
    const [deliveryMethod, setDeliveryMethod] = useState<'pickup' | 'delivery'>('pickup');

    // 🖼️ Product Modal State
    const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
    const [modalQuantity, setModalQuantity] = useState(1);

    // 🔒 Scroll Lock
    useEffect(() => {
        if (isCartOpen || !!selectedProduct) {
            document.body.style.overflow = 'hidden';
            // Empêcher aussi le scroll sur iOS
            document.body.style.position = 'fixed';
            document.body.style.width = '100%';
        } else {
            document.body.style.overflow = '';
            document.body.style.position = '';
            document.body.style.width = '';
        }
        return () => {
            document.body.style.overflow = '';
            document.body.style.position = '';
            document.body.style.width = '';
        };
    }, [isCartOpen, selectedProduct]);

    // 🔍 Search & Filter State
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedCategory, setSelectedCategory] = useState<string>('Tout');
    const [sortOption, setSortOption] = useState<SortOption>('default');
    const [filterOption, setFilterOption] = useState<FilterOption>('all');
    const [showFilters, setShowFilters] = useState(false);

    // ❤️ Favorites
    const [favorites, setFavorites] = useState<string[]>(() => {
        const saved = localStorage.getItem('velmo_favorites');
        return saved ? JSON.parse(saved) : [];
    });

    // 📤 Share
    const [copiedLink, setCopiedLink] = useState(false);

    // ============================================================
    // 🔄 EFFECTS
    // ============================================================

    useEffect(() => {
        localStorage.setItem('velmo_cart', JSON.stringify(cart));
    }, [cart]);

    useEffect(() => {
        localStorage.setItem('velmo_favorites', JSON.stringify(favorites));
    }, [favorites]);

    useEffect(() => {
        localStorage.setItem('velmo_customer_info', JSON.stringify(customerInfo));
    }, [customerInfo]);

    useEffect(() => {
        localStorage.setItem('velmo_product_views', JSON.stringify(productViews));
    }, [productViews]);

    useEffect(() => {
        if (slug) loadShopData();
    }, [slug]);

    // ============================================================
    // 📊 COMPUTED VALUES
    // ============================================================

    const recommendedProducts = useMemo(() => {
        if (!products.length) return [];

        return [...products]
            .map(p => {
                // Score de pertinence : favoris (100) + vues (10 par vue)
                let score = 0;
                if (favorites.includes(p.id)) score += 100;
                score += (productViews[p.id] || 0) * 10;
                return { ...p, relevanceScore: score };
            })
            .filter(p => p.relevanceScore > 0)
            .sort((a, b) => b.relevanceScore - a.relevanceScore)
            .slice(0, 6);
    }, [products, favorites, productViews]);

    // ============================================================
    // 🔧 HELPERS (Déplacés ici pour éviter les erreurs d'initialisation)
    // ============================================================

    const formatPrice = (price: number | null | undefined) => {
        if (!price || isNaN(price) || price === 0) return "Prix sur demande";
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

    const getShopLogo = () => {
        return shop?.logo_url || shop?.logo || null;
    };

    const getShopCover = () => {
        return shop?.cover_url || shop?.cover || null;
    };

    const getStockStatus = (product: Product) => {
        if (!product.is_active) return { label: 'Rupture', color: 'red' };
        if (product.quantity !== null && product.quantity !== undefined) {
            if (product.quantity === 0) return { label: 'Rupture', color: 'red' };
            if (product.quantity <= 5) return { label: 'Stock faible', color: 'yellow' };
        }
        return { label: 'Disponible', color: 'green' };
    };

    const categories = useMemo(() =>
        ['Tout', ...new Set(products.map(p => p.category).filter(Boolean))],
        [products]
    );

    const filteredAndSortedProducts = useMemo(() => {
        let result = products.filter(product => {
            const matchesSearch = product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                (product.description?.toLowerCase().includes(searchQuery.toLowerCase()));
            const matchesCategory = selectedCategory === 'Tout' || product.category === selectedCategory;

            let matchesFilter = true;
            if (filterOption === 'available') matchesFilter = product.is_active;
            if (filterOption === 'new') {
                const oneWeekAgo = new Date();
                oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
                matchesFilter = product.created_at ? new Date(product.created_at) > oneWeekAgo : false;
            }

            return matchesSearch && matchesCategory && matchesFilter;
        });

        switch (sortOption) {
            case 'price-asc':
                result.sort((a, b) => (a.price_sale || 0) - (b.price_sale || 0));
                break;
            case 'price-desc':
                result.sort((a, b) => (b.price_sale || 0) - (a.price_sale || 0));
                break;
            case 'name':
                result.sort((a, b) => a.name.localeCompare(b.name));
                break;
        }

        return result;
    }, [products, searchQuery, selectedCategory, sortOption, filterOption]);

    // 📊 Memoized Products Grid
    const productGrid = useMemo(() => {
        const productsList = filteredAndSortedProducts;
        if (productsList.length === 0) {
            return (
                <div className="empty-products">
                    <ShoppingBag size={48} />
                    <p>Aucun produit trouvé</p>
                    {searchQuery && <span>Essayez une autre recherche</span>}
                </div>
            );
        }

        return (
            <div className="product-grid">
                {productsList.map((product, index) => {
                    const stockStatus = getStockStatus(product);
                    const isFavorite = favorites.includes(product.id);
                    const cartItem = cart.find(item => item.product.id === product.id);
                    const quantity = cartItem ? cartItem.quantity : 0;

                    return (
                        <motion.div
                            key={product.id}
                            className="product-card"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: Math.min(index * 0.03, 0.5) }}
                            whileHover={{ y: -4 }}
                            onClick={() => {
                                setSelectedProduct(product);
                                setModalQuantity(1);
                                // Incrémenter les vues pour l'intelligence locale
                                setProductViews(prev => ({
                                    ...prev,
                                    [product.id]: (prev[product.id] || 0) + 1
                                }));
                            }}
                        >
                            <div className="card-img-container">
                                {product.photo_url ? (
                                    <img
                                        src={getPublicImageUrl(product.photo_url) || ''}
                                        alt={product.name}
                                        loading="lazy"
                                        onError={(e) => {
                                            (e.target as HTMLImageElement).style.display = 'none';
                                        }}
                                    />
                                ) : (
                                    <Store size={40} className="placeholder-icon" />
                                )}

                                {/* 🔥 Badge Intelligent de Tendance */}
                                {productViews[product.id] > 3 && (
                                    <div className="trend-badge" style={{
                                        position: 'absolute',
                                        bottom: '8px',
                                        left: '8px',
                                        background: 'rgba(255, 255, 255, 0.9)',
                                        backdropFilter: 'blur(4px)',
                                        padding: '2px 8px',
                                        borderRadius: '12px',
                                        fontSize: '10px',
                                        fontWeight: 800,
                                        color: 'var(--primary)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '4px',
                                        boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                                    }}>
                                        <Search size={10} /> POPULAIRE
                                    </div>
                                )}

                                <button
                                    className={`favorite-btn ${isFavorite ? 'active' : ''}`}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        toggleFavorite(product.id);
                                    }}
                                >
                                    <Heart size={16} fill={isFavorite ? '#ff5500' : 'none'} />
                                </button>

                                <div className={`stock-badge stock-${stockStatus.color}`}>
                                    {stockStatus.label}
                                </div>
                            </div>

                            <div className="card-content">
                                <h3 className="product-title">{product.name}</h3>
                                <div className="product-price">{formatPrice(product.price_sale)}</div>

                                {product.is_active && (
                                    quantity > 0 ? (
                                        <div
                                            className="btn-add-cart qty-mode"
                                            onClick={(e) => e.stopPropagation()}
                                        >
                                            <button
                                                className="qty-btn-mini"
                                                onClick={() => updateQuantity(product.id, -1)}
                                            >
                                                <Minus size={16} />
                                            </button>
                                            <span className="qty-display">{quantity}</span>
                                            <button
                                                className="qty-btn-mini"
                                                onClick={() => updateQuantity(product.id, 1)}
                                            >
                                                <Plus size={16} />
                                            </button>
                                        </div>
                                    ) : (
                                        <button
                                            className={`btn-add-cart ${addedId === product.id ? 'added' : ''}`}
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                addToCart(product);
                                            }}
                                        >
                                            {addedId === product.id ? (
                                                <><Check size={16} /> Ajouté</>
                                            ) : (
                                                <><Plus size={16} /> Ajouter</>
                                            )}
                                        </button>
                                    )
                                )}
                            </div>
                        </motion.div>
                    );
                })}
            </div>
        );
    }, [filteredAndSortedProducts, favorites, cart, addedId, searchQuery]);

    const totalAmount = cart.reduce((acc, item) => acc + ((item.product.price_sale || 0) * item.quantity), 0);
    const totalItems = cart.reduce((acc, item) => acc + item.quantity, 0);

    // ============================================================
    // 📡 DATA LOADING
    // ============================================================

    const loadShopData = async () => {
        try {
            setLoading(true);
            console.log('🔍 Chargement de la boutique pour le slug:', slug);

            // Charger la boutique (publique uniquement)
            const { data: shopData, error: shopError } = await supabase
                .from('shops')
                .select('*')
                .ilike('slug', slug || '')
                .eq('is_public', true)
                .single();

            if (shopError || !shopData) {
                console.error('❌ Boutique introuvable ou non publique:', shopError);
                throw new Error('Boutique introuvable');
            }

            console.log('✅ Boutique trouvée:', shopData);
            setShop(shopData);

            // Charger les produits actifs
            const { data: productData, error: productError } = await supabase
                .from('products')
                .select('*')
                .eq('shop_id', shopData.id)
                .eq('is_active', true)
                .order('name');

            if (productError) throw productError;

            console.log('📦 Produits chargés:', productData?.length);
            setProducts(productData || []);

        } catch (err) {
            console.error('💥 Erreur chargement:', err);
        } finally {
            setLoading(false);
        }
    };

    // ============================================================
    // 🛒 CART ACTIONS
    // ============================================================

    const addToCart = (product: Product, quantity: number = 1) => {
        if (navigator.vibrate) navigator.vibrate(50);

        setAddedId(product.id);
        setTimeout(() => setAddedId(null), 1500);

        setCart(prev => {
            const existing = prev.find(item => item.product.id === product.id);
            if (existing) {
                return prev.map(item =>
                    item.product.id === product.id ? { ...item, quantity: item.quantity + quantity } : item
                );
            }
            return [...prev, { product, quantity }];
        });
    };

    const updateQuantity = (productId: string, delta: number) => {
        setCart(prev => prev.map(item => {
            if (item.product.id === productId) {
                const newQuantity = Math.max(0, item.quantity + delta);
                return { ...item, quantity: newQuantity };
            }
            return item;
        }).filter(item => item.quantity > 0));
    };

    const setManualQuantity = (productId: string, quantity: number) => {
        const val = Math.max(0, quantity);
        setCart(prev => prev.map(item => {
            if (item.product.id === productId) {
                return { ...item, quantity: val };
            }
            return item;
        }).filter(item => item.quantity > 0));
    };

    const removeFromCart = (productId: string) => {
        setCart(prev => prev.filter(item => item.product.id !== productId));
    };

    const toggleFavorite = (productId: string) => {
        if (navigator.vibrate) navigator.vibrate(30);
        setFavorites(prev =>
            prev.includes(productId)
                ? prev.filter(id => id !== productId)
                : [...prev, productId]
        );
    };

    // ============================================================
    // 📲 WHATSAPP LINK
    // ============================================================

    const generateWhatsAppLink = (orderId?: string) => {
        if (!shop) return '';

        const shopPhone = shop.whatsapp || shop.phone || '';
        const cleanPhone = shopPhone.replace(/\D/g, '');

        const itemsList = cart.map(item =>
            `• ${item.product.name} x${item.quantity} = ${formatPrice(item.product.price_sale * item.quantity)}`
        ).join('\n');

        let locationLink = '';
        if (customerInfo.location) {
            locationLink = `\n📍 *Position GPS:* https://www.google.com/maps?q=${customerInfo.location.lat},${customerInfo.location.lng}`;
        }

        const receiptUrl = `${window.location.origin}/receipt/${orderId}`;
        const message = `📦 *NOUVELLE COMMANDE VELMO*

🏪 *Boutique:* ${shop.name}
${orderId ? `🆔 *Réf:* #${orderId.slice(0, 8).toUpperCase()}` : ''}

👤 *Client:* ${customerInfo.name}
📱 *Téléphone:* ${customerInfo.phone}
${customerInfo.address ? `🏠 *Adresse:* ${customerInfo.address}` : ''}${locationLink}

🛒 *Produits:*
${itemsList}

💰 *TOTAL:* ${formatPrice(totalAmount)}

📍 *Mode:* ${deliveryMethod === 'pickup' ? 'Retrait en boutique' : 'Livraison à domicile'}
${orderNote ? `\n💬 *Note:* ${orderNote}` : ''}

📄 *Voir le reçu :* ${receiptUrl}

---
✅ Envoyé via Velmo`;

        return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
    };

    const requestLocation = () => {
        if (!navigator.geolocation) {
            alert("La géolocalisation n'est pas supportée par votre navigateur.");
            return;
        }
        navigator.geolocation.getCurrentPosition(
            (position) => {
                setCustomerInfo(prev => ({
                    ...prev,
                    location: {
                        lat: position.coords.latitude,
                        lng: position.coords.longitude
                    }
                }));
            },
            () => {
                alert("Impossible de récupérer votre position. Veuillez activer le GPS de votre appareil.");
            },
            {
                enableHighAccuracy: true,
                timeout: 10000,
                maximumAge: 0
            }
        );
    };

    const copyToClipboard = async (text: string) => {
        await navigator.clipboard.writeText(text);
        setCopiedLink(true);
        setTimeout(() => setCopiedLink(false), 2000);
    };

    // ============================================================
    // 📝 ORDER SUBMISSION (CONFORME AU RAPPORT - items_json)
    // ============================================================

    const handleSubmitOrder = async (e: FormEvent) => {
        e.preventDefault();
        if (!shop || cart.length === 0) return;

        try {
            setIsSubmitting(true);

            // Structure items_json conforme au rapport
            const items_json: OrderItem[] = cart.map(item => ({
                id: item.product.id,
                name: item.product.name,
                price: item.product.price_sale || 0,
                quantity: item.quantity,
                photo_url: item.product.photo_url || null
            }));

            const orderData = {
                shop_id: shop.id,
                customer_name: customerInfo.name,
                customer_phone: customerInfo.phone,
                customer_address: deliveryMethod === 'delivery' ? customerInfo.address : null,
                customer_location: deliveryMethod === 'delivery' ? (customerInfo.location || null) : null,
                items: items_json, // Compatibilité avec les anciennes versions
                items_json: items_json, // Conforme au rapport Velmo
                total_amount: totalAmount,
                delivery_method: deliveryMethod,
                order_note: orderNote || null,
                status: 'pending'
            };

            console.log('📤 Envoi de la commande:', orderData);

            const { data, error } = await supabase
                .from('customer_orders')
                .insert(orderData)
                .select('id, short_ref')
                .single();

            if (error) {
                console.error('❌ Erreur Supabase:', error);
                throw error;
            }

            console.log('✅ Commande créée:', data);
            setSubmittedOrderId(data?.id || null);
            setSubmittedOrderRef(data?.short_ref || null);

            // 💾 Sauvegarde intelligente pour le tracking futur
            if (data?.short_ref) {
                localStorage.setItem('velmo_last_order_ref', data.short_ref);
            }

            setOrderSuccess(true);
            setCart([]);
            localStorage.removeItem('velmo_cart');

        } catch (err) {
            alert("Une erreur est survenue. Veuillez réessayer.");
            console.error(err);
        } finally {
            setIsSubmitting(false);
        }
    };

    // ============================================================
    // 🎨 RENDER: LOADING
    // ============================================================

    if (loading) {
        return (
            <div className="shop-loading-screen">
                <div className="particles-container">
                    {[...Array(20)].map((_, i) => (
                        <div
                            key={i}
                            className={`particle ${i % 3 === 0 ? 'glow' : ''}`}
                            style={{
                                left: `${Math.random() * 100}%`,
                                width: `${Math.random() * 4 + 2}px`,
                                height: `${Math.random() * 4 + 2}px`,
                                animationDuration: `${Math.random() * 8 + 5}s`,
                                animationDelay: `${Math.random() * 2}s`
                            }}
                        />
                    ))}
                </div>

                <div className="loader-content">
                    <div className="loader-logo-container">
                        <div className="loader-ring"></div>
                        <div className="loader-ring-inner"></div>
                        <svg viewBox="0 0 100 100" fill="none" className="loader-logo">
                            <rect width="100" height="100" rx="28" fill="#ff5500" />
                            <path d="M32 38L50 72L68 38" stroke="white" strokeWidth="10" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                    </div>

                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.2 }}
                    >
                        <h2 className="loading-text">Ouverture de la boutique...</h2>
                        <p className="loading-subtext">Chargement des produits en cours</p>
                    </motion.div>
                </div>
            </div>
        );
    }

    // ============================================================
    // 🎨 RENDER: ERROR (BOUTIQUE NON TROUVÉE)
    // ============================================================

    if (!shop) {
        return (
            <div className="error-screen">
                <Store className="error-icon" size={64} />
                <h1>Boutique introuvable</h1>
                <p>Cette boutique n'existe pas ou n'est pas publique.</p>
                <a href="/" className="btn-back-home">Retour à l'accueil</a>
            </div>
        );
    }

    // ============================================================
    // 🎨 RENDER: MAIN
    // ============================================================

    return (
        <div className="shop-container">
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

            {/* 🔝 Top Actions */}
            <div className="top-actions" style={{
                position: 'absolute',
                top: '1rem',
                right: '1rem',
                zIndex: 50,
                display: 'flex',
                gap: '8px'
            }}>
                <button
                    onClick={() => setIsTrackOpen(true)}
                    className="theme-switch"
                    title="Suivre ma commande"
                    style={{ position: 'relative', top: 0, right: 0 }}
                >
                    <Package size={20} />
                </button>
                <button
                    onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                    className="theme-switch"
                    title="Changer le thème"
                    style={{ position: 'relative', top: 0, right: 0 }}
                >
                    {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
                </button>
            </div>

            {/* 🆕 FAB Track supprimé à la demande de l'utilisateur ("sale") - Accessible via header */}

            {/* ===================== SHOP HEADER ===================== */}

            {/* ===================== SHOP HEADER ===================== */}
            <header className="shop-header">
                {/* 📸 COVER IMAGE */}
                <div className="shop-cover">
                    {getShopCover() ? (
                        <img src={getPublicImageUrl(getShopCover()) || ''} alt={`Couverture ${shop.name}`} />
                    ) : (
                        <div className="shop-cover-fallback"></div>
                    )}
                    <div className="shop-cover-overlay"></div>
                </div>

                <div className="shop-header-content">
                    {/* 🖼️ Logo */}
                    <div className="shop-logo-container">
                        {getShopLogo() ? (
                            <img src={getPublicImageUrl(getShopLogo()) || ''} alt={shop.name} className="shop-logo" />
                        ) : (
                            <div className="shop-logo-fallback">
                                {shop.name.substring(0, 2).toUpperCase()}
                            </div>
                        )}
                    </div>

                    {/* 🏅 Badges */}
                    <div className="shop-badge-container">
                        {shop.is_verified && (
                            <span className="shop-badge verified">
                                <BadgeCheck size={14} />
                                Boutique vérifiée
                            </span>
                        )}
                        {shop.orders_count && shop.orders_count > 50 && (
                            <span className="shop-badge orders">
                                <Users size={14} />
                                +{shop.orders_count} commandes
                            </span>
                        )}
                    </div>

                    {/* 📛 Titre */}
                    <h1 className="shop-title">{shop.name}</h1>

                    {/* 📍 Info Bar */}
                    <div className="shop-info-bar">
                        {shop.location && (
                            <div className="info-badge">
                                <MapPin size={14} />
                                <span>{shop.location}</span>
                            </div>
                        )}
                        {shop.opening_hours && (
                            <div className="info-badge">
                                <Clock size={14} />
                                <span>{shop.opening_hours}</span>
                            </div>
                        )}
                        {(shop.whatsapp || shop.phone) && (
                            <a
                                href={`https://wa.me/${(shop.whatsapp || shop.phone)?.replace(/\D/g, '')}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="info-badge whatsapp-badge"
                            >
                                <MessageCircle size={14} />
                                <span>Contacter</span>
                            </a>
                        )}
                    </div>

                    {/* 📝 Description */}
                    {shop.description && (
                        <p className="shop-description">{shop.description}</p>
                    )}
                </div>

                {/* 🔍 Search & Filter */}
                <div className="search-filter-row">
                    <div className="search-container" style={{ position: 'relative' }}>
                        <Search className="search-icon" size={20} />
                        <input
                            type="text"
                            placeholder="Rechercher un produit..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="search-input"
                        />
                        {/* 🔍 Résultats de recherche instantanés (Pop-up) */}
                        <AnimatePresence>
                            {searchQuery.length > 0 && (
                                <motion.div
                                    initial={{ opacity: 0, y: -10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -10 }}
                                    className="search-dropdown"
                                    style={{
                                        position: 'absolute',
                                        top: '100%',
                                        left: 0,
                                        right: 0,
                                        backgroundColor: 'var(--bg-secondary)',
                                        borderRadius: '0 0 var(--radius-lg) var(--radius-lg)',
                                        boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.3)',
                                        zIndex: 100,
                                        marginTop: '4px',
                                        border: '1px solid var(--border-color)',
                                        maxHeight: '60vh',
                                        overflowY: 'auto',
                                        padding: '0.5rem'
                                    }}
                                >
                                    {filteredAndSortedProducts.length > 0 ? (
                                        filteredAndSortedProducts.map(product => (
                                            <div
                                                key={product.id}
                                                onClick={() => {
                                                    setSelectedProduct(product);
                                                    setSearchQuery(''); // Optionnel : effacer la recherche après sélection
                                                }}
                                                style={{
                                                    display: 'flex',
                                                    gap: '12px',
                                                    padding: '10px',
                                                    borderBottom: '1px solid var(--border-color)',
                                                    cursor: 'pointer',
                                                    alignItems: 'center'
                                                }}
                                                className="search-result-item"
                                            >
                                                <div style={{ width: '40px', height: '40px', borderRadius: '8px', overflow: 'hidden', flexShrink: 0 }}>
                                                    {product.photo_url ? (
                                                        <img src={getPublicImageUrl(product.photo_url) || ''} alt={product.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                                    ) : (
                                                        <div style={{ width: '100%', height: '100%', backgroundColor: 'var(--bg-tertiary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                            <Store size={16} />
                                                        </div>
                                                    )}
                                                </div>
                                                <div style={{ flex: 1 }}>
                                                    <h4 style={{ fontSize: '0.9rem', margin: 0, color: 'var(--text-primary)' }}>{product.name}</h4>
                                                    <p style={{ fontSize: '0.8rem', margin: 0, color: 'var(--primary)', fontWeight: 600 }}>{formatPrice(product.price_sale)}</p>
                                                </div>
                                                <div style={{ width: '24px', height: '24px', borderRadius: '50%', backgroundColor: 'var(--bg-tertiary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                    <Plus size={14} />
                                                </div>
                                            </div>
                                        ))
                                    ) : (
                                        <div style={{ padding: '1rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                                            <p>Aucun produit trouvé</p>
                                        </div>
                                    )}
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                    <button
                        className={`filter-toggle ${showFilters ? 'active' : ''}`}
                        onClick={() => setShowFilters(!showFilters)}
                    >
                        <Filter size={18} />
                        <ChevronDown size={16} className={`chevron ${showFilters ? 'rotated' : ''}`} />
                    </button>
                </div>

                {/* Filters Panel */}
                <AnimatePresence>
                    {showFilters && (
                        <motion.div
                            className="filters-panel"
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                        >
                            <div className="filter-group">
                                <span className="filter-label">Trier par</span>
                                <div className="filter-options">
                                    {[
                                        { value: 'default', label: 'Défaut' },
                                        { value: 'price-asc', label: 'Prix ↑' },
                                        { value: 'price-desc', label: 'Prix ↓' },
                                        { value: 'name', label: 'A-Z' },
                                    ].map(opt => (
                                        <button
                                            key={opt.value}
                                            className={`filter-chip ${sortOption === opt.value ? 'active' : ''}`}
                                            onClick={() => setSortOption(opt.value as SortOption)}
                                        >
                                            {opt.label}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div className="filter-group">
                                <span className="filter-label">Afficher</span>
                                <div className="filter-options">
                                    {[
                                        { value: 'all', label: 'Tous' },
                                        { value: 'available', label: '✅ Dispo' },
                                        { value: 'new', label: '🆕 Nouveau' },
                                    ].map(opt => (
                                        <button
                                            key={opt.value}
                                            className={`filter-chip ${filterOption === opt.value ? 'active' : ''}`}
                                            onClick={() => setFilterOption(opt.value as FilterOption)}
                                        >
                                            {opt.label}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Categories */}
                {categories.length > 1 && (
                    <div className="category-scroll">
                        {categories.map(cat => (
                            <button
                                key={cat as string}
                                onClick={() => setSelectedCategory(cat as string)}
                                className={`category-pill ${selectedCategory === cat ? 'active' : ''}`}
                            >
                                {cat as string}
                            </button>
                        ))}
                    </div>
                )}
            </header>

            {/* ===================== PRODUCTS GRID ===================== */}
            <section className="products-section">
                {/* ✨ Section Intelligente "Pour Vous" */}
                {!searchQuery && selectedCategory === 'Tout' && recommendedProducts.length > 0 && (
                    <div className="recommendations-container" style={{ marginBottom: '2rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '1rem', padding: '0 4px' }}>
                            <div style={{ width: '4px', height: '20px', background: 'var(--primary)', borderRadius: '2px' }}></div>
                            <h3 style={{ fontSize: '1.2rem', fontWeight: 700 }}>Pour vous</h3>
                        </div>
                        <div className="recommendations-scroll" style={{
                            display: 'flex',
                            gap: '12px',
                            overflowX: 'auto',
                            paddingBottom: '12px',
                            margin: '0 -1rem',
                            padding: '0 1rem 12px 1rem',
                            scrollbarWidth: 'none'
                        }}>
                            {recommendedProducts.map((product) => (
                                <motion.div
                                    key={`rec-${product.id}`}
                                    className="recommendation-card"
                                    whileTap={{ scale: 0.95 }}
                                    onClick={() => setSelectedProduct(product)}
                                    style={{
                                        flex: '0 0 160px',
                                        background: 'var(--bg-secondary)',
                                        borderRadius: 'var(--radius-lg)',
                                        overflow: 'hidden',
                                        border: '1px solid var(--border-color)',
                                        cursor: 'pointer'
                                    }}
                                >
                                    <div style={{ width: '100%', height: '120px', position: 'relative' }}>
                                        {product.photo_url ? (
                                            <img
                                                src={getPublicImageUrl(product.photo_url) || ''}
                                                alt={product.name}
                                                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                            />
                                        ) : (
                                            <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-tertiary)' }}>
                                                <Store size={24} style={{ opacity: 0.3 }} />
                                            </div>
                                        )}
                                        {productViews[product.id] > 5 && (
                                            <div style={{ position: 'absolute', top: '6px', right: '6px', background: 'var(--primary)', color: 'white', fontSize: '10px', padding: '2px 6px', borderRadius: '4px', fontWeight: 800 }}>
                                                POPULAIRE
                                            </div>
                                        )}
                                    </div>
                                    <div style={{ padding: '8px' }}>
                                        <h4 style={{ fontSize: '0.85rem', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{product.name}</h4>
                                        <p style={{ fontSize: '0.8rem', color: 'var(--primary)', fontWeight: 700, marginTop: '2px' }}>{formatPrice(product.price_sale)}</p>
                                    </div>
                                </motion.div>
                            ))}
                        </div>
                    </div>
                )}

                {productGrid}
            </section>

            {/* ===================== TRUST SECTION ===================== */}
            <section className="trust-section">
                <h3>Pourquoi commander chez nous ?</h3>
                <div className="trust-grid">
                    <div className="trust-card">
                        <div className="trust-icon blue"><CreditCard size={22} /></div>
                        <h4>Paiement à la livraison</h4>
                        <p>Payez seulement à réception</p>
                    </div>
                    <div className="trust-card">
                        <div className="trust-icon green"><Shield size={22} /></div>
                        <h4>Commande sécurisée</h4>
                        <p>Données protégées</p>
                    </div>
                    <div className="trust-card">
                        <div className="trust-icon orange"><MessageCircle size={22} /></div>
                        <h4>Support WhatsApp</h4>
                        <p>Assistance 7j/7</p>
                    </div>
                </div>
            </section>

            {/* ===================== FOOTER ===================== */}
            <footer className="shop-footer">
                <div className="footer-logo">
                    <svg viewBox="0 0 100 100" fill="none">
                        <rect width="100" height="100" rx="28" fill="#ff5500" />
                        <path d="M32 38L50 72L68 38" stroke="white" strokeWidth="10" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                </div>
                <p className="footer-text">
                    Propulsé par <a href="https://velmo.market" target="_blank" rel="noopener noreferrer">Velmo</a>
                </p>
            </footer>

            {/* ===================== FLOATING CART BUTTON ===================== */}
            {cart.length > 0 && (
                <motion.button
                    className="cart-floating"
                    onClick={() => setIsCartOpen(true)}
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    whileTap={{ scale: 0.95 }}
                >
                    <ShoppingCart size={22} />
                    <span className="cart-badge">{totalItems}</span>
                    <span>{formatPrice(totalAmount)}</span>
                </motion.button>
            )}

            {/* ===================== CART SHEET ===================== */}
            <AnimatePresence>
                {isCartOpen && (
                    <>
                        <motion.div
                            className="cart-overlay"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setIsCartOpen(false)}
                        />
                        <motion.div
                            className="cart-sheet"
                            initial={{ x: '100%' }}
                            animate={{ x: 0 }}
                            exit={{ x: '100%' }}
                            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                        >
                            <div className="cart-header">
                                <h2>
                                    <ShoppingCart size={24} />
                                    {orderSuccess ? 'Commande confirmée' : `Panier (${totalItems})`}
                                </h2>
                                <button className="btn-close-cart" onClick={() => setIsCartOpen(false)}>
                                    <X size={24} />
                                </button>
                            </div>

                            {orderSuccess ? (
                                <div className="order-success" style={{ padding: '2rem 1rem', display: 'flex', flexDirection: 'column', height: '100%', overflowY: 'auto' }}>
                                    <div className="success-icon">
                                        <CheckCircle2 size={40} />
                                    </div>
                                    <h2>Commande envoyée ! 🎉</h2>
                                    <p>Merci pour votre commande.</p>

                                    {submittedOrderId && (
                                        <div className="order-id">
                                            <span>Réf: #{submittedOrderRef || submittedOrderId?.slice(0, 8).toUpperCase()}</span>
                                            <button onClick={() => copyToClipboard(submittedOrderRef || submittedOrderId || '')}>
                                                {copiedLink ? <Check size={16} /> : <Copy size={16} />}
                                            </button>
                                        </div>
                                    )}

                                    <a
                                        href={generateWhatsAppLink(submittedOrderId || undefined)}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="whatsapp-btn"
                                        style={{ marginBottom: '0.75rem' }}
                                    >
                                        <MessageCircle size={20} />
                                        Envoyer sur WhatsApp
                                    </a>

                                    {submittedOrderId && (
                                        <Link
                                            to={`/receipt/${submittedOrderId}`}
                                            className="btn-checkout"
                                            style={{
                                                marginBottom: '0.75rem',
                                                width: '100%',
                                                textDecoration: 'none',
                                                display: 'flex',
                                                justifyContent: 'center',
                                                backgroundColor: 'var(--primary)',
                                                color: 'white',
                                                zIndex: 10,
                                                position: 'relative',
                                                cursor: 'pointer'
                                            }}
                                        >
                                            <Printer size={20} />
                                            Voir mon reçu / Imprimer
                                        </Link>
                                    )}

                                    <button
                                        className="btn-close-modal"
                                        style={{ width: '100%', borderRadius: 'var(--radius-lg)' }}
                                        onClick={() => {
                                            setIsCartOpen(false);
                                            setOrderSuccess(false);
                                            setCustomerInfo({ name: '', phone: '', address: '' });
                                            setOrderNote('');
                                        }}
                                    >
                                        Fermer et continuer
                                    </button>
                                </div>
                            ) : cart.length === 0 ? (
                                <div className="cart-empty">
                                    <ShoppingBag size={64} />
                                    <p>Votre panier est vide</p>
                                </div>
                            ) : (
                                <form
                                    id="checkout-form"
                                    onSubmit={handleSubmitOrder}
                                    style={{
                                        display: 'flex',
                                        flexDirection: 'column',
                                        height: '100%',
                                        overflow: 'hidden'
                                    }}
                                >
                                    <div className="cart-items" style={{ flex: 1, overflowY: 'auto', overscrollBehavior: 'contain' }}>
                                        {/* ITEMS LIST */}
                                        {cart.map(item => (
                                            <div key={item.product.id} className="cart-item">
                                                <div className="cart-item-img">
                                                    {item.product.photo_url ? (
                                                        <img src={getPublicImageUrl(item.product.photo_url) || ''} alt={item.product.name} />
                                                    ) : (
                                                        <Store size={24} />
                                                    )}
                                                </div>
                                                <div className="cart-item-info">
                                                    <div className="cart-item-name">{item.product.name}</div>
                                                    <div className="cart-item-price">{formatPrice(item.product.price_sale)}</div>
                                                    <div className="cart-item-actions">
                                                        <button type="button" className="qty-btn" onClick={() => updateQuantity(item.product.id, -1)}>
                                                            <Minus size={14} />
                                                        </button>
                                                        <input
                                                            type="number"
                                                            className="qty-input"
                                                            value={item.quantity}
                                                            onChange={(e) => setManualQuantity(item.product.id, parseInt(e.target.value) || 0)}
                                                            min="0"
                                                        />
                                                        <button type="button" className="qty-btn" onClick={() => updateQuantity(item.product.id, 1)}>
                                                            <Plus size={14} />
                                                        </button>
                                                    </div>
                                                </div>
                                                <div className="cart-item-remove">
                                                    <button type="button" className="btn-remove" onClick={() => removeFromCart(item.product.id)}>
                                                        <Trash2 size={14} />
                                                    </button>
                                                </div>
                                            </div>
                                        ))}

                                        {/* CHECKOUT FORM FIELDS */}
                                        <div style={{ padding: '1.5rem 0 0.5rem', borderTop: '1px solid var(--border-color)', marginTop: '1rem' }}>
                                            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                <Users size={18} /> Vos coordonnées
                                            </h3>

                                            <div className="form-group">
                                                <label className="form-label required">Nom complet</label>
                                                <input
                                                    type="text"
                                                    className="form-input"
                                                    placeholder="Ex: Mamadou Diallo"
                                                    value={customerInfo.name}
                                                    onChange={(e) => setCustomerInfo({ ...customerInfo, name: e.target.value })}
                                                    required
                                                />
                                            </div>

                                            <div className="form-group">
                                                <label className="form-label required">Téléphone</label>
                                                <input
                                                    type="tel"
                                                    className="form-input"
                                                    placeholder="Ex: 622001234"
                                                    value={customerInfo.phone}
                                                    onChange={(e) => setCustomerInfo({ ...customerInfo, phone: e.target.value })}
                                                    required
                                                />
                                            </div>

                                            <div className="form-group">
                                                <label className="form-label">Mode de retrait</label>
                                                <div className="delivery-toggle">
                                                    <button
                                                        type="button"
                                                        className={`delivery-option ${deliveryMethod === 'pickup' ? 'active' : ''}`}
                                                        onClick={() => setDeliveryMethod('pickup')}
                                                    >
                                                        <Store size={24} />
                                                        <span>Retrait</span>
                                                    </button>
                                                    <button
                                                        type="button"
                                                        className={`delivery-option ${deliveryMethod === 'delivery' ? 'active' : ''}`}
                                                        onClick={() => setDeliveryMethod('delivery')}
                                                    >
                                                        <Truck size={24} />
                                                        <span>Livraison</span>
                                                    </button>
                                                </div>
                                            </div>

                                            {deliveryMethod === 'delivery' && (
                                                <div className="form-group">
                                                    <label className="form-label required">Adresse / Lieu</label>
                                                    <input
                                                        type="text"
                                                        className="form-input"
                                                        placeholder="Ex: Kaloum, près de la banque..."
                                                        value={customerInfo.address}
                                                        onChange={(e) => setCustomerInfo({ ...customerInfo, address: e.target.value })}
                                                        required={deliveryMethod === 'delivery'}
                                                    />
                                                    <button
                                                        type="button"
                                                        className={`delivery-option ${customerInfo.location ? 'active' : ''}`}
                                                        onClick={requestLocation}
                                                        style={{ marginTop: '10px', width: '100%', flexDirection: 'row', gap: '10px', padding: '10px' }}
                                                    >
                                                        <MapPin size={20} />
                                                        <span>{customerInfo.location ? 'Position GPS incluse ✅' : 'Ajouter ma position GPS'}</span>
                                                    </button>
                                                </div>
                                            )}

                                            <div className="form-group">
                                                <label className="form-label">Note (optionnel)</label>
                                                <textarea
                                                    className="form-input"
                                                    placeholder="Instructions spéciales..."
                                                    value={orderNote}
                                                    onChange={(e) => setOrderNote(e.target.value)}
                                                    rows={2}
                                                    style={{ minHeight: '60px' }}
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    <div className="cart-footer">
                                        <div className="cart-total">
                                            <span className="cart-total-label">Total à payer</span>
                                            <span className="cart-total-amount">{formatPrice(totalAmount)}</span>
                                        </div>
                                        <button
                                            type="submit"
                                            form="checkout-form"
                                            className="btn-checkout"
                                            disabled={isSubmitting || !customerInfo.name || !customerInfo.phone}
                                        >
                                            {isSubmitting ? (
                                                <><Loader2 size={20} className="animate-spin" /> Envoi en cours...</>
                                            ) : (
                                                <><Check size={20} /> Confirmer la commande</>
                                            )}
                                        </button>
                                    </div>
                                </form>
                            )}

                        </motion.div>
                    </>
                )}
            </AnimatePresence>


            {/* ===================== PRODUCT MODAL ===================== */}
            <AnimatePresence>
                {selectedProduct && (
                    <>
                        <motion.div
                            className="product-modal-overlay"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setSelectedProduct(null)}
                        />
                        <div className="product-modal-container">
                            <motion.div
                                className="product-modal-content"
                                initial={{ y: '100%' }}
                                animate={{ y: 0 }}
                                exit={{ y: '100%' }}
                                transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                            >
                                <button className="btn-close-modal" onClick={() => setSelectedProduct(null)}>
                                    <X size={24} />
                                </button>
                                <button
                                    className="btn-share-modal"
                                    onClick={() => {
                                        const url = window.location.href;
                                        const text = `Découvre ${selectedProduct.name} chez ${shop.name} - ${formatPrice(selectedProduct.price_sale)}`;
                                        window.open(`https://wa.me/?text=${encodeURIComponent(text + '\n' + url)}`, '_blank');
                                    }}
                                >
                                    <Share2 size={18} />
                                </button>

                                <div className="product-modal-img">
                                    {selectedProduct.photo_url ? (
                                        <img
                                            src={getPublicImageUrl(selectedProduct.photo_url) || ''}
                                            alt={selectedProduct.name}
                                        />
                                    ) : (
                                        <Store size={64} />
                                    )}
                                </div>

                                <div className="product-modal-info">
                                    <div className="modal-badges">
                                        {selectedProduct.category && (
                                            <span className="modal-category">{selectedProduct.category}</span>
                                        )}
                                        <span className={`stock-badge stock-${getStockStatus(selectedProduct).color}`}>
                                            {getStockStatus(selectedProduct).label}
                                        </span>
                                    </div>

                                    <h2 className="product-modal-name">{selectedProduct.name}</h2>
                                    <p className="product-modal-price">{formatPrice(selectedProduct.price_sale)}</p>

                                    {selectedProduct.description && (
                                        <p className="product-modal-description">{selectedProduct.description}</p>
                                    )}

                                    {selectedProduct.is_active && (
                                        <>
                                            <div className="product-modal-qty">
                                                <button
                                                    className="modal-qty-btn"
                                                    onClick={() => setModalQuantity(Math.max(1, modalQuantity - 1))}
                                                >
                                                    <Minus size={20} />
                                                </button>
                                                <span className="modal-qty-display">{modalQuantity}</span>
                                                <button
                                                    className="modal-qty-btn"
                                                    onClick={() => setModalQuantity(modalQuantity + 1)}
                                                >
                                                    <Plus size={20} />
                                                </button>
                                            </div>

                                            <button
                                                className="btn-add-to-cart-modal"
                                                onClick={() => {
                                                    addToCart(selectedProduct, modalQuantity);
                                                    setSelectedProduct(null);
                                                }}
                                            >
                                                <ShoppingBag size={20} />
                                                Ajouter au panier ({formatPrice(selectedProduct.price_sale * modalQuantity)})
                                            </button>
                                        </>
                                    )}
                                </div>
                            </motion.div>
                        </div>
                    </>
                )}
            </AnimatePresence>

            {/* 🕵️ Track Order Modal */}
            <AnimatePresence>
                {isTrackOpen && (
                    <>
                        <motion.div
                            className="modal-overlay"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setIsTrackOpen(false)}
                        />
                        <motion.div
                            className="modal-content"
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.9 }}
                            style={{ maxWidth: '400px', width: '90%', margin: 'auto' }}
                        >
                            <button className="modal-close" onClick={() => setIsTrackOpen(false)}>
                                <X size={24} />
                            </button>

                            <div className="modal-header">
                                <Package size={32} style={{ color: 'var(--primary)', marginBottom: '1rem' }} />
                                <h2>Suivre ma commande</h2>
                                <p style={{ color: 'var(--text-muted)' }}>
                                    Entrez votre numéro de référence pour afficher votre ticket.
                                </p>
                            </div>

                            <div className="form-group" style={{ marginTop: '1.5rem' }}>
                                <label className="form-label">Code Suivi (Ex: CMD-X7Y8...)</label>
                                <input
                                    type="text"
                                    className="form-input"
                                    placeholder="Entrez votre code..."
                                    value={trackInput}
                                    onChange={(e) => setTrackInput(e.target.value.toUpperCase())}
                                    autoFocus
                                />
                            </div>

                            <button
                                className="btn-checkout"
                                style={{ width: '100%', marginTop: '1rem', justifyContent: 'center' }}
                                disabled={!trackInput.trim()}
                                onClick={() => {
                                    if (trackInput.trim()) {
                                        navigate(`/receipt/${trackInput.trim()}`);
                                    }
                                }}
                            >
                                <Search size={20} />
                                Rechercher
                            </button>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
        </div>
    );
}
