import React, { useState, useEffect, useRef } from 'react';
import { supabase, STORAGE_BUCKET } from './supabaseClient';
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
  const [uploading, setUploading] = useState(false);
  const [selectedImage, setSelectedImage] = useState<{
    file: File;
    preview: string;
  } | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [newCard, setNewCard] = useState({
    name: '',
    group_name: '',
    album: '',
    status: 'Owned' as Photocard['status'],
    price: '',
    image_url: '', // NEW: URL field
  });

  // ============================================================
  // IMAGE PICKER FUNCTIONS (Web Version)
  // ============================================================

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('Please select an image file');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      alert('Image must be smaller than 5MB');
      return;
    }

    const preview = URL.createObjectURL(file);
    setSelectedImage({ file, preview });
    // Clear URL field when uploading a file
    setNewCard({ ...newCard, image_url: '' });
  };

  const uploadImage = async (file: File): Promise<string | null> => {
    try {
      setUploading(true);
      
      const fileExt = file.name.split('.').pop() || 'jpg';
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
      
      const arrayBuffer = await file.arrayBuffer();
      
      const { data, error } = await supabase.storage
        .from(STORAGE_BUCKET)
        .upload(fileName, arrayBuffer, {
          contentType: file.type,
          cacheControl: '3600',
          upsert: false,
        });
      
      if (error) {
        console.error('Upload error:', error);
        alert(`Upload failed: ${error.message}`);
        return null;
      }
      
      const { data: publicUrlData } = supabase.storage
        .from(STORAGE_BUCKET)
        .getPublicUrl(fileName);
      
      return publicUrlData.publicUrl;
      
    } catch (err) {
      console.error('Upload error:', err);
      alert('Failed to upload image. Please try again.');
      return null;
    } finally {
      setUploading(false);
    }
  };

  const triggerFilePicker = () => {
    fileInputRef.current?.click();
  };

  const removeImage = () => {
    if (selectedImage) {
      URL.revokeObjectURL(selectedImage.preview);
      setSelectedImage(null);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    // Clear URL field too
    setNewCard({ ...newCard, image_url: '' });
  };

  // ============================================================
  // DATABASE FUNCTIONS
  // ============================================================

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

  const addCard = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    
    let imageUrl: string | null = null;
    
    // Priority 1: If a file is selected, upload it
    if (selectedImage) {
      imageUrl = await uploadImage(selectedImage.file);
      if (!imageUrl) {
        setError('Failed to upload image. Please try again.');
        return;
      }
    } 
    // Priority 2: If URL is provided, use it
    else if (newCard.image_url.trim()) {
      imageUrl = newCard.image_url.trim();
    }
    
    const cardData = {
      name: newCard.name,
      group_name: newCard.group_name,
      album: newCard.album || null,
      status: newCard.status,
      image_url: imageUrl,
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
      
      // Reset form
      setNewCard({
        name: '',
        group_name: '',
        album: '',
        status: 'Owned',
        price: '',
        image_url: '',
      });
      removeImage();
      setShowAddForm(false);
      
    } catch (err) {
      setError('Failed to add card.');
    }
  };

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

  useEffect(() => {
    loadCards();
  }, []);

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

  // ============================================================
  // RENDER
  // ============================================================

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
              
              {/* NEW: URL Input Field */}
              <div className="form-group">
                <label>Image URL (optional)</label>
                <input
                  type="url"
                  value={newCard.image_url}
                  onChange={(e) => {
                    setNewCard({...newCard, image_url: e.target.value});
                    // If user types a URL, clear the uploaded file
                    if (e.target.value && selectedImage) {
                      removeImage();
                    }
                  }}
                  placeholder="https://example.com/card-image.jpg"
                  disabled={!!selectedImage} // Disable if a file is uploaded
                />
                <small>Paste a URL or use the Choose Photo button below</small>
              </div>
              
              {/* Image Picker Section */}
              <div className="form-group">
                <label>Or Upload from Device</label>
                <div className="image-picker-area">
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileSelect}
                    accept="image/*"
                    style={{ display: 'none' }}
                  />
                  
                  {selectedImage ? (
                    <div className="image-preview">
                      <img 
                        src={selectedImage.preview} 
                        alt="Selected card" 
                        className="preview-thumbnail"
                      />
                      <button 
                        type="button" 
                        className="remove-image-btn"
                        onClick={removeImage}
                      >
                        ✕ Remove
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      className="pick-image-btn"
                      onClick={triggerFilePicker}
                      disabled={uploading}
                    >
                      {uploading ? '⏳ Uploading...' : '📷 Choose Photo'}
                    </button>
                  )}
                  {uploading && <div className="upload-progress">Uploading image...</div>}
                  <small>Select an image from your device (Max 5MB)</small>
                </div>
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
                <button type="button" className="btn-secondary" onClick={() => {
                  setShowAddForm(false);
                  removeImage();
                }}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary" disabled={uploading}>
                  {uploading ? 'Uploading...' : '➕ Add Card'}
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