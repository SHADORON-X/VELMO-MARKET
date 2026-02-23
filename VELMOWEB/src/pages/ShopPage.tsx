import { useState, useEffect, useMemo, useCallback, type FormEvent } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { supabase, type Shop, type Product, type OrderItem, type CustomerOrder, type ShopEvent } from '../lib/supabase';
import {
    ShoppingBag, Plus, Minus, Trash2, X, Check, Loader2, Store, ShoppingCart,
    Moon, Sun, MapPin, Truck, Search, Clock, Heart, Share2, MessageCircle,
    Shield, CreditCard, Users, Filter, ChevronDown, CheckCircle2, BadgeCheck, Printer, Package,
    Instagram, Facebook, Twitter, Mail, Globe, ExternalLink, ArrowRight, Phone,
    Sparkles, Shirt, Monitor, Utensils, Home, Dumbbell, Coffee, Zap, Palette, Gift
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

    // 🕵️ Session Tracking
    const [sessionId] = useState(() => {
        const saved = sessionStorage.getItem('velmo_session_id');
        if (saved) return saved;
        const newId = crypto.randomUUID();
        sessionStorage.setItem('velmo_session_id', newId);
        return newId;
    });

    const [categoryViews, setCategoryViews] = useState<Record<string, number>>(() => {
        const saved = localStorage.getItem('velmo_category_views');
        return saved ? JSON.parse(saved) : {};
    });

    // 📝 Order State
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [orderSuccess, setOrderSuccess] = useState(false);
    const [submittedOrderId, setSubmittedOrderId] = useState<string | null>(null);
    const [submittedOrderRef, setSubmittedOrderRef] = useState<string | null>(null);
    const [trackedOrder, setTrackedOrder] = useState<CustomerOrder | null>(null);
    const [ticketImageUrl, setTicketImageUrl] = useState<string | null>(null);
    const [ticketBlob, setTicketBlob] = useState<Blob | null>(null);

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

    // 📦 Smart Pagination State
    const [visibleCount, setVisibleCount] = useState(12);

    // ✨ Mouse tracking for holographic effect
    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            const cards = document.getElementsByClassName('product-card');
            for (const card of cards as any) {
                const rect = card.getBoundingClientRect();
                const x = e.clientX - rect.left;
                const y = e.clientY - rect.top;
                card.style.setProperty('--mouse-x', `${x}px`);
                card.style.setProperty('--mouse-y', `${y}px`);
            }
        };
        window.addEventListener('mousemove', handleMouseMove);
        return () => window.removeEventListener('mousemove', handleMouseMove);
    }, []);

    // Reset pagination on search/filter change
    useEffect(() => {
        setVisibleCount(12);
    }, [searchQuery, selectedCategory, sortOption, filterOption]);

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
        localStorage.setItem('velmo_category_views', JSON.stringify(categoryViews));
    }, [categoryViews]);

    // 📡 Analytics Tracking Helper
    const trackEvent = useCallback(async (
        type: ShopEvent['event_type'],
        productId?: string,
        category?: string,
        query?: string,
        metadata?: any
    ) => {
        if (!shop?.id) return;

        try {
            const { error } = await supabase.from('shop_analytics').insert({
                shop_id: shop.id,
                session_id: sessionId,
                event_type: type,
                product_id: productId,
                category: category,
                search_query: query,
                metadata: metadata
            });

            if (error && error.code !== 'PGRST116') { // Ignorer si table manquante ou autre erreur bénigne
                console.warn(`Analytics (${type}) info:`, error.message);
            }
        } catch (err) {
            // Silence absolu en cas d'erreur réseau/code
        }
    }, [shop?.id, sessionId]);

    // Track Visit
    useEffect(() => {
        if (shop?.id) {
            trackEvent('visit');
        }
    }, [shop?.id, trackEvent]);

    useEffect(() => {
        if (slug) {
            loadShopData();

            // 📡 Realtime: Shop Profile Changes
            const shopChannel = supabase
                .channel(`public-shop-${slug}`)
                .on(
                    'postgres_changes',
                    {
                        event: '*', // UPDATE, DELETE
                        schema: 'public',
                        table: 'shops',
                        filter: `slug=eq.${slug}`
                    },
                    (payload) => {
                        console.log('⚡️ Shop update received:', payload);
                        if (payload.eventType === 'DELETE') {
                            navigate('/');
                        } else {
                            setShop(payload.new as Shop);
                        }
                    }
                )
                .subscribe();

            return () => {
                supabase.removeChannel(shopChannel);
            };
        }
    }, [slug]);

    // 📡 Realtime: Products Changes
    useEffect(() => {
        if (!shop?.id) return;

        const productsChannel = supabase
            .channel(`public-products-${shop.id}`)
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'products',
                    filter: `shop_id=eq.${shop.id}`
                },
                (payload) => {
                    console.log('⚡️ Product update received:', payload);
                    if (payload.eventType === 'INSERT') {
                        const newProd = payload.new as Product;
                        if (newProd.is_active) {
                            setProducts(prev => [...prev, newProd].sort((a, b) => a.name.localeCompare(b.name)));
                        }
                    } else if (payload.eventType === 'UPDATE') {
                        const updatedProd = payload.new as Product;
                        setProducts(prev => {
                            if (!updatedProd.is_active) {
                                return prev.filter(p => p.id !== updatedProd.id);
                            }
                            const existing = prev.find(p => p.id === updatedProd.id);
                            if (existing) {
                                return prev.map(p => p.id === updatedProd.id ? updatedProd : p);
                            } else {
                                return [...prev, updatedProd].sort((a, b) => a.name.localeCompare(b.name));
                            }
                        });
                    } else if (payload.eventType === 'DELETE') {
                        setProducts(prev => prev.filter(p => p.id !== payload.old.id));
                    }
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(productsChannel);
        };
    }, [shop?.id]);

    // 📡 Realtime: Order Status Monitoring
    useEffect(() => {
        const orderToTrack = submittedOrderId || (isTrackOpen && trackInput ? trackInput : null);
        if (!orderToTrack || orderToTrack.length < 20) return; // Basic UUID check

        const orderChannel = supabase
            .channel(`track-order-${orderToTrack}`)
            .on(
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'customer_orders',
                    filter: `id=eq.${orderToTrack}`
                },
                (payload) => {
                    console.log('⚡️ Order update received:', payload);
                    const updatedOrder = payload.new as CustomerOrder;
                    setTrackedOrder(updatedOrder);

                    if (updatedOrder.status === 'delivered') {
                        if (navigator.vibrate) navigator.vibrate([100, 50, 100]);
                    }
                }
            )
            .subscribe();

        // Charger l'état initial pour le suivi
        const fetchInitialOrder = async () => {
            const { data } = await supabase.from('customer_orders').select('*').eq('id', orderToTrack).single();
            if (data) setTrackedOrder(data);
        };
        fetchInitialOrder();

        return () => {
            supabase.removeChannel(orderChannel);
        };
    }, [submittedOrderId, isTrackOpen, trackInput]);

    // ============================================================
    // 📊 COMPUTED VALUES
    // ============================================================

    const recommendedProducts = useMemo(() => {
        if (!products.length) return [];

        // Algorithme de recommandation puissant
        return [...products]
            .map(p => {
                let score = 0;

                // 💎 Facteur 1: Intérêt direct (Favoris)
                if (favorites.includes(p.id)) score += 500;

                // 👁️ Facteur 2: Vues produit locales
                score += (productViews[p.id] || 0) * 25;

                // 🏷️ Facteur 3: Affinité par catégorie (Apprentissage des goûts)
                if (p.category && categoryViews[p.category]) {
                    score += categoryViews[p.category] * 10;
                }

                // 🛒 Facteur 4: Cross-selling (Produits liés au panier actuel)
                const isInCategoryInCart = cart.some(item => item.product.category === p.category);
                if (isInCategoryInCart) score += 50;

                // 📦 Facteur 5: Nouveauté (Bonus pour les produits récents)
                const isNew = p.created_at && (new Date().getTime() - new Date(p.created_at).getTime()) < (7 * 24 * 60 * 60 * 1000);
                if (isNew) score += 30;

                return { ...p, relevanceScore: score };
            })
            .filter(p => p.relevanceScore > 0)
            .sort((a, b) => b.relevanceScore - a.relevanceScore)
            .slice(0, 10);
    }, [products, favorites, productViews, categoryViews, cart]);

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

    const getCategoryIcon = (category: string) => {
        const cat = category.toLowerCase();
        if (cat === 'tout') return <ShoppingBag size={24} />;
        if (cat.includes('mode') || cat.includes('vêtement') || cat.includes('habit')) return <Shirt size={24} />;
        if (cat.includes('élec') || cat.includes('info') || cat.includes('tech')) return <Monitor size={24} />;
        if (cat.includes('beauté') || cat.includes('cosmétique') || cat.includes('soin')) return <Sparkles size={24} />;
        if (cat.includes('alim') || cat.includes('food') || cat.includes('nourriture')) return <Utensils size={24} />;
        if (cat.includes('maison') || cat.includes('déco')) return <Home size={24} />;
        if (cat.includes('sport') || cat.includes('fitness')) return <Dumbbell size={24} />;
        if (cat.includes('café') || cat.includes('boisson')) return <Coffee size={24} />;
        if (cat.includes('accessoire') || cat.includes('bijoux')) return <Zap size={24} />;
        if (cat.includes('art') || cat.includes('design')) return <Palette size={24} />;
        if (cat.includes('cadeau') || cat.includes('plaisir')) return <Gift size={24} />;
        return <Package size={24} />;
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

        if (sortOption === 'default') {
            // Tri intelligent : Popularité (vues) puis nouveauté
            result.sort((a, b) => {
                const viewsA = productViews[a.id] || 0;
                const viewsB = productViews[b.id] || 0;
                if (viewsB !== viewsA) return viewsB - viewsA;
                return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();
            });
        }

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
    }, [products, searchQuery, selectedCategory, sortOption, filterOption, productViews]);

    // 📊 Memoized Products Grid
    const productGrid = useMemo(() => {
        const productsList = filteredAndSortedProducts;
        const totalFound = productsList.length;
        const visibleProducts = productsList.slice(0, visibleCount);

        if (totalFound === 0) {
            return (
                <div className="empty-state">
                    <Package size={48} />
                    <p>Aucun produit ne correspond à votre recherche.</p>
                </div>
            );
        }

        return (
            <>
                <div className="product-grid">
                    {visibleProducts.map((product, index) => {
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
                                    // Analytics Intelligent
                                    trackEvent('view_product', product.id, product.category || undefined);

                                    setProductViews(prev => ({
                                        ...prev,
                                        [product.id]: (prev[product.id] || 0) + 1
                                    }));

                                    if (product.category) {
                                        setCategoryViews(prev => ({
                                            ...prev,
                                            [product.category!]: (prev[product.category!] || 0) + 1
                                        }));
                                    }
                                }}
                            >
                                <div className="card-img-container">
                                    {product.photo_url ? (
                                        <img
                                            src={getPublicImageUrl(product.photo_url) || ''}
                                            alt={product.name}
                                            loading="lazy"
                                            onError={(e) => {
                                                const target = e.target as HTMLImageElement;
                                                target.src = 'https://via.placeholder.com/300?text=Produit';
                                            }}
                                        />
                                    ) : (
                                        <div className="img-placeholder">
                                            <Package size={32} />
                                        </div>
                                    )}

                                    <button
                                        className={`btn-favorite ${isFavorite ? 'active' : ''}`}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            toggleFavorite(product.id);
                                        }}
                                    >
                                        <Heart size={18} fill={isFavorite ? 'currentColor' : 'none'} />
                                    </button>

                                    <div className={`stock-badge stock-${stockStatus.color}`}>
                                        {stockStatus.label}
                                    </div>
                                </div>


                                <div className="card-content">
                                    <div className="product-trust-badges">
                                        <div className="trust-badge-mini silver">
                                            <CreditCard size={10} /> Livraison d'abord
                                        </div>
                                        <div className="trust-badge-mini gold">
                                            <BadgeCheck size={10} /> Boutique Pro
                                        </div>
                                    </div>

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
                    })
                    }
                </div>

                {totalFound > visibleCount && (
                    <div style={{ display: 'flex', justifyContent: 'center', padding: '2rem 0' }}>
                        <button
                            className="btn-show-more"
                            onClick={() => setVisibleCount(prev => prev + 12)}
                            style={{
                                padding: '12px 32px',
                                background: 'var(--bg-secondary)',
                                border: '1px solid var(--border-color)',
                                borderRadius: 'var(--radius-full)',
                                color: 'var(--text-primary)',
                                fontWeight: 700,
                                fontSize: '0.9rem',
                                cursor: 'pointer',
                                transition: 'all 0.2s ease',
                                boxShadow: 'var(--shadow-sm)'
                            }}
                        >
                            Voir plus de produits (+{Math.min(12, totalFound - visibleCount)})
                        </button>
                    </div>
                )}
            </>
        );
    }, [filteredAndSortedProducts, favorites, cart, addedId, searchQuery, visibleCount]);

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

        setCart(prev => {
            const existing = prev.find(item => item.product.id === product.id);
            if (existing) {
                return prev.map(item =>
                    item.product.id === product.id
                        ? { ...item, quantity: item.quantity + quantity }
                        : item
                );
            }
            return [...prev, { product, quantity }];
        });

        // Analytics Intelligent
        trackEvent('add_to_cart', product.id, product.category || undefined, undefined, { quantity });

        setAddedId(product.id);
        setTimeout(() => setAddedId(null), 1500);
    };

    const updateQuantity = (productId: string, delta: number) => {
        setCart(prev => {
            const existing = prev.find(item => item.product.id === productId);
            if (!existing) return prev;

            const newQty = existing.quantity + delta;
            if (newQty <= 0) {
                // Analytics
                trackEvent('remove_from_cart', productId);
                return prev.filter(item => item.product.id !== productId);
            }

            return prev.map(item =>
                item.product.id === productId
                    ? { ...item, quantity: newQty }
                    : item
            );
        });
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

        const isFav = favorites.includes(productId);
        if (!isFav) {
            trackEvent('view_product', productId, undefined, undefined, { type: 'favorite_add' });
        }

        setFavorites(prev =>
            prev.includes(productId)
                ? prev.filter(id => id !== productId)
                : [...prev, productId]
        );
    };

    // ============================================================
    // 🎫 TICKET IMAGE GENERATOR (Canvas)
    // ============================================================

    const generateOrderTicketImage = async (orderId?: string): Promise<Blob | null> => {
        if (!shop) return null;

        const W = 480;
        const PADDING = 28;
        const HEADER_H = 160;
        const ITEM_H = 56;
        const QR_SIZE = 110;
        const FOOTER_H = 220 + QR_SIZE; // Plus de place pour le QR Code
        const totalHeight = HEADER_H + (cart.length * ITEM_H) + FOOTER_H;

        const canvas = document.createElement('canvas');
        canvas.width = W;
        canvas.height = totalHeight;
        const ctx = canvas.getContext('2d')!;

        // --- Background ---
        const bgGrad = ctx.createLinearGradient(0, 0, 0, totalHeight);
        bgGrad.addColorStop(0, '#0d0d12');
        bgGrad.addColorStop(1, '#15151f');
        ctx.fillStyle = bgGrad;
        roundRect(ctx, 0, 0, W, totalHeight, 20);
        ctx.fill();

        // --- Header accent bar ---
        const barGrad = ctx.createLinearGradient(0, 0, W, 0);
        barGrad.addColorStop(0, '#ff5500');
        barGrad.addColorStop(1, '#ff8c00');
        ctx.fillStyle = barGrad;
        ctx.fillRect(0, 0, W, 5);

        // --- Velmo Logo (simple V) ---
        ctx.fillStyle = '#ff5500';
        roundRect(ctx, PADDING, 22, 44, 44, 10);
        ctx.fill();
        ctx.fillStyle = 'white';
        ctx.font = 'bold 22px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('V', PADDING + 22, 51);

        // --- Shop name ---
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 20px Arial';
        ctx.textAlign = 'left';
        ctx.fillText(shop.name.toUpperCase(), PADDING + 58, 42);

        ctx.fillStyle = '#888';
        ctx.font = '13px Arial';
        ctx.fillText('velmo.market', PADDING + 58, 60);

        // --- Order reference & date ---
        const ref = orderId ? orderId.slice(0, 8).toUpperCase() : 'VEL-' + Math.random().toString(36).slice(2, 6).toUpperCase();
        const now = new Date();
        const dateStr = now.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
        ctx.fillStyle = '#ff5500';
        ctx.font = 'bold 13px Arial';
        ctx.textAlign = 'right';
        ctx.fillText(`#${ref}`, W - PADDING, 42);
        ctx.fillStyle = '#888';
        ctx.font = '12px Arial';
        ctx.fillText(dateStr, W - PADDING, 60);

        // --- Separator ---
        ctx.strokeStyle = '#2a2a3a';
        ctx.lineWidth = 1;
        ctx.setLineDash([6, 4]);
        ctx.beginPath();
        ctx.moveTo(PADDING, 82);
        ctx.lineTo(W - PADDING, 82);
        ctx.stroke();
        ctx.setLineDash([]);

        // --- "COMMANDE" label ---
        ctx.fillStyle = '#555';
        ctx.font = '11px Arial';
        ctx.textAlign = 'left';
        ctx.fillText('COMMANDE', PADDING, 105);

        // --- Column headers ---
        ctx.fillStyle = '#777';
        ctx.font = '11px Arial';
        ctx.textAlign = 'left';
        ctx.fillText('PRODUIT', PADDING, 128);
        ctx.textAlign = 'center';
        ctx.fillText('QTÉ', W / 2 + 20, 128);
        ctx.textAlign = 'right';
        ctx.fillText('PRIX', W - PADDING, 128);

        // --- Separator ---
        ctx.fillStyle = '#2a2a3a';
        ctx.fillRect(PADDING, 136, W - PADDING * 2, 1);

        // --- Product rows ---
        let currY = HEADER_H;
        for (const item of cart) {
            const price = (item.product.price_sale || 0) * item.quantity;
            const name = item.product.name.length > 26 ? item.product.name.slice(0, 25) + '…' : item.product.name;

            ctx.fillStyle = '#e5e5e5';
            ctx.font = '13px Arial';
            ctx.textAlign = 'left';
            ctx.fillText(name, PADDING, currY + 22);

            ctx.fillStyle = '#ff8c00';
            ctx.font = 'bold 13px Arial';
            ctx.textAlign = 'center';
            ctx.fillText(`×${item.quantity}`, W / 2 + 20, currY + 22);

            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 13px Arial';
            ctx.textAlign = 'right';
            ctx.fillText(formatPrice(price), W - PADDING, currY + 22);

            // Row separator
            ctx.fillStyle = '#1e1e2a';
            ctx.fillRect(PADDING, currY + 32, W - PADDING * 2, 1);

            currY += ITEM_H;
        }

        // --- Total ---
        const totalY = currY + 30;
        const totGrad = ctx.createLinearGradient(PADDING, totalY - 4, W - PADDING, totalY - 4 + 48);
        totGrad.addColorStop(0, '#1a1a2a');
        totGrad.addColorStop(1, '#222235');
        ctx.fillStyle = totGrad;
        roundRect(ctx, PADDING, totalY - 4, W - PADDING * 2, 48, 10);
        ctx.fill();

        ctx.fillStyle = '#999';
        ctx.font = '13px Arial';
        ctx.textAlign = 'left';
        ctx.fillText('TOTAL À PAYER', PADDING + 14, totalY + 22);

        ctx.fillStyle = '#ff5500';
        ctx.font = 'bold 20px Arial';
        ctx.textAlign = 'right';
        ctx.fillText(formatPrice(totalAmount), W - PADDING - 14, totalY + 24);

        // --- Delivery info ---
        const infoY = totalY + 74;
        ctx.fillStyle = '#555';
        ctx.font = '11px Arial';
        ctx.textAlign = 'left';
        ctx.fillText('LIVRAISON À', PADDING, infoY);

        ctx.fillStyle = '#ddd';
        ctx.font = 'bold 13px Arial';
        ctx.fillText(customerInfo.address || 'À confirmer', PADDING, infoY + 18);

        if (customerInfo.name) {
            ctx.fillStyle = '#777';
            ctx.font = '12px Arial';
            ctx.fillText(`Client : ${customerInfo.name}`, PADDING, infoY + 36);
        }

        // --- QR Code ---
        const qrY = infoY + 60;
        const trackingUrl = `https://velmo.market/order/${ref}`;
        const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=${QR_SIZE}x${QR_SIZE}&data=${encodeURIComponent(trackingUrl)}&color=ffffff&bgcolor=15151f`;

        try {
            const qrImg = await new Promise<HTMLImageElement>((resolve, reject) => {
                const img = new Image();
                img.crossOrigin = 'anonymous';
                img.onload = () => resolve(img);
                img.onerror = () => reject();
                img.src = qrUrl;
            });
            ctx.drawImage(qrImg, W / 2 - QR_SIZE / 2, qrY, QR_SIZE, QR_SIZE);
            ctx.fillStyle = '#555';
            ctx.font = '10px Arial';
            ctx.textAlign = 'center';
            ctx.fillText('Scannez pour suivre la commande', W / 2, qrY + QR_SIZE + 15);
        } catch (e) {
            console.warn('QR Code generation failed');
        }

        // --- Trust badge ---
        const badgeY = totalHeight - 52;
        ctx.fillStyle = '#1a2a1a';
        roundRect(ctx, PADDING, badgeY, (W - PADDING * 2) / 2 - 6, 32, 8);
        ctx.fill();
        ctx.fillStyle = '#22c55e';
        ctx.font = 'bold 11px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('✓ Paiement à la livraison', PADDING + (W - PADDING * 2) / 4 - 3, badgeY + 20);

        ctx.fillStyle = '#1a1a2a';
        roundRect(ctx, W / 2 + 6, badgeY, (W - PADDING * 2) / 2 - 6, 32, 8);
        ctx.fill();
        ctx.fillStyle = '#888';
        ctx.font = '11px Arial';
        ctx.fillText('Propulsé par Velmo', W - PADDING - (W - PADDING * 2) / 4 + 3, badgeY + 20);

        return new Promise(resolve => canvas.toBlob(blob => resolve(blob), 'image/png', 0.95));
    };

    // Helper to draw rounded rects (compatible avec tous les navigateurs)
    const roundRect = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) => {
        ctx.beginPath();
        ctx.moveTo(x + r, y);
        ctx.lineTo(x + w - r, y);
        ctx.quadraticCurveTo(x + w, y, x + w, y + r);
        ctx.lineTo(x + w, y + h - r);
        ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
        ctx.lineTo(x + r, y + h);
        ctx.quadraticCurveTo(x, y + h, x, y + h - r);
        ctx.lineTo(x, y + r);
        ctx.quadraticCurveTo(x, y, x + r, y);
        ctx.closePath();
    };

    // Ouverture WhatsApp (fallback texte si partage image impossible)
    const openWhatsApp = (orderId?: string) => {
        if (!shop) return;
        const shopPhone = (shop.whatsapp || shop.phone || '').replace(/\D/g, '');
        const ref = orderId ? orderId.slice(0, 8).toUpperCase() : '';

        // Liste détaillée des produits dans le message
        const itemLines = cart.map(item => {
            const subtotal = formatPrice((item.product.price_sale || 0) * item.quantity);
            return `  • *${item.product.name}* × ${item.quantity} = ${subtotal}`;
        }).join('\n');

        const msg = [
            `🛒 *NOUVELLE COMMANDE — ${shop.name}*`,
            ``,
            `*PRODUITS :*`,
            itemLines,
            ``,
            `💰 *TOTAL : ${formatPrice(totalAmount)}*`,
            ``,
            `👤 *Client :* ${customerInfo.name || 'Non renseigné'}`,
            `📍 *Quartier/Repère :* ${customerInfo.address}`,
            customerInfo.location
                ? `🌐 *Position GPS :* https://maps.google.com?q=${customerInfo.location.lat},${customerInfo.location.lng}`
                : '',
            ref ? `🔖 *Réf :* #${ref}` : '',
            ``,
            `_Commande passée via velmo.market_`
        ].filter(Boolean).join('\n');

        window.open(`https://wa.me/${shopPhone}?text=${encodeURIComponent(msg)}`, '_blank');
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

            // 1. Enregistrement Supabase (bruit de fond)
            const items_json: OrderItem[] = cart.map(item => ({
                id: item.product.id,
                name: item.product.name,
                price: item.product.price_sale || 0,
                quantity: item.quantity,
                photo_url: item.product.photo_url || null
            }));

            const { data } = await supabase
                .from('customer_orders')
                .insert({
                    shop_id: shop.id,
                    customer_name: customerInfo.name || 'Client WhatsApp',
                    customer_phone: customerInfo.phone || null,
                    items_json: items_json,
                    total_amount: totalAmount,
                    status: 'pending',
                    delivery_method: deliveryMethod,
                    customer_address: customerInfo.address,
                    customer_location: customerInfo.location ? JSON.stringify(customerInfo.location) : null
                })
                .select('id, short_ref')
                .single();

            trackEvent('checkout_success', undefined, undefined, undefined, { orderId: data?.id, total: totalAmount });

            // 2. Générer le ticket image en arrière-plan
            const blob = await generateOrderTicketImage(data?.id);
            if (blob) {
                const url = URL.createObjectURL(blob);
                setTicketImageUrl(url);
                setTicketBlob(blob);
            }

            // 3. Ouvrir WhatsApp avec le message d'accompagnement
            openWhatsApp(data?.id);

            // 4. Nettoyage
            setOrderSuccess(true);
            setSubmittedOrderId(data?.id || null);
            setSubmittedOrderRef(data?.short_ref || data?.id?.slice(0, 8).toUpperCase() || null);
            setCart([]);
            localStorage.removeItem('velmo_cart');

        } catch (err) {
            console.warn('Silent fail checkout:', err);
            openWhatsApp();
            setOrderSuccess(true);
            setCart([]);
            localStorage.removeItem('velmo_cart');
        } finally {
            setIsSubmitting(false);
        }
    };

    const downloadTicket = (blob?: Blob | null, orderId?: string | null) => {
        const b = blob || ticketBlob;
        if (!b) return;
        const url = URL.createObjectURL(b);
        const a = document.createElement('a');
        a.href = url;
        a.download = `ticket-velmo-${orderId?.slice(0, 6) || 'cmd'}.png`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    const shareTicket = async () => {
        if (!ticketBlob) return;
        const ticketFile = new File([ticketBlob], 'ticket-velmo.png', { type: 'image/png' });
        try {
            if (navigator.canShare?.({ files: [ticketFile] })) {
                await navigator.share({ files: [ticketFile], title: `Commande - ${shop?.name}` });
            } else {
                downloadTicket();
            }
        } catch {
            downloadTicket();
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

    // 🧠 Amazon-Style recommendation algorithm
    const getRecommendedProducts = (currentProduct?: Product | null) => {
        if (!products.length) return [];

        let recommended: Product[] = [];

        if (currentProduct) {
            // 1. Same category first
            recommended = products.filter(p =>
                p.id !== currentProduct.id &&
                p.category === currentProduct.category &&
                p.is_active
            );
        }

        // 2. Add popular products if not enough
        const popularIds = Object.entries(productViews)
            .sort(([, a], [, b]) => b - a)
            .map(([id]) => id);

        const popular = products.filter(p =>
            popularIds.includes(p.id) &&
            p.id !== currentProduct?.id &&
            !recommended.find(r => r.id === p.id)
        );

        return [...recommended, ...popular].slice(0, 4);
    };

    // 🔍 Search tracking delay
    useEffect(() => {
        if (searchQuery.length > 2) {
            const timer = setTimeout(() => {
                trackEvent('search', undefined, undefined, searchQuery);
            }, 1000);
            return () => clearTimeout(timer);
        }
    }, [searchQuery, trackEvent]);

    const handleCategoryClick = (cat: string) => {
        setSelectedCategory(cat);
        trackEvent('category_click', undefined, cat);
    };

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

            {/* 🔝 Premium Sticky Nav */}
            <nav className="sticky-nav">
                <div className="nav-brand-area">
                    <Link to="/" className="btn-nav-back">
                        <ArrowRight size={20} style={{ transform: 'rotate(180deg)' }} />
                    </Link>
                    <div className="nav-shop-info">
                        <span className="nav-shop-label">Market</span>
                        <span className="nav-shop-name">{shop.name}</span>
                    </div>
                </div>

                <div className="nav-actions-area">
                    <button
                        onClick={() => setIsTrackOpen(true)}
                        className="btn-nav-action"
                        title="Suivre ma commande"
                    >
                        <Package size={20} />
                    </button>
                    <button
                        onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                        className="btn-nav-action"
                        title="Changer le thème"
                    >
                        {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
                    </button>
                    <button
                        onClick={() => setIsCartOpen(true)}
                        className="btn-nav-cart"
                    >
                        <ShoppingCart size={20} />
                        {cart.length > 0 && (
                            <span className="cart-badge-mini">
                                {cart.reduce((sum, item) => sum + item.quantity, 0)}
                            </span>
                        )}
                    </button>
                </div>
            </nav>

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
                            className="search-input"
                            placeholder="Rechercher un produit..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
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
                                                    <p style={{ fontSize: '0.8rem', color: 'var(--primary)', fontWeight: 600 }}>{formatPrice(product.price_sale)}</p>
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

                {/* 🏷️ Categories: Premium Visual Grid */}
                {categories.length > 1 && (
                    <div className="category-pills-container">
                        <div className="category-visual-grid">
                            {categories.map(cat => (
                                <motion.div
                                    key={cat as string}
                                    whileHover={{ y: -5 }}
                                    whileTap={{ scale: 0.95 }}
                                    onClick={() => handleCategoryClick(cat as string)}
                                    className={`category-card ${selectedCategory === cat ? 'active' : ''}`}
                                >
                                    <div className="cat-icon">
                                        {getCategoryIcon(cat as string)}
                                    </div>
                                    <span className="cat-name">{cat as string}</span>
                                </motion.div>
                            ))}
                        </div>
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

            {/* ===================== SHOP INFORMATION CARD ===================== */}
            <section className="shop-info-section">
                <motion.div
                    initial={{ opacity: 0, y: 30 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    className="shop-info-card"
                >
                    <div className="shop-info-grid">

                        {/* 📞 Column 1: Contact & Identity */}
                        <div className="shop-info-col">
                            <div className="info-col-header">
                                <div className="info-icon-wrapper primary">
                                    <Store size={24} />
                                </div>
                                <h3 className="info-col-title">Contactez-nous</h3>
                            </div>

                            <div className="info-items-list">
                                {(shop.phone || shop.whatsapp) && (
                                    <a href={`tel:${shop.phone || shop.whatsapp}`} className="info-item-link">
                                        <div className="item-icon-circle">
                                            <Phone size={18} />
                                        </div>
                                        <div className="item-content">
                                            <span className="item-label">Téléphone</span>
                                            <span className="item-value">{shop.phone || shop.whatsapp}</span>
                                        </div>
                                    </a>
                                )}

                                {shop.whatsapp && (
                                    <a href={`https://wa.me/${shop.whatsapp.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer" className="info-item-link whatsapp">
                                        <div className="item-icon-circle whatsapp">
                                            <MessageCircle size={18} />
                                        </div>
                                        <div className="item-content">
                                            <span className="item-label">WhatsApp</span>
                                            <span className="item-value">Discuter en ligne</span>
                                        </div>
                                    </a>
                                )}

                                {shop.email && (
                                    <a href={`mailto:${shop.email}`} className="info-item-link">
                                        <div className="item-icon-circle">
                                            <Mail size={18} />
                                        </div>
                                        <div className="item-content">
                                            <span className="item-label">Email</span>
                                            <span className="item-value truncate">{shop.email}</span>
                                        </div>
                                    </a>
                                )}
                            </div>

                            {/* Social Media Row */}
                            <div className="social-links-row">
                                {shop.facebook_url && (
                                    <a href={shop.facebook_url} target="_blank" rel="noopener noreferrer" className="social-icon-btn facebook" title="Facebook">
                                        <Facebook size={20} />
                                    </a>
                                )}
                                {shop.instagram_url && (
                                    <a href={shop.instagram_url} target="_blank" rel="noopener noreferrer" className="social-icon-btn instagram" title="Instagram">
                                        <Instagram size={20} />
                                    </a>
                                )}
                                {shop.tiktok_url && (
                                    <a href={shop.tiktok_url} target="_blank" rel="noopener noreferrer" className="social-icon-btn tiktok" title="TikTok">
                                        <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.9-.32-1.98-.23-2.81.33-.85.51-1.44 1.43-1.58 2.41-.09.96.16 1.94.71 2.7.53.77 1.39 1.32 2.31 1.5.88.2 1.84.03 2.59-.47.8-.5 1.48-1.31 1.63-2.26.14-.94.02-1.91.02-2.87-.01-4.71.01-9.42-.02-14.13z" /></svg>
                                    </a>
                                )}
                                {shop.twitter_url && (
                                    <a href={shop.twitter_url} target="_blank" rel="noopener noreferrer" className="social-icon-btn twitter" title="Twitter">
                                        <Twitter size={20} />
                                    </a>
                                )}
                                {shop.website_url && (
                                    <a href={shop.website_url} target="_blank" rel="noopener noreferrer" className="social-icon-btn website" title="Site Web">
                                        <Globe size={20} />
                                    </a>
                                )}
                            </div>
                        </div>

                        {/* 🕐 Column 2: Hours & Location */}
                        <div className="shop-info-col">
                            <div className="info-col-header">
                                <div className="info-icon-wrapper orange">
                                    <MapPin size={24} />
                                </div>
                                <h3 className="info-col-title">Où nous trouver ?</h3>
                            </div>

                            <div className="location-items">
                                <div className="location-item">
                                    <div className="item-icon-circle">
                                        <MapPin size={18} />
                                    </div>
                                    <div className="item-content">
                                        <span className="item-label">Adresse</span>
                                        <span className="item-value">{shop.address || shop.location || 'Adresse non spécifiée'}</span>
                                        {shop.location && (
                                            <a
                                                href={`https://www.google.com/maps/search/${encodeURIComponent(shop.address || shop.location)}`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="maps-link"
                                            >
                                                Ouvrir dans Maps <ExternalLink size={12} />
                                            </a>
                                        )}
                                    </div>
                                </div>

                                <div className="location-item">
                                    <div className="item-icon-circle">
                                        <Clock size={18} />
                                    </div>
                                    <div className="item-content">
                                        <span className="item-label">Horaires</span>
                                        <span className="item-value">{shop.opening_hours || 'Contactez-nous pour les horaires'}</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* 🚚 Column 3: Policies */}
                        <div className="shop-info-col">
                            <div className="info-col-header">
                                <div className="info-icon-wrapper emerald">
                                    <Truck size={24} />
                                </div>
                                <h3 className="info-col-title">Nos Politiques</h3>
                            </div>

                            <div className="policies-list">
                                <div className="policy-box">
                                    <span className="policy-label">
                                        <Truck size={14} /> Livraison & Retrait
                                    </span>
                                    <p className="policy-text">
                                        {shop.delivery_info || "Nous proposons la livraison à domicile et le retrait en boutique. Les délais varient selon votre localisation."}
                                    </p>
                                </div>

                                <div className="policy-box border-t">
                                    <span className="policy-label">
                                        <Shield size={14} /> Retours & Remboursements
                                    </span>
                                    <p className="policy-text">
                                        {shop.return_policy || "Les produits peuvent être retournés sous conditions. Veuillez nous contacter pour toute réclamation."}
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Bottom CTA Bar */}
                    <div className="shop-info-footer">
                        <div className="footer-cta-info">
                            <div className="cta-icon-wrapper">
                                <Share2 size={24} />
                            </div>
                            <div className="cta-text-content">
                                <h4 className="cta-title">Partagez la boutique</h4>
                                <p className="cta-subtitle">Invitez vos amis à découvrir nos produits</p>
                            </div>
                        </div>
                        <button
                            onClick={() => {
                                navigator.share?.({
                                    title: shop.name,
                                    text: shop.description || '',
                                    url: window.location.href,
                                }).catch(() => {
                                    navigator.clipboard.writeText(window.location.href);
                                    alert('Lien copié !');
                                });
                            }}
                            className="btn-share-shop"
                        >
                            Partager le site <ArrowRight size={18} />
                        </button>
                    </div>
                </motion.div>
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
            {/* 📱 Mobile Floating Nav */}
            <div className="mobile-bottom-nav">
                <button className="nav-item active" onClick={() => {
                    setSelectedCategory('Tout');
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                }}>
                    <Home size={22} />
                    <span>Accueil</span>
                </button>
                <button className="nav-item" onClick={() => {
                    setShowFilters(true);
                    const cats = document.querySelector('.category-pills-container');
                    cats?.scrollIntoView({ behavior: 'smooth' });
                }}>
                    <Filter size={22} />
                    <span>Explorer</span>
                </button>
                <button
                    className="nav-item relative"
                    onClick={() => setIsCartOpen(true)}
                >
                    <div className="w-12 h-12 bg-primary text-white rounded-full flex items-center justify-center -mt-8 shadow-xl shadow-primary/40 border-4 border-slate-900 border-opacity-20 backdrop-blur-md">
                        <ShoppingCart size={24} />
                    </div>
                    <span>Panier</span>
                    {cart.length > 0 && (
                        <span className="absolute top-[-26px] right-2 w-5 h-5 bg-red-600 text-white text-[10px] font-black rounded-full flex items-center justify-center border-2 border-slate-900">
                            {cart.length}
                        </span>
                    )}
                </button>
                <button className="nav-item" onClick={() => setIsTrackOpen(true)}>
                    <Package size={22} />
                    <span>Suivi</span>
                </button>
                <button className="nav-item" onClick={() => {
                    const info = document.querySelector('.shop-info-section');
                    info?.scrollIntoView({ behavior: 'smooth' });
                }}>
                    <Store size={22} />
                    <span>Infos</span>
                </button>
            </div>

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
                                <button className="btn-close-cart" onClick={() => setIsCartOpen(false)} aria-label="Fermer le panier">
                                    <span style={{ fontSize: '0.8rem', fontWeight: 600, marginRight: '8px', opacity: 0.7 }} className="hide-on-desktop">Fermer</span>
                                    <X size={24} />
                                </button>
                            </div>

                            {orderSuccess ? (
                                <div className="order-success-premium">
                                    <motion.div
                                        initial={{ scale: 0 }}
                                        animate={{ scale: 1 }}
                                        className="success-check-lottie"
                                    >
                                        <CheckCircle2 size={56} color="#25D366" />
                                    </motion.div>

                                    <h2 className="success-title">Commande Envoyée ! 🎉</h2>
                                    <p className="success-msg">
                                        ✅ Le marchand a reçu votre commande complète sur WhatsApp.<br />
                                        <span style={{ fontSize: '0.85rem', opacity: 0.7 }}>
                                            Voici votre ticket de commande — téléchargez-le comme preuve.
                                        </span>
                                    </p>

                                    {/* 🎫 Ticket image preview */}
                                    {ticketImageUrl ? (
                                        <motion.div
                                            initial={{ opacity: 0, y: 20 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            transition={{ delay: 0.3 }}
                                            style={{ width: '100%', marginBottom: '1rem' }}
                                        >
                                            <img
                                                src={ticketImageUrl}
                                                alt="Ticket de commande"
                                                style={{
                                                    width: '100%',
                                                    borderRadius: '16px',
                                                    boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
                                                    display: 'block'
                                                }}
                                            />
                                        </motion.div>
                                    ) : (
                                        <div className="order-summary-card">
                                            <div className="summary-ref">
                                                <span>RÉFÉRENCE COMMANDE</span>
                                                <strong>#{submittedOrderRef || 'VEL-????'}</strong>
                                            </div>
                                            <div className="summary-amount">
                                                <span>TOTAL</span>
                                                <strong>{formatPrice(totalAmount)}</strong>
                                            </div>
                                        </div>
                                    )}

                                    {/* Action buttons */}
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', width: '100%' }}>
                                        {/* Bouton principal : Partager le ticket */}
                                        <button
                                            onClick={shareTicket}
                                            style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                gap: '10px',
                                                padding: '14px',
                                                background: 'linear-gradient(135deg, #25D366, #128C7E)',
                                                color: 'white',
                                                borderRadius: '14px',
                                                fontWeight: 800,
                                                fontSize: '1rem',
                                                cursor: 'pointer',
                                                border: 'none',
                                                boxShadow: '0 4px 15px rgba(37, 211, 102, 0.4)',
                                                width: '100%'
                                            }}
                                        >
                                            <MessageCircle size={22} fill="white" />
                                            Envoyer le ticket sur WhatsApp
                                        </button>

                                        {/* Bouton secondaire : Télécharger */}
                                        {ticketBlob && (
                                            <button
                                                onClick={() => downloadTicket(null, submittedOrderRef)}
                                                style={{
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    gap: '8px',
                                                    padding: '12px',
                                                    background: 'var(--bg-tertiary)',
                                                    color: 'var(--text-primary)',
                                                    borderRadius: '14px',
                                                    fontWeight: 600,
                                                    fontSize: '0.9rem',
                                                    cursor: 'pointer',
                                                    border: '1px solid var(--border-color)',
                                                    width: '100%'
                                                }}
                                            >
                                                <Printer size={18} />
                                                Télécharger le ticket PNG
                                            </button>
                                        )}

                                        {/* Bouton retour */}
                                        <button
                                            onClick={() => {
                                                setIsCartOpen(false);
                                                setOrderSuccess(false);
                                                if (ticketImageUrl) URL.revokeObjectURL(ticketImageUrl);
                                                setTicketImageUrl(null);
                                                setTicketBlob(null);
                                            }}
                                            style={{
                                                padding: '11px',
                                                background: 'transparent',
                                                color: 'var(--text-muted)',
                                                borderRadius: '14px',
                                                fontWeight: 600,
                                                fontSize: '0.85rem',
                                                cursor: 'pointer',
                                                border: '1px solid var(--border-color)',
                                                width: '100%'
                                            }}
                                        >
                                            Retour au magasin
                                        </button>
                                    </div>
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

                                        {/* CHECKOUT FORM FIELDS (SIMPLIFIÉ) */}
                                        <div style={{ padding: '1.5rem 0 0.5rem', borderTop: '1px solid var(--border-color)', marginTop: '1rem' }}>
                                            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                <Users size={18} /> Finaliser la commande
                                            </h3>
                                            <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
                                                Votre commande sera envoyée directement sur le WhatsApp de la boutique.
                                            </p>

                                            <div className="form-group">
                                                <label className="form-label">Votre nom (Optionnel)</label>
                                                <input
                                                    type="text"
                                                    className="form-input"
                                                    placeholder="Ex: Mamadou Diallo"
                                                    value={customerInfo.name}
                                                    onChange={(e) => setCustomerInfo({ ...customerInfo, name: e.target.value })}
                                                />
                                            </div>

                                            <div className="form-group">
                                                <label className="form-label required">Quartier / Point de repère</label>
                                                <input
                                                    type="text"
                                                    className="form-input"
                                                    placeholder="Ex: Kaloum, près de la pharmacie..."
                                                    value={customerInfo.address}
                                                    onChange={(e) => setCustomerInfo({ ...customerInfo, address: e.target.value })}
                                                    required
                                                />
                                            </div>

                                            <button
                                                type="button"
                                                className={`delivery-option ${customerInfo.location ? 'active' : ''}`}
                                                onClick={requestLocation}
                                                style={{
                                                    marginTop: '10px',
                                                    width: '100%',
                                                    flexDirection: 'row',
                                                    gap: '10px',
                                                    padding: '12px',
                                                    border: '1px dashed var(--border-color)',
                                                    borderRadius: 'var(--radius-md)',
                                                    background: customerInfo.location ? 'rgba(37, 211, 102, 0.1)' : 'transparent',
                                                    color: customerInfo.location ? '#25D366' : 'var(--text-secondary)'
                                                }}
                                            >
                                                <MapPin size={20} />
                                                <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>
                                                    {customerInfo.location ? 'Position GPS ajoutée ✅' : 'Ajouter ma position GPS (Optionnel)'}
                                                </span>
                                            </button>
                                        </div>
                                    </div>

                                    <div className="cart-footer">
                                        <div className="cart-total">
                                            <span className="cart-total-label">Total à payer :</span>
                                            <span className="cart-total-amount">{formatPrice(totalAmount)}</span>
                                        </div>
                                        <button
                                            type="submit"
                                            className="btn-checkout"
                                            disabled={isSubmitting || cart.length === 0 || !customerInfo.address}
                                            style={{
                                                backgroundColor: '#25D366',
                                                borderColor: '#25D366',
                                                color: 'white',
                                                fontWeight: 800,
                                                fontSize: '1.1rem',
                                                boxShadow: '0 4px 15px rgba(37, 211, 102, 0.4)'
                                            }}
                                        >
                                            {isSubmitting ? (
                                                <Loader2 size={24} className="animate-spin" />
                                            ) : (
                                                <>
                                                    <MessageCircle size={24} fill="white" />
                                                    Commander sur WhatsApp
                                                </>
                                            )}
                                        </button>
                                        <p style={{ textAlign: 'center', fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '12px' }}>
                                            Le marchand recevra vos infos sur WhatsApp.
                                        </p>
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

                                    {/* 🧠 SMART RECOMMENDATIONS */}
                                    <div className="recommendations-section">
                                        <h4 className="rec-title">Vous pourriez aussi aimer</h4>
                                        <div className="rec-grid">
                                            {getRecommendedProducts(selectedProduct).map(rec => (
                                                <div
                                                    key={rec.id}
                                                    className="rec-card"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setSelectedProduct(rec);
                                                        setModalQuantity(1);
                                                    }}
                                                >
                                                    <div className="rec-img">
                                                        <img src={getPublicImageUrl(rec.photo_url) || ''} alt={rec.name} />
                                                    </div>
                                                    <p className="rec-name">{rec.name}</p>
                                                    <p className="rec-price">{formatPrice(rec.price_sale)}</p>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
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
const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
        pending: 'En attente',
        confirmed: 'Confirmée',
        preparing: 'Préparation',
        ready: 'Prête',
        shipped: 'En route',
        delivered: 'Livrée',
        cancelled: 'Annulée'
    };
    return labels[status as keyof typeof labels] || status;
};

const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
        pending: '#f59e0b',
        confirmed: '#3b82f6',
        preparing: '#8b5cf6',
        ready: '#10b981',
        shipped: '#06b6d4',
        delivered: '#10b981',
        cancelled: '#ef4444'
    };
    return colors[status as keyof typeof colors] || '#94a3b8';
};
