import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import './styles.css';

interface Photocard {
  id: string;
  name: string;
  group_name: string;
  album: string | null;
  status: 'Owned' | 'Wishlist' | 'Trade' | 'Sold';
  image_url: string | null;
  price: number | null;
  created_at?: string;
}

export default function App() {
  const [cards, setCards] = useState<Photocard[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<string>('All');
  const [showAddForm, setShowAddForm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [newCard, setNewCard] = useState({
    name: '',
    group_name: '',
    album: '',
    status: 'Owned' as Photocard['status'],
    image_url: '',
    price: '',
  });

  // Load cards from Supabase
  const loadCards = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error } = await supabase
        .from('cards')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) {
        setError(`Database error: ${error.message}`);
        return;
      }
      setCards(data || []);
    } catch (err) {
      setError('Failed to connect to database.');
    } finally {
      setLoading(false);
    }
  };

  // Add card to Supabase
  const addCard = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    
    const cardData = {
      name: newCard.name,
      group_name: newCard.group_name,
      album: newCard.album || null,
      status: newCard.status,
      image_url: newCard.image_url || null,
      price: newCard.price ? parseFloat(newCard.price) : null,
    };

    try {
      const { data, error } = await supabase
        .from('cards')
        .insert([cardData])
        .select();
      
      if (error) {
        setError(`Failed to add card: ${error.message}`);
        return;
      }
      
      if (data) setCards([data[0], ...cards]);
      
      setNewCard({
        name: '',
        group_name: '',
        album: '',
        status: 'Owned',
        image_url: '',
        price: '',
      });
      setShowAddForm(false);
    } catch (err) {
      setError('Failed to add card.');
    }
  };

  // Delete card
  const deleteCard = async (id: string) => {
    if (!confirm('Delete this card?')) return;
    setError(null);
    
    try {
      const { error } = await supabase
        .from('cards')
        .delete()
        .eq('id', id);
      
      if (error) {
        setError(`Failed to delete card: ${error.message}`);
        return;
      }
      setCards(cards.filter(card => card.id !== id));
    } catch (err) {
      setError('Failed to delete card.');
    }
  };

  // Load cards on app start
  useEffect(() => {
    loadCards();
  }, []);

  // Filter and search
  const filteredCards = cards.filter((card) => {
    const matchesSearch = 
      card.name.toLowerCase().includes(search.toLowerCase()) ||
      card.group_name.toLowerCase().includes(search.toLowerCase()) ||
      (card.album && card.album.toLowerCase().includes(search.toLowerCase()));
    const matchesFilter = filter === 'All' || card.status === filter;
    return matchesSearch && matchesFilter;
  });

  const stats = {
    total: cards.length,
    owned: cards.filter(c => c.status === 'Owned').length,
    wishlist: cards.filter(c => c.status === 'Wishlist').length,
    trade: cards.filter(c => c.status === 'Trade').length,
    sold: cards.filter(c => c.status === 'Sold').length,
    value: cards
      .filter(c => c.status === 'Owned')
      .reduce((sum, c) => sum + (c.price || 0), 0),
  };

  return (
    <div className="app">
      <header className="header">
        <h1>📸 My K-Pop Collection</h1>
        <div className="stats">
          <span>Total: {stats.total}</span>
          <span>Owned: {stats.owned}</span>
          <span>Wishlist: {stats.wishlist}</span>
          <span>Value: ${stats.value.toFixed(2)}</span>
        </div>
      </header>

      <div className="controls">
        <input
          type="text"
          placeholder="🔍 Search cards..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="search-input"
        />
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="filter-select"
        >
          <option value="All">All ({stats.total})</option>
          <option value="Owned">✅ Owned ({stats.owned})</option>
          <option value="Wishlist">⭐ Wishlist ({stats.wishlist})</option>
          <option value="Trade">🔄 Trade ({stats.trade})</option>
          <option value="Sold">💸 Sold ({stats.sold})</option>
        </select>
      </div>

      {error && (
        <div className="error-message">
          ⚠️ {error}
          <button onClick={() => setError(null)}>✕</button>
        </div>
      )}

      {loading ? (
        <div className="loading">⏳ Loading...</div>
      ) : filteredCards.length === 0 ? (
        <div className="empty-state">
          <p>📭 No cards found</p>
          <p className="empty-sub">Add your first card using the + button!</p>
        </div>
      ) : (
        <div className="grid">
          {filteredCards.map((card) => (
            <div key={card.id} className="card">
              <img
                src={card.image_url || 'https://via.placeholder.com/300x400/333/666?text=No+Image'}
                alt={card.name}
                className="card-image"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = 'https://via.placeholder.com/300x400/333/666?text=No+Image';
                }}
              />
              <div className="card-info">
                <div className="card-name">{card.name}</div>
                <div className="card-group">{card.group_name}</div>
                {card.album && <div className="card-album">📀 {card.album}</div>}
                <span className="card-status" style={{ background: getStatusColor(card.status) }}>
                  {card.status}
                </span>
                {card.price && <div className="card-price">💰 ${card.price.toFixed(2)}</div>}
                <button className="delete-btn" onClick={() => deleteCard(card.id)}>
                  ✕
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <button className="fab" onClick={() => setShowAddForm(true)}>
        +
      </button>

      {showAddForm && (
        <div className="modal-overlay" onClick={() => setShowAddForm(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>➕ Add New Card</h2>
            <form onSubmit={addCard}>
              <div className="form-group">
                <label>Member Name *</label>
                <input
                  type="text"
                  value={newCard.name}
                  onChange={(e) => setNewCard({...newCard, name: e.target.value})}
                  required
                  placeholder="e.g., Jisoo"
                />
              </div>
              <div className="form-group">
                <label>Group *</label>
                <input
                  type="text"
                  value={newCard.group_name}
                  onChange={(e) => setNewCard({...newCard, group_name: e.target.value})}
                  required
                  placeholder="e.g., BLACKPINK"
                />
              </div>
              <div className="form-group">
                <label>Album</label>
                <input
                  type="text"
                  value={newCard.album}
                  onChange={(e) => setNewCard({...newCard, album: e.target.value})}
                  placeholder="e.g., BORN PINK"
                />
              </div>
              <div className="form-group">
                <label>Status *</label>
                <select
                  value={newCard.status}
                  onChange={(e) => setNewCard({...newCard, status: e.target.value as Photocard['status']})}
                  required
                >
                  <option value="Owned">✅ Owned</option>
                  <option value="Wishlist">⭐ Wishlist</option>
                  <option value="Trade">🔄 Trade</option>
                  <option value="Sold">💸 Sold</option>
                </select>
              </div>
              <div className="form-group">
                <label>Image URL</label>
                <input
                  type="url"
                  value={newCard.image_url}
                  onChange={(e) => setNewCard({...newCard, image_url: e.target.value})}
                  placeholder="https://picsum.photos/seed/example/300/400"
                />
                <small>💡 Use picsum.photos for demo images</small>
              </div>
              <div className="form-group">
                <label>Price (USD)</label>
                <input
                  type="number"
                  step="0.01"
                  value={newCard.price}
                  onChange={(e) => setNewCard({...newCard, price: e.target.value})}
                  placeholder="15.99"
                />
              </div>
              <div className="modal-actions">
                <button type="button" className="btn-secondary" onClick={() => setShowAddForm(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
                  ➕ Add Card
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function getStatusColor(status: string): string {
  switch(status) {
    case 'Owned': return '#4CAF50';
    case 'Wishlist': return '#2196F3';
    case 'Trade': return '#FF9800';
    case 'Sold': return '#f44336';
    default: return '#666';
  }
}