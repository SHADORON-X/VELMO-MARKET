import { useState, useEffect, type FormEvent } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import type { Shop, Product } from '../lib/supabase';
import { ShoppingBag, Plus, Minus, Trash2, X, Check, Loader2, Store, ArrowRight, ShoppingCart, Moon, Sun, ArrowLeft, MapPin, Truck, Search, Clock, Phone } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface CartItem {
    product: Product;
    quantity: number;
}

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
    const [addedId, setAddedId] = useState<string | null>(null);

    // Form State
    const [customerInfo, setCustomerInfo] = useState({ name: '', phone: '' });
    const [orderNote, setOrderNote] = useState('');
    const [deliveryMethod, setDeliveryMethod] = useState<'pickup' | 'delivery'>('pickup');

    // Product Modal State
    const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

    // Search & Filter State
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedCategory, setSelectedCategory] = useState<string>('Tout');

    useEffect(() => {
        localStorage.setItem('velmo_cart', JSON.stringify(cart));
    }, [cart]);

    useEffect(() => {
        if (slug) loadShopData();
    }, [slug]);

    // Helpers
    const formatPrice = (price: number | null | undefined, currency: string) => {
        if (!price || isNaN(price) || price === 0) return "Prix sur demande";
        return `${price.toLocaleString()} ${currency}`;
    };

    const categories = ['Tout', ...new Set(products.map(p => p.category).filter(Boolean))];

    const filteredProducts = products.filter(product => {
        const matchesSearch = product.name.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesCategory = selectedCategory === 'Tout' || product.category === selectedCategory;
        return matchesSearch && matchesCategory;
    });

    const loadShopData = async () => {
        try {
            setLoading(true);
            const { data: shopData, error: shopError } = await supabase
                .from('shops')
                .select('*')
                .eq('slug', slug)
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

    const addToCart = (product: Product) => {
        if (navigator.vibrate) navigator.vibrate(50);

        // Visual feedback
        setAddedId(product.id);
        setTimeout(() => setAddedId(null), 1500);

        setCart(prev => {
            const existing = prev.find(item => item.product.id === product.id);
            if (existing) {
                return prev.map(item =>
                    item.product.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
                );
            }
            return [...prev, { product, quantity: 1 }];
        });
    };

    const updateQuantity = (productId: string, delta: number) => {
        setCart(prev => prev.map(item => {
            if (item.product.id === productId) {
                const newQuantity = Math.max(0, item.quantity + delta);
                setAddedId(productId); // Small sparkle/feedback
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


    const totalAmount = cart.reduce((acc, item) => acc + ((item.product.price || 0) * item.quantity), 0);
    const totalItems = cart.reduce((acc, item) => acc + item.quantity, 0);

    const handleSubmitOrder = async (e: FormEvent) => {
        e.preventDefault();
        if (!shop || cart.length === 0) return;

        try {
            setIsSubmitting(true);
            const { error } = await supabase
                .from('customer_orders')
                .insert({
                    shop_id: shop.id,
                    items: cart.map(item => ({
                        id: item.product.id,
                        name: item.product.name,
                        price: item.product.price || 0,
                        quantity: item.quantity
                    })),
                    total_amount: totalAmount,
                    customer_name: customerInfo.name,
                    customer_phone: customerInfo.phone,
                    order_note: orderNote,
                    delivery_method: deliveryMethod,
                    status: 'pending'
                });

            if (error) throw error;
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

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen text-slate-400">
                <Loader2 className="animate-spin mb-4" size={40} />
                <p>Chargement de la boutique...</p>
            </div>
        );
    }

    if (!shop) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen p-6 text-center">
                <Store className="w-16 h-16 text-slate-300 mb-4" />
                <h1 className="text-xl font-bold text-slate-700">Boutique introuvable</h1>
                <p className="text-slate-500 mt-2">Cette boutique n'existe pas ou est fermée.</p>
            </div>
        );
    }

    return (
        <div className="container">
            {/* Theme Toggle */}
            <button
                onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                className="theme-switch"
                title="Changer le thème"
            >
                {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
            </button>

            {/* Header */}
            <header className="shop-header">
                <span className="shop-badge">Vitrine Velmo</span>
                <h1 className="shop-title">{shop.name}</h1>

                {/* 📍 Info Boutique Section (New) */}
                <div className="flex flex-wrap items-center justify-center gap-4 mt-4 text-sm text-slate-500">
                    <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-white/5 py-1.5 px-3 rounded-full">
                        <MapPin size={14} className="text-primary" />
                        <span>Abidjan (Exemple)</span>
                    </div>
                    <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-white/5 py-1.5 px-3 rounded-full">
                        <Clock size={14} className="text-primary" />
                        <span>Lun-Sam · 8h-18h</span>
                    </div>
                    <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-white/5 py-1.5 px-3 rounded-full">
                        <Phone size={14} className="text-primary" />
                        <span>Contact après commande</span>
                    </div>
                </div>

                <p className="text-slate-400 mt-4 max-w-lg mx-auto">{shop.description || "Retrouvez tous nos produits ci-dessous."}</p>

                {/* 🔍 Search & Filter Section */}
                <div className="mt-8 mb-2 w-full max-w-md mx-auto">
                    <div className="relative">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                        <input
                            type="text"
                            placeholder="Rechercher un produit..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-12 pr-4 py-3 rounded-xl bg-slate-100 dark:bg-white/5 border-none outline-none focus:ring-2 focus:ring-primary/50 transition-all font-medium"
                        />
                    </div>
                </div>

                {/* 📂 Categories */}
                {categories.length > 1 && (
                    <div className="flex gap-2 overflow-x-auto pb-4 pt-2 -mx-4 px-4 justify-start md:justify-center no-scrollbar">
                        {categories.map(cat => (
                            <button
                                key={cat as string}
                                onClick={() => setSelectedCategory(cat as string)}
                                className={`whitespace-nowrap px-4 py-2 rounded-full text-sm font-bold transition-all ${selectedCategory === cat
                                    ? 'bg-primary text-white shadow-lg shadow-primary/25'
                                    : 'bg-slate-100 dark:bg-white/5 text-slate-500 hover:bg-slate-200 dark:hover:bg-white/10'
                                    }`}
                            >
                                {cat as string}
                            </button>
                        ))}
                    </div>
                )}
            </header>

            {/* Product Grid */}
            <div className="product-grid">
                {filteredProducts.map(product => (
                    <motion.div
                        key={product.id}
                        className="product-card"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        whileHover={{ y: -5 }}
                        onClick={() => setSelectedProduct(product)}
                        style={{ cursor: 'pointer' }}
                    >
                        <div className="card-img-container">
                            {product.image_url ? (
                                <img src={product.image_url} alt={product.name} loading="lazy" />
                            ) : (
                                <Store size={48} className="text-white/10" strokeWidth={1} />
                            )}
                            {/* Stock Badge */}
                            <div className={`absolute top-3 right-3 px-3 py-1 rounded-full text-xs font-bold shadow-sm backdrop-blur-md ${product.is_active
                                ? 'bg-green-500/90 text-white'
                                : 'bg-red-500/90 text-white'
                                }`}>
                                {product.is_active ? 'Disponible' : 'Rupture'}
                            </div>
                        </div>
                        <div className="card-content">
                            <h3 className="product-title" title={product.name}>{product.name}</h3>
                            <div className="product-price">
                                {formatPrice(product.price, shop.currency || 'XOF')}
                            </div>

                            {product.is_active && (
                                <button
                                    className={`btn-add-cart ${addedId === product.id ? 'added' : ''}`}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        addToCart(product);
                                    }}
                                >
                                    {addedId === product.id ? (
                                        <>
                                            <Check size={18} />
                                            <span>Ajouté !</span>
                                        </>
                                    ) : (
                                        <>
                                            <Plus size={18} />
                                            <span>Ajouter</span>
                                        </>
                                    )}
                                </button>
                            )}
                        </div>
                    </motion.div>
                ))}

                {filteredProducts.length === 0 && (
                    <div className="col-span-full text-center py-20 text-slate-500">
                        <ShoppingBag size={48} className="mx-auto mb-4 opacity-20" />
                        <p className="font-bold text-lg">Aucun produit trouvé</p>
                        {searchQuery && <p className="text-sm mt-2 opacity-60">Essayez une autre recherche.</p>}
                        {!searchQuery && selectedCategory !== 'Tout' && <button onClick={() => setSelectedCategory('Tout')} className="text-primary mt-4 font-bold text-sm underline">Voir tous les produits</button>}
                    </div>
                )}
            </div>

            {/* Product Quick View Modal */}
            <AnimatePresence>
                {selectedProduct && (
                    <>
                        {/* Overlay */}
                        <motion.div
                            className="product-modal-overlay"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setSelectedProduct(null)}
                        />

                        {/* Modal Content */}
                        <div className="product-modal-container">
                            <motion.div
                                className="product-modal-content"
                                initial={{ y: '100%' }}
                                animate={{ y: 0 }}
                                exit={{ y: '100%' }}
                                transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                            >
                                <button
                                    className="btn-close-modal"
                                    onClick={() => setSelectedProduct(null)}
                                >
                                    <X size={24} />
                                </button>

                                <div className="product-modal-img">
                                    {selectedProduct.image_url ? (
                                        <img src={selectedProduct.image_url} alt={selectedProduct.name} />
                                    ) : (
                                        <Store size={64} className="text-slate-300" strokeWidth={1} />
                                    )}
                                </div>

                                <div className="product-modal-info">
                                    <h2>{selectedProduct.name}</h2>
                                    <div className="product-modal-price">
                                        {formatPrice(selectedProduct.price, shop.currency || 'XOF')}
                                    </div>

                                    {selectedProduct.description && (
                                        <p className="product-modal-desc">
                                            {selectedProduct.description}
                                        </p>
                                    )}

                                    <button
                                        className={`btn-add-cart ${addedId === selectedProduct.id ? 'added' : ''}`}
                                        onClick={() => addToCart(selectedProduct)}
                                        style={{ marginTop: 'auto', padding: '16px', fontSize: '1rem', width: '100%' }}
                                    >
                                        {addedId === selectedProduct.id ? (
                                            <>
                                                <Check size={20} />
                                                <span>Ajouté au panier</span>
                                            </>
                                        ) : (
                                            <>
                                                <Plus size={20} />
                                                <span>Ajouter au panier</span>
                                            </>
                                        )}
                                    </button>
                                </div>
                            </motion.div>
                        </div>
                    </>
                )}
            </AnimatePresence>

            {/* Floating Cart Trigger */}
            <AnimatePresence>
                {totalItems > 0 && (
                    <motion.div
                        key="cart-bubble"
                        initial={{ scale: 0, y: 50, x: '-50%' }}
                        animate={{
                            scale: 1,
                            y: 0,
                            x: '-50%',
                            transition: { type: 'spring', stiffness: 260, damping: 20 }
                        }}
                        exit={{ scale: 0, y: 50, x: '-50%' }}
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        className="cart-floating"
                        onClick={() => setIsCartOpen(true)}
                    >
                        <motion.div
                            key={totalItems}
                            initial={{ scale: 1.5 }}
                            animate={{ scale: 1 }}
                            className="cart-count"
                        >
                            {totalItems}
                        </motion.div>
                        <span className="font-bold">Voir mon panier • {totalAmount.toLocaleString()} {shop.currency}</span>
                        <ShoppingBag size={20} />
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Cart Bottom Sheet */}
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
                            initial={{ y: '100%', x: window.innerWidth > 1024 ? 0 : '-50%' }}
                            animate={{ y: 0, x: window.innerWidth > 1024 ? 0 : '-50%' }}
                            exit={{ y: '100%', x: window.innerWidth > 1024 ? 0 : '-50%' }}
                            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
                        >
                            <div className="cart-header">
                                <div className="flex items-center gap-3">
                                    <ShoppingCart size={24} className="text-primary" />
                                    <h2 className="text-xl font-bold">Votre Panier</h2>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => setIsCartOpen(false)}
                                        className="btn-continue hidden md:flex"
                                    >
                                        <ArrowLeft size={16} />
                                        <span>Continuer</span>
                                    </button>
                                    <button onClick={() => setIsCartOpen(false)} className="btn-qty">
                                        <X size={24} />
                                    </button>
                                </div>
                            </div>

                            <div className="cart-body">
                                {orderSuccess ? (
                                    <motion.div
                                        initial={{ opacity: 0, scale: 0.9 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        className="success-screen"
                                    >
                                        <div className="success-icon">
                                            <Check size={40} />
                                        </div>
                                        <h2 className="text-2xl font-black mb-2">Commande Reçue !</h2>
                                        <p className="text-slate-500 mb-8 max-w-[280px] mx-auto">
                                            Le vendeur a été notifié et vous contactera sur <b>WhatsApp</b> pour finaliser.
                                        </p>
                                        <motion.button
                                            whileTap={{ scale: 0.95 }}
                                            onClick={() => {
                                                setIsCartOpen(false);
                                                setOrderSuccess(false);
                                            }}
                                            className="btn-valider"
                                            style={{ background: 'black' }}
                                        >
                                            Fermer
                                        </motion.button>
                                    </motion.div>
                                ) : cart.length === 0 ? (
                                    <motion.div
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        className="empty-cart-screen"
                                    >
                                        <div className="empty-cart-icon">
                                            <ShoppingBag size={48} strokeWidth={1.5} />
                                        </div>
                                        <h3 className="text-xl font-bold mb-2">Votre panier est vide</h3>
                                        <p className="text-slate-500 mb-8">Découvrez nos produits et commencez votre shopping !</p>
                                        <button
                                            onClick={() => setIsCartOpen(false)}
                                            className="btn-valider"
                                            style={{ background: 'var(--primary)', color: 'white' }}
                                        >
                                            Voir les produits
                                        </button>
                                    </motion.div>
                                ) : (
                                    <>
                                        <div className="cart-items-container">
                                            {cart.map(item => (
                                                <div key={item.product.id} className="cart-item">
                                                    {item.product.image_url ? (
                                                        <img src={item.product.image_url} className="cart-item-img" alt={item.product.name} />
                                                    ) : (
                                                        <div className="cart-item-img bg-slate-100 flex items-center justify-center">
                                                            <Store className="text-slate-300" size={20} />
                                                        </div>
                                                    )}
                                                    <div className="cart-item-info">
                                                        <h4 className="font-bold">{item.product.name}</h4>
                                                        <p className="font-bold text-primary">{(item.product.price || 0).toLocaleString()} {shop.currency}</p>
                                                    </div>
                                                    <div className="qty-controls">
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                if (navigator.vibrate) navigator.vibrate(30);
                                                                updateQuantity(item.product.id, -1);
                                                            }}
                                                            className="btn-qty"
                                                        >
                                                            {item.quantity === 1 ? <Trash2 size={16} className="text-red-500" /> : <Minus size={16} />}
                                                        </button>
                                                        <input
                                                            type="number"
                                                            className="qty-input"
                                                            value={item.quantity}
                                                            onChange={(e) => setManualQuantity(item.product.id, parseInt(e.target.value) || 0)}
                                                        />
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                if (navigator.vibrate) navigator.vibrate(30);
                                                                updateQuantity(item.product.id, 1);
                                                            }}
                                                            className="btn-qty"
                                                        >
                                                            <Plus size={16} />
                                                        </button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>

                                        <div className="mt-8">
                                            <h3 className="font-bold mb-4 flex items-center gap-2 text-slate-500 uppercase text-xs tracking-widest">
                                                Mode de réception
                                            </h3>
                                            <div className="delivery-toggle mb-6">
                                                <button
                                                    type="button"
                                                    className={`toggle-item ${deliveryMethod === 'pickup' ? 'active' : ''}`}
                                                    onClick={() => setDeliveryMethod('pickup')}
                                                >
                                                    <MapPin size={18} />
                                                    <span>Retrait</span>
                                                </button>
                                                <button
                                                    type="button"
                                                    className={`toggle-item ${deliveryMethod === 'delivery' ? 'active' : ''}`}
                                                    onClick={() => setDeliveryMethod('delivery')}
                                                >
                                                    <Truck size={18} />
                                                    <span>Livraison</span>
                                                </button>
                                            </div>

                                            <motion.div
                                                key={deliveryMethod}
                                                initial={{ opacity: 0, y: 10 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                className="bg-primary/5 p-4 rounded-2xl mb-6 text-sm flex items-start gap-3 border border-primary/10"
                                            >
                                                {deliveryMethod === 'pickup' ? (
                                                    <>
                                                        <MapPin size={18} className="text-primary shrink-0" />
                                                        <p className="font-medium text-slate-600 dark:text-slate-300">
                                                            <b>Retrait en boutique</b> : Vous récupérez votre commande directement sur place. Le vendeur vous confirmera quand elle est prête.
                                                        </p>
                                                    </>
                                                ) : (
                                                    <>
                                                        <Truck size={18} className="text-primary shrink-0" />
                                                        <p className="font-medium text-slate-600 dark:text-slate-300">
                                                            <b>Livraison</b> : Pas d'adresse à taper ici. Le vendeur vous contactera pour organiser le transport et confirmer les frais.
                                                        </p>
                                                    </>
                                                )}
                                            </motion.div>

                                            <h3 className="font-bold mb-4 flex items-center gap-2 text-slate-500 uppercase text-xs tracking-widest">
                                                Vos informations
                                            </h3>
                                            <form onSubmit={handleSubmitOrder} className="space-y-3">
                                                <input
                                                    className="input-minimal"
                                                    placeholder="Votre nom complet"
                                                    required
                                                    value={customerInfo.name}
                                                    onChange={e => setCustomerInfo({ ...customerInfo, name: e.target.value })}
                                                />
                                                <input
                                                    className="input-minimal"
                                                    type="tel"
                                                    placeholder="Numéro WhatsApp (ex: +225...)"
                                                    required
                                                    value={customerInfo.phone}
                                                    onChange={e => setCustomerInfo({ ...customerInfo, phone: e.target.value })}
                                                />

                                                <textarea
                                                    className="textarea-minimal"
                                                    placeholder="Message pour le vendeur (optionnel)..."
                                                    rows={2}
                                                    value={orderNote}
                                                    onChange={e => setOrderNote(e.target.value)}
                                                />

                                                <div className="checkout-section mt-6 rounded-2xl">
                                                    <div className="total-row">
                                                        <span className="total-label">Total à payer</span>
                                                        <span className="total-value">{totalAmount.toLocaleString()} {shop.currency}</span>
                                                    </div>

                                                    <motion.button
                                                        type="submit"
                                                        disabled={isSubmitting}
                                                        whileTap={{ scale: 0.98 }}
                                                        className="btn-valider"
                                                    >
                                                        {isSubmitting ? <Loader2 className="animate-spin" /> : (
                                                            <>
                                                                <span>Confirmer la commande</span>
                                                                <ArrowRight size={20} />
                                                            </>
                                                        )}
                                                    </motion.button>

                                                    <div className="reassurance-text">
                                                        <Check size={14} className="inline mr-1 text-green-500" />
                                                        Paiement sécurisé au retrait/livraison
                                                    </div>
                                                </div>

                                                <button
                                                    type="button"
                                                    onClick={() => setIsCartOpen(false)}
                                                    className="btn-outline mt-4 mb-8"
                                                >
                                                    <ArrowLeft size={18} />
                                                    Continuer mes achats
                                                </button>
                                            </form>
                                        </div>
                                    </>
                                )}
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>

            <footer className="py-20 text-center opacity-30">
                <p>Créé avec Velmo</p>
            </footer>
        </div>
    );
}
