import { useState, useEffect, type FormEvent, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import type { Shop, Product } from '../lib/supabase';
import {
    ShoppingBag, Plus, Minus, Trash2, X, Check, Loader2, Store, ArrowRight, ShoppingCart,
    Moon, Sun, MapPin, Truck, Search, Clock, Phone, Heart, Share2, MessageCircle,
    Shield, CreditCard, Users, Star, Filter, ChevronDown, ExternalLink, Copy, CheckCircle2, BadgeCheck
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface CartItem {
    product: Product;
    quantity: number;
}

type SortOption = 'default' | 'price-asc' | 'price-desc' | 'name' | 'popular';
type FilterOption = 'all' | 'available' | 'new';

export default function ShopPage() {
    const { slug } = useParams<{ slug: string }>();
    const [shop, setShop] = useState<Shop | null>(null);
    const [products, setProducts] = useState<Product[]>([]);
    const [loading, setLoading] = useState(true);

    // Theme Management
    const [theme, setTheme] = useState<'light' | 'dark'>(() => {
        const saved = localStorage.getItem('theme');
        if (saved === 'light' || saved === 'dark') return saved;
        return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    });

    useEffect(() => {
        document.documentElement.setAttribute('data-theme', theme);
        localStorage.setItem('theme', theme);
    }, [theme]);

    // Cart & Order State
    const [cart, setCart] = useState<CartItem[]>(() => {
        const saved = localStorage.getItem('velmo_cart');
        return saved ? JSON.parse(saved) : [];
    });
    const [isCartOpen, setIsCartOpen] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [orderSuccess, setOrderSuccess] = useState(false);
    const [submittedOrderId, setSubmittedOrderId] = useState<string | null>(null);
    const [addedId, setAddedId] = useState<string | null>(null);

    // Form State
    const [customerInfo, setCustomerInfo] = useState({ name: '', phone: '' });
    const [orderNote, setOrderNote] = useState('');
    const [deliveryMethod, setDeliveryMethod] = useState<'pickup' | 'delivery'>('pickup');

    // Product Modal State
    const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
    const [modalQuantity, setModalQuantity] = useState(1);

    // Search & Filter State
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedCategory, setSelectedCategory] = useState<string>('Tout');
    const [sortOption, setSortOption] = useState<SortOption>('default');
    const [filterOption, setFilterOption] = useState<FilterOption>('all');
    const [showFilters, setShowFilters] = useState(false);

    // Favorites
    const [favorites, setFavorites] = useState<string[]>(() => {
        const saved = localStorage.getItem('velmo_favorites');
        return saved ? JSON.parse(saved) : [];
    });

    // Share Modal
    const [showShareModal, setShowShareModal] = useState(false);
    const [copiedLink, setCopiedLink] = useState(false);

    useEffect(() => {
        localStorage.setItem('velmo_cart', JSON.stringify(cart));
    }, [cart]);

    useEffect(() => {
        localStorage.setItem('velmo_favorites', JSON.stringify(favorites));
    }, [favorites]);

    useEffect(() => {
        if (slug) loadShopData();
    }, [slug]);

    // Helpers
    const formatPrice = (price: number | null | undefined) => {
        if (!price || isNaN(price) || price === 0) return "Prix sur demande";
        return `${price.toLocaleString('fr-FR')} GNF`;
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

            // Filter options
            let matchesFilter = true;
            if (filterOption === 'available') matchesFilter = product.is_active;
            if (filterOption === 'new') {
                const oneWeekAgo = new Date();
                oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
                matchesFilter = product.created_at ? new Date(product.created_at) > oneWeekAgo : false;
            }

            return matchesSearch && matchesCategory && matchesFilter;
        });

        // Sorting
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
            case 'popular':
                result.sort((a, b) => (b.is_popular ? 1 : 0) - (a.is_popular ? 1 : 0));
                break;
        }

        return result;
    }, [products, searchQuery, selectedCategory, sortOption, filterOption]);

    const loadShopData = async () => {
        try {
            setLoading(true);
            const { data: shopData, error: shopError } = await supabase
                .from('shops')
                .select('*')
                .ilike('slug', slug || '') // Case-insensitive match 🔍
                .eq('is_public', true)
                .single();

            if (shopError || !shopData) throw new Error('Boutique introuvable');
            setShop(shopData);

            const { data: productData, error: productError } = await supabase
                .from('products')
                .select('*')
                .eq('shop_id', shopData.id)
                .eq('is_visible', true)
                .eq('is_active', true)
                .order('name');

            if (productError) throw productError;
            setProducts(productData || []);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const addToCart = (product: Product, quantity: number = 1) => {
        if (navigator.vibrate) navigator.vibrate(50);

        // Visual feedback
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
                setAddedId(productId);
                setTimeout(() => setAddedId(null), 1000);
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

    const toggleFavorite = (productId: string) => {
        if (navigator.vibrate) navigator.vibrate(30);
        setFavorites(prev =>
            prev.includes(productId)
                ? prev.filter(id => id !== productId)
                : [...prev, productId]
        );
    };

    const totalAmount = cart.reduce((acc, item) => acc + ((item.product.price_sale || 0) * item.quantity), 0);
    const totalItems = cart.reduce((acc, item) => acc + item.quantity, 0);

    // 📲 WhatsApp Deep Link Generator (OPTION B - Zero Backend)
    const generateWhatsAppLink = (orderId?: string) => {
        if (!shop) return '';

        const shopPhone = shop.whatsapp || shop.phone || '';
        const cleanPhone = shopPhone.replace(/\D/g, '');

        const itemsList = cart.map(item =>
            `• ${item.product.name} x${item.quantity} = ${formatPrice(item.product.price_sale * item.quantity)}`
        ).join('\n');

        const message = `📦 *NOUVELLE COMMANDE VELMO*

🏪 *Boutique:* ${shop.name}
${orderId ? `🆔 *Réf:* #${orderId.slice(0, 8).toUpperCase()}` : ''}

👤 *Client:* ${customerInfo.name}
📱 *Téléphone:* ${customerInfo.phone}

🛒 *Produits:*
${itemsList}

💰 *TOTAL:* ${formatPrice(totalAmount)}

📍 *Mode:* ${deliveryMethod === 'pickup' ? 'Retrait en boutique' : 'Livraison à domicile'}
${orderNote ? `\n💬 *Note:* ${orderNote}` : ''}

---
✅ Envoyé via Velmo`;

        return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
    };

    // 📤 Share Cart Link
    const generateShareCartLink = () => {
        if (cart.length === 0) return '';

        const itemsList = cart.map(item =>
            `• ${item.product.name} x${item.quantity}`
        ).join('\n');

        const message = `🛒 *Mon panier chez ${shop?.name}*

${itemsList}

💰 Total: ${formatPrice(totalAmount)}

👉 Voir la boutique: ${window.location.href}`;

        return `https://wa.me/?text=${encodeURIComponent(message)}`;
    };

    // 📤 Share Product Link
    const generateShareProductLink = (product: Product) => {
        const message = `🔥 Regarde ce produit chez ${shop?.name}!

📦 *${product.name}*
💰 ${formatPrice(product.price_sale)}

👉 ${window.location.href}`;

        return `https://wa.me/?text=${encodeURIComponent(message)}`;
    };

    const copyToClipboard = async (text: string) => {
        await navigator.clipboard.writeText(text);
        setCopiedLink(true);
        setTimeout(() => setCopiedLink(false), 2000);
    };

    const handleSubmitOrder = async (e: FormEvent) => {
        e.preventDefault();
        if (!shop || cart.length === 0) return;

        try {
            setIsSubmitting(true);

            const orderData = {
                shop_id: shop.id,
                items: cart.map(item => ({
                    id: item.product.id,
                    name: item.product.name,
                    price: item.product.price_sale || 0,
                    quantity: item.quantity
                })),
                total_amount: totalAmount,
                customer_name: customerInfo.name,
                customer_phone: customerInfo.phone,
                order_note: orderNote,
                delivery_method: deliveryMethod,
                status: 'pending'
            };

            const { data, error } = await supabase
                .from('customer_orders')
                .insert(orderData)
                .select('id')
                .single();

            if (error) throw error;

            setSubmittedOrderId(data?.id || null);
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

    // Get stock status
    const getStockStatus = (product: Product) => {
        if (!product.is_active) return { label: 'Rupture', color: 'red' };
        if (product.stock_quantity !== null && product.stock_quantity !== undefined) {
            if (product.stock_quantity === 0) return { label: 'Rupture', color: 'red' };
            if (product.stock_quantity <= 5) return { label: 'Stock faible', color: 'yellow' };
        }
        return { label: 'Disponible', color: 'green' };
    };

    // ===================== LOADING STATE =====================
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

    // ===================== SHOP NOT FOUND =====================
    if (!shop) {
        return (
            <div className="error-screen">
                <Store className="error-icon" size={64} />
                <h1>Boutique introuvable</h1>
                <p>Cette boutique n'existe pas ou est fermée.</p>
                <a href="/" className="btn-back-home">Retour à l'accueil</a>
            </div>
        );
    }

    // ===================== MAIN RENDER =====================
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

            {/* Theme Toggle */}
            <button
                onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                className="theme-switch"
                title="Changer le thème"
            >
                {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
            </button>

            {/* ===================== SHOP HEADER ===================== */}
            <header className="shop-header">
                {/* 🖼️ COVER IMAGE (NEW!) */}
                {shop.cover_url && (
                    <div className="shop-cover">
                        <img src={shop.cover_url} alt={`Couverture ${shop.name}`} />
                        <div className="shop-cover-overlay"></div>
                    </div>
                )}

                <div className="shop-header-content">
                    {/* Logo Boutique */}
                    {shop.logo_url && (
                        <div className="shop-logo-container">
                            <img src={shop.logo_url} alt={shop.name} className="shop-logo" />
                        </div>
                    )}

                    {/* Badges */}
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

                    {shop.description && (
                        <p className="shop-description">{shop.description}</p>
                    )}
                </div>

                {/* 🔍 Search & Filter */}
                <div className="search-filter-row">
                    <div className="search-container">
                        <Search className="search-icon" size={20} />
                        <input
                            type="text"
                            placeholder="Rechercher un produit..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="search-input"
                        />
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
                                        { value: 'popular', label: '🔥' },
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

            {/* ===================== PRODUCT GRID ===================== */}
            <main className="products-section">
                <div className="product-grid">
                    {filteredAndSortedProducts.map((product, index) => {
                        const stockStatus = getStockStatus(product);
                        const isFavorite = favorites.includes(product.id);

                        return (
                            <motion.div
                                key={product.id}
                                className="product-card"
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: index * 0.03 }}
                                whileHover={{ y: -4 }}
                                onClick={() => {
                                    setSelectedProduct(product);
                                    setModalQuantity(1);
                                }}
                            >
                                <div className="card-img-container">
                                    {product.photo_url ? (
                                        <img src={product.photo_url} alt={product.name} loading="lazy" />
                                    ) : (
                                        <Store size={40} className="placeholder-icon" />
                                    )}

                                    {/* Favorite */}
                                    <button
                                        className={`favorite-btn ${isFavorite ? 'active' : ''}`}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            toggleFavorite(product.id);
                                        }}
                                    >
                                        <Heart size={16} fill={isFavorite ? '#ff5500' : 'none'} />
                                    </button>

                                    {/* Stock Badge */}
                                    <div className={`stock-badge stock-${stockStatus.color}`}>
                                        {stockStatus.label}
                                    </div>

                                    {/* Popular */}
                                    {product.is_popular && (
                                        <div className="popular-badge">
                                            <Star size={10} fill="currentColor" /> Top
                                        </div>
                                    )}
                                </div>

                                <div className="card-content">
                                    <h3 className="product-title">{product.name}</h3>
                                    <div className="product-price">{formatPrice(product.price_sale)}</div>

                                    {product.is_active && (
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
                                    )}
                                </div>
                            </motion.div>
                        );
                    })}

                    {filteredAndSortedProducts.length === 0 && (
                        <div className="empty-products">
                            <ShoppingBag size={48} />
                            <p>Aucun produit trouvé</p>
                            {searchQuery && <span>Essayez une autre recherche</span>}
                        </div>
                    )}
                </div>
            </main>

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

            {/* ===================== PRODUCT MODAL ===================== */}
            <AnimatePresence>
                {selectedProduct && (
                    <>
                        <motion.div
                            className="modal-overlay"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setSelectedProduct(null)}
                        />
                        <div className="product-modal-container">
                            <motion.div
                                className="product-modal"
                                initial={{ y: '100%' }}
                                animate={{ y: 0 }}
                                exit={{ y: '100%' }}
                                transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                            >
                                <button className="btn-close" onClick={() => setSelectedProduct(null)}>
                                    <X size={24} />
                                </button>
                                <button
                                    className="btn-share"
                                    onClick={() => window.open(generateShareProductLink(selectedProduct), '_blank')}
                                >
                                    <Share2 size={18} />
                                </button>

                                <div className="modal-image">
                                    {selectedProduct.photo_url ? (
                                        <img src={selectedProduct.photo_url} alt={selectedProduct.name} />
                                    ) : (
                                        <Store size={64} className="text-slate-300" />
                                    )}
                                </div>

                                <div className="modal-info">
                                    <div className="modal-badges">
                                        {selectedProduct.category && (
                                            <span className="badge-category">{selectedProduct.category}</span>
                                        )}
                                        <span className={`stock-badge stock-${getStockStatus(selectedProduct).color}`}>
                                            {getStockStatus(selectedProduct).label}
                                        </span>
                                    </div>

                                    <h2>{selectedProduct.name}</h2>
                                    <div className="modal-price">{formatPrice(selectedProduct.price_sale)}</div>

                                    {selectedProduct.description && (
                                        <p className="modal-desc">{selectedProduct.description}</p>
                                    )}

                                    <div className="modal-qty-section">
                                        <span>Quantité</span>
                                        <div className="qty-controls">
                                            <button onClick={() => setModalQuantity(Math.max(1, modalQuantity - 1))} className="btn-qty">
                                                <Minus size={18} />
                                            </button>
                                            <span className="qty-value">{modalQuantity}</span>
                                            <button onClick={() => setModalQuantity(modalQuantity + 1)} className="btn-qty">
                                                <Plus size={18} />
                                            </button>
                                        </div>
                                    </div>

                                    <button
                                        className={`btn-add-cart-big ${addedId === selectedProduct.id ? 'added' : ''}`}
                                        onClick={() => {
                                            addToCart(selectedProduct, modalQuantity);
                                            setTimeout(() => setSelectedProduct(null), 600);
                                        }}
                                        disabled={!selectedProduct.is_active}
                                    >
                                        {addedId === selectedProduct.id ? (
                                            <><Check size={20} /> Ajouté !</>
                                        ) : (
                                            <><ShoppingCart size={20} /> Ajouter • {formatPrice(selectedProduct.price_sale * modalQuantity)}</>
                                        )}
                                    </button>
                                </div>
                            </motion.div>
                        </div>
                    </>
                )}
            </AnimatePresence>

            {/* ===================== FLOATING CART ===================== */}
            <AnimatePresence>
                {totalItems > 0 && (
                    <motion.div
                        className="cart-floating"
                        initial={{ scale: 0, y: 50 }}
                        animate={{ scale: 1, y: 0 }}
                        exit={{ scale: 0, y: 50 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => setIsCartOpen(true)}
                    >
                        <div className="cart-count">{totalItems}</div>
                        <span>Panier • {totalAmount.toLocaleString()} GNF</span>
                        <ShoppingBag size={20} />
                    </motion.div>
                )}
            </AnimatePresence>

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
                            initial={{ y: '100%' }}
                            animate={{ y: 0 }}
                            exit={{ y: '100%' }}
                            transition={{ type: 'spring', damping: 28, stiffness: 300 }}
                        >
                            <div className="cart-header">
                                <div className="cart-header-left">
                                    <ShoppingCart size={22} />
                                    <h2>Votre Panier</h2>
                                </div>
                                <div className="cart-header-right">
                                    {cart.length > 0 && (
                                        <button onClick={() => setShowShareModal(true)} className="btn-share-sm">
                                            <Share2 size={16} />
                                        </button>
                                    )}
                                    <button onClick={() => setIsCartOpen(false)} className="btn-close-cart">
                                        <X size={22} />
                                    </button>
                                </div>
                            </div>

                            <div className="cart-body">
                                {orderSuccess ? (
                                    <div className="success-screen">
                                        <div className="success-icon"><CheckCircle2 size={48} /></div>
                                        <h2>Commande Reçue !</h2>
                                        {submittedOrderId && (
                                            <p className="order-ref">#{submittedOrderId.slice(0, 8).toUpperCase()}</p>
                                        )}
                                        <p>Le vendeur va vous contacter sur WhatsApp.</p>

                                        <a
                                            href={generateWhatsAppLink(submittedOrderId || undefined)}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="btn-whatsapp"
                                        >
                                            <MessageCircle size={20} />
                                            Envoyer sur WhatsApp
                                            <ExternalLink size={16} />
                                        </a>

                                        <button
                                            onClick={() => {
                                                setIsCartOpen(false);
                                                setOrderSuccess(false);
                                                setSubmittedOrderId(null);
                                            }}
                                            className="btn-secondary"
                                        >
                                            Fermer
                                        </button>
                                    </div>
                                ) : cart.length === 0 ? (
                                    <div className="empty-cart">
                                        <ShoppingBag size={48} />
                                        <h3>Panier vide</h3>
                                        <p>Ajoutez des produits pour commencer</p>
                                        <button onClick={() => setIsCartOpen(false)} className="btn-primary">
                                            Voir les produits
                                        </button>
                                    </div>
                                ) : (
                                    <>
                                        <div className="cart-items">
                                            {cart.map(item => (
                                                <div key={item.product.id} className="cart-item">
                                                    {item.product.photo_url ? (
                                                        <img src={item.product.photo_url} alt={item.product.name} />
                                                    ) : (
                                                        <div className="cart-item-placeholder"><Store size={20} /></div>
                                                    )}
                                                    <div className="cart-item-info">
                                                        <h4>{item.product.name}</h4>
                                                        <p>{(item.product.price_sale || 0).toLocaleString()} GNF</p>
                                                    </div>
                                                    <div className="qty-controls">
                                                        <button onClick={() => updateQuantity(item.product.id, -1)} className="btn-qty">
                                                            {item.quantity === 1 ? <Trash2 size={14} className="text-red" /> : <Minus size={14} />}
                                                        </button>
                                                        <input
                                                            type="number"
                                                            value={item.quantity}
                                                            onChange={(e) => setManualQuantity(item.product.id, parseInt(e.target.value) || 0)}
                                                            className="qty-input"
                                                        />
                                                        <button onClick={() => updateQuantity(item.product.id, 1)} className="btn-qty">
                                                            <Plus size={14} />
                                                        </button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>

                                        <div className="cart-form">
                                            <h3 className="section-title">📍 Mode de réception</h3>
                                            <div className="delivery-toggle">
                                                <button
                                                    className={`toggle-btn ${deliveryMethod === 'pickup' ? 'active' : ''}`}
                                                    onClick={() => setDeliveryMethod('pickup')}
                                                >
                                                    <MapPin size={16} /> Retrait
                                                </button>
                                                <button
                                                    className={`toggle-btn ${deliveryMethod === 'delivery' ? 'active' : ''}`}
                                                    onClick={() => setDeliveryMethod('delivery')}
                                                >
                                                    <Truck size={16} /> Livraison
                                                </button>
                                            </div>

                                            <h3 className="section-title">👤 Vos coordonnées</h3>
                                            <p className="section-hint">Pas de compte nécessaire</p>

                                            <form onSubmit={handleSubmitOrder}>
                                                <div className="input-group">
                                                    <Users size={16} className="input-icon" />
                                                    <input
                                                        type="text"
                                                        placeholder="Votre nom"
                                                        required
                                                        value={customerInfo.name}
                                                        onChange={e => setCustomerInfo({ ...customerInfo, name: e.target.value })}
                                                    />
                                                </div>
                                                <div className="input-group">
                                                    <Phone size={16} className="input-icon" />
                                                    <input
                                                        type="tel"
                                                        placeholder="Numéro WhatsApp"
                                                        required
                                                        value={customerInfo.phone}
                                                        onChange={e => setCustomerInfo({ ...customerInfo, phone: e.target.value })}
                                                    />
                                                </div>
                                                <textarea
                                                    placeholder="Message (optionnel)"
                                                    rows={2}
                                                    value={orderNote}
                                                    onChange={e => setOrderNote(e.target.value)}
                                                />

                                                <div className="checkout-box">
                                                    <div className="total-row">
                                                        <span>Total</span>
                                                        <span className="total-amount">{totalAmount.toLocaleString()} GNF</span>
                                                    </div>

                                                    <button type="submit" className="btn-checkout" disabled={isSubmitting}>
                                                        {isSubmitting ? (
                                                            <Loader2 className="animate-spin" size={20} />
                                                        ) : (
                                                            <>Confirmer <ArrowRight size={18} /></>
                                                        )}
                                                    </button>

                                                    <p className="reassurance">
                                                        <Check size={12} /> Paiement à la livraison
                                                    </p>
                                                </div>
                                            </form>
                                        </div>
                                    </>
                                )}
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>

            {/* ===================== SHARE MODAL ===================== */}
            <AnimatePresence>
                {showShareModal && (
                    <>
                        <motion.div
                            className="modal-overlay"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setShowShareModal(false)}
                        />
                        <motion.div
                            className="share-modal"
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.9, opacity: 0 }}
                        >
                            <h3>Partager mon panier</h3>
                            <p>Envoyez votre sélection à un ami</p>

                            <a
                                href={generateShareCartLink()}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="btn-whatsapp"
                            >
                                <MessageCircle size={18} />
                                Partager sur WhatsApp
                            </a>

                            <button onClick={() => copyToClipboard(window.location.href)} className="btn-secondary">
                                {copiedLink ? <><Check size={16} /> Copié !</> : <><Copy size={16} /> Copier le lien</>}
                            </button>

                            <button onClick={() => setShowShareModal(false)} className="btn-text">
                                Fermer
                            </button>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>

            {/* ===================== FOOTER ===================== */}
            <footer className="shop-footer">
                <p>Propulsé par <span className="velmo-brand">Velmo</span></p>
            </footer>
        </div>
    );
}