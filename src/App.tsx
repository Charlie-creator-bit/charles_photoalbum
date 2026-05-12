/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, ReactNode, MouseEvent, FormEvent, FC, ChangeEvent } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Plus, 
  Image as ImageIcon, 
  Upload,
  Layers, 
  LogOut, 
  Search, 
  Trash2, 
  X, 
  Maximize2,
  FolderOpen,
  User,
  Share2,
  Globe,
  Lock
} from 'lucide-react';
import { auth, loginWithGoogle, logout } from './services/firebase';
import { photoService, Photo, Album } from './services/photoService';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';

export default function App() {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [albums, setAlbums] = useState<Album[]>([]);
  const [selectedAlbumId, setSelectedAlbumId] = useState<string | null>(null);
  const [viewingPhoto, setViewingPhoto] = useState<Photo | null>(null);
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [isCreateAlbumOpen, setIsCreateAlbumOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [shareStatus, setShareStatus] = useState<{[key: string]: string}>({});

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const photoId = urlParams.get('photo');
    if (photoId) {
      photoService.getPhotoById(photoId).then(p => {
        if (p) setViewingPhoto(p);
      });
    }

    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleShare = async (e: MouseEvent, photo: Photo) => {
    e.stopPropagation();
    const isPublic = !photo.isPublic;
    
    try {
      // Toggle public status
      if (user && photo.userId === user.uid) {
        await photoService.updatePhoto(photo.id, { isPublic });
      }
      
      // Copy link
      const url = `${window.location.origin}${window.location.pathname}?photo=${photo.id}`;
      await navigator.clipboard.writeText(url);
      
      setShareStatus(prev => ({ ...prev, [photo.id]: 'Link Copied!' }));
      setTimeout(() => {
        setShareStatus(prev => {
          const next = { ...prev };
          delete next[photo.id];
          return next;
        });
      }, 2000);
    } catch (err) {
      console.error('Failed to share:', err);
    }
  };

  useEffect(() => {
    if (user) {
      const unsubPhotos = photoService.getPhotos(selectedAlbumId, setPhotos);
      const unsubAlbums = photoService.getAlbums(setAlbums);
      return () => {
        unsubPhotos();
        unsubAlbums();
      };
    }
  }, [user, selectedAlbumId]);

  const filteredPhotos = photos.filter(p => 
    p.title?.toLowerCase().includes(searchQuery.toLowerCase()) || 
    p.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-[#050505]">
        <motion.div 
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full"
        />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-slate-900 p-6 text-center relative overflow-hidden">
        {/* Background Mesh */}
        <div className="absolute top-[-10%] left-[-10%] w-[60%] h-[60%] rounded-full bg-indigo-600/20 blur-[120px] animate-float px-2"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-orange-500/10 blur-[100px] animate-float-delayed"></div>
        
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-md z-10 p-12 bg-white/5 backdrop-blur-3xl rounded-[40px] border border-white/10 shadow-2xl"
        >
          <div className="w-20 h-20 bg-gradient-to-tr from-indigo-500 to-purple-400 rounded-2xl flex items-center justify-center mx-auto mb-8 shadow-lg shadow-indigo-500/20">
            <ImageIcon className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-5xl font-bold tracking-tight text-white mb-4">Memora</h1>
          <p className="text-slate-400 mb-12 leading-relaxed">
            A beautiful, frosted space for your most precious memories. Organized, safe, and always within reach.
          </p>
          <button 
            onClick={loginWithGoogle}
            className="w-full py-4 bg-indigo-500 text-white rounded-2xl font-bold hover:bg-indigo-400 transition-all flex items-center justify-center gap-3 active:scale-[0.98] shadow-lg shadow-indigo-500/20"
          >
            <User className="w-5 h-5" />
            Continue with Google
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="h-screen w-screen overflow-hidden bg-slate-900 text-slate-100 flex font-sans relative">
      {/* Background Mesh */}
      <div className="absolute top-[-10%] left-[-10%] w-[60%] h-[60%] rounded-full bg-indigo-600/20 blur-[120px] animate-float"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-orange-500/10 blur-[100px] animate-float-delayed"></div>

      {/* Sidebar */}
      <aside className="w-72 h-full bg-white/5 backdrop-blur-xl border-r border-white/10 flex flex-col z-20 hidden md:flex">
        <div className="p-8 pb-4 flex flex-col h-full">
          <div className="flex items-center gap-3 mb-12">
            <div className="w-10 h-10 bg-gradient-to-tr from-indigo-500 to-purple-400 rounded-xl shadow-lg shadow-indigo-500/20 flex items-center justify-center">
              <Layers className="w-6 h-6 text-white" />
            </div>
            <span className="text-xl font-bold tracking-tight">Memora</span>
          </div>

          <nav className="space-y-4">
            <p className="text-[10px] uppercase tracking-[0.2em] font-bold text-slate-400 px-2">Library</p>
            <SidebarItem 
              icon={<ImageIcon className="w-4 h-4" />} 
              label="All Photos" 
              active={selectedAlbumId === null} 
              onClick={() => setSelectedAlbumId(null)} 
            />
          </nav>

          <div className="mt-12 overflow-y-auto flex-1 custom-scrollbar pr-2">
            <div className="flex items-center justify-between mb-4 px-2">
              <span className="text-[10px] uppercase tracking-[0.2em] font-bold text-slate-400">Albums</span>
              <button 
                onClick={() => setIsCreateAlbumOpen(true)}
                className="p-1 hover:bg-white/10 rounded-md transition-colors text-slate-400 hover:text-white"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-1">
              {albums.map(album => (
                <SidebarItem 
                  key={album.id}
                  icon={<FolderOpen className="w-4 h-4" />} 
                  label={album.name} 
                  active={selectedAlbumId === album.id} 
                  onClick={() => setSelectedAlbumId(album.id)}
                  onDelete={async (e) => {
                    e.stopPropagation();
                    if (confirm("Delete this album? Photos won't be deleted.")) {
                      try {
                        await photoService.deleteAlbum(album.id);
                        if (selectedAlbumId === album.id) setSelectedAlbumId(null);
                      } catch (err: any) {
                        alert("Failed to delete album: " + err.message);
                      }
                    }
                  }}
                />
              ))}
            </div>
          </div>

          <div className="mt-8 space-y-4 px-2">
            <p className="text-[10px] uppercase tracking-[0.2em] font-bold text-slate-400">Settings</p>
            <button 
              onClick={async () => {
                if (photos.length === 0) return;
                if (confirm(`Are you sure you want to delete ALL ${photos.length} memories? This cannot be undone.`)) {
                  try {
                    await photoService.deleteAllPhotos(photos);
                    alert("Library cleared successfully");
                  } catch (err: any) {
                    alert("Failed to clear library: " + err.message);
                  }
                }
              }}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-slate-400 hover:bg-red-500/10 hover:text-red-400 transition-all duration-300"
            >
              <Trash2 className="w-4 h-4" />
              <span className="text-sm font-bold tracking-tight">Clear Library</span>
            </button>
          </div>
        </div>

        <div className="mt-auto p-8 border-t border-white/5 bg-white/[0.02]">
          <div className="flex items-center gap-3">
            <img src={user.photoURL || ''} className="w-8 h-8 rounded-full border border-white/20" alt="" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold truncate">{user.displayName}</p>
            </div>
            <button onClick={logout} className="p-2 hover:bg-white/10 rounded-lg text-slate-400 hover:text-white transition-colors">
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 h-full overflow-y-auto relative custom-scrollbar z-10 flex flex-col">
        {/* Header */}
        <header className="sticky top-0 z-30 bg-slate-900/40 backdrop-blur-md border-b border-white/5 px-8 flex items-center justify-between h-20">
          <div className="relative w-96">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input 
              type="text" 
              placeholder="Search your memories..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-full py-2.5 pl-12 pr-4 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500/50 focus:border-indigo-500/50 transition-all font-medium"
            />
          </div>
          <button 
            onClick={() => setIsUploadOpen(true)}
            className="flex items-center gap-2 px-6 py-2.5 bg-indigo-500 text-white rounded-full text-sm font-bold hover:bg-indigo-400 transition-all active:scale-[0.98] shadow-lg shadow-indigo-500/20"
          >
            <Plus className="w-4 h-4" />
            Upload Photos
          </button>
        </header>

        {/* Gallery */}
        <div className="p-10 flex-1">
          <div className="flex items-end justify-between mb-10">
            <div>
              <h2 className="text-4xl font-bold tracking-tight text-white mb-2">
                {selectedAlbumId ? albums.find(a => a.id === selectedAlbumId)?.name : 'Your Memory Lane'}
              </h2>
              <p className="text-slate-400">
                {filteredPhotos.length} {filteredPhotos.length === 1 ? 'photo' : 'photos'} in this collection
              </p>
            </div>
            
            <div className="flex gap-2 bg-white/5 p-1 rounded-xl border border-white/10">
              <button className="p-2 bg-white/10 rounded-lg shadow-sm text-white">
                <Layers className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
            <AnimatePresence mode="popLayout">
              {filteredPhotos.map((photo, index) => (
                <motion.div
                  key={photo.id}
                  layout
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  transition={{ delay: index * 0.05 }}
                  onClick={() => setViewingPhoto(photo)}
                  className="group relative aspect-[4/5] rounded-[2rem] overflow-hidden cursor-pointer bg-slate-800 border border-white/10 shadow-xl"
                >
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-transparent to-transparent z-10 opacity-80 group-hover:opacity-100 transition-opacity"></div>
                  <img 
                    src={photo.url} 
                    alt={photo.title} 
                    className="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-110 opacity-70 group-hover:opacity-100"
                  />
                  <div className="absolute bottom-0 left-0 right-0 p-8 z-20 transform translate-y-2 group-hover:translate-y-0 transition-transform">
                    <p className="text-[10px] font-bold text-indigo-300 uppercase tracking-widest mb-1">
                      {albums.find(a => a.id === photo.albumId)?.name || 'Archive'}
                    </p>
                    <h3 className="text-xl font-bold text-white truncate">{photo.title || 'Untitled'}</h3>
                    {photo.description && <p className="text-sm text-slate-300 opacity-60 truncate mt-1">{photo.description}</p>}
                  </div>
                  <div className="absolute top-6 right-6 opacity-0 group-hover:opacity-100 transition-all z-20 scale-90 group-hover:scale-100 flex flex-col gap-2">
                    <button 
                      onClick={(e) => handleShare(e, photo)}
                      className="p-3 bg-white/10 backdrop-blur-md rounded-2xl border border-white/10 shadow-xl hover:bg-white/20 transition-colors relative"
                    >
                      {shareStatus[photo.id] ? (
                        <span className="absolute right-full mr-2 top-1/2 -translate-y-1/2 bg-indigo-500 text-[10px] text-white px-2 py-1 rounded whitespace-nowrap">
                          {shareStatus[photo.id]}
                        </span>
                      ) : null}
                      <Share2 className="w-5 h-5 text-white" />
                    </button>
                    <button 
                      onClick={async (e) => {
                        e.stopPropagation();
                        if (confirm("Remove this memory?")) {
                          try {
                            await photoService.deletePhoto(photo);
                          } catch (err: any) {
                            alert("Failed to delete memory: " + err.message);
                          }
                        }
                      }}
                      className="p-3 bg-red-500/10 backdrop-blur-md rounded-2xl border border-red-500/20 shadow-xl hover:bg-red-500/20 transition-colors group/delete"
                      title="Remove from Library"
                    >
                      <Trash2 className="w-5 h-5 text-red-400 group-hover/delete:scale-110 transition-transform" />
                    </button>
                    <div className="p-3 bg-white/10 backdrop-blur-md rounded-2xl border border-white/10 shadow-xl">
                      <Maximize2 className="w-5 h-5 text-white" />
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
            {filteredPhotos.length === 0 && (
              <div className="col-span-full py-40 flex flex-col items-center justify-center text-slate-500 opacity-50 bg-white/5 rounded-[3rem] border border-dashed border-white/10">
                <ImageIcon className="w-16 h-16 mb-4" />
                <p className="text-xl font-medium">No memories found here</p>
              </div>
            )}
          </div>

          {/* Bottom Widget */}
          {filteredPhotos.length > 0 && (
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-12 p-8 bg-white/5 backdrop-blur-md rounded-[2.5rem] border border-white/10 flex items-center justify-between"
            >
              <div className="flex items-center gap-6">
                <div className="w-14 h-14 rounded-2xl bg-indigo-500/20 flex items-center justify-center text-indigo-400 border border-indigo-500/30">
                  <ImageIcon className="w-7 h-7" />
                </div>
                <div>
                  <p className="text-lg font-bold text-white">Your digital sanctuary</p>
                  <p className="text-sm text-slate-400">All photos are securely synchronized and private to you.</p>
                </div>
              </div>
              <button 
                onClick={() => setIsUploadOpen(true)}
                className="px-8 py-3 rounded-full border border-white/20 text-xs font-bold hover:bg-white/10 transition-all uppercase tracking-widest active:scale-95"
              >
                Add More memories
              </button>
            </motion.div>
          )}
        </div>
      </main>

      {/* Photo Viewer Modal */}
      <AnimatePresence>
        {viewingPhoto && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 md:p-12"
          >
            <div className="absolute inset-0 bg-slate-900/95 backdrop-blur-3xl" onClick={() => setViewingPhoto(null)} />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative w-full max-w-6xl max-h-full flex flex-col md:flex-row bg-white/5 rounded-[48px] overflow-hidden border border-white/10 shadow-2xl"
            >
              <div className="flex-1 bg-black/40 flex items-center justify-center relative overflow-hidden group">
                <img src={viewingPhoto.url} className="max-w-full max-h-full object-contain" alt="" />
                <button 
                  onClick={() => setViewingPhoto(null)} 
                  className="absolute top-8 left-8 p-4 bg-white/5 hover:bg-white/10 rounded-2xl border border-white/10 transition-all backdrop-blur-md"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
              <div className="w-full md:w-96 p-10 flex flex-col overflow-y-auto border-t md:border-t-0 md:border-l border-white/10 bg-white/[0.03] backdrop-blur-2xl custom-scrollbar">
                <div className="flex-1">
                  <p className="text-[10px] font-bold text-indigo-400 uppercase tracking-[0.2em] mb-4">Memory Details</p>
                  <h3 className="text-3xl font-bold mb-4">{viewingPhoto.title || 'Untitled'}</h3>
                  <div className="w-12 h-1 bg-indigo-500 rounded-full mb-8"></div>
                  <p className="text-slate-400 text-sm leading-relaxed mb-8">
                    {viewingPhoto.description || 'No description provided for this memory.'}
                  </p>
                  
                  <div className="space-y-4">
                    <div className="flex items-center gap-4 text-slate-300 bg-white/5 p-4 rounded-2xl border border-white/5">
                      <FolderOpen className="w-5 h-5 text-indigo-400" />
                      <div className="flex flex-col">
                        <span className="text-[10px] uppercase font-bold text-slate-500">Album</span>
                        <span className="text-sm font-medium">
                          {albums.find(a => a.id === viewingPhoto.albumId)?.name || 'Uncategorized'}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-4 text-slate-300 bg-white/5 p-4 rounded-2xl border border-white/5">
                      {viewingPhoto.isPublic ? <Globe className="w-5 h-5 text-green-400" /> : <Lock className="w-5 h-5 text-slate-500" />}
                      <div className="flex flex-col">
                        <span className="text-[10px] uppercase font-bold text-slate-500">Visibility</span>
                        <span className="text-sm font-medium">
                          {viewingPhoto.isPublic ? 'Publicly shareable' : 'Private to you'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-12 space-y-4 pt-8 border-t border-white/5">
                  <button 
                    onClick={(e) => handleShare(e, viewingPhoto)}
                    className="w-full py-4 bg-white/5 border border-white/10 text-white rounded-2xl hover:bg-white/10 transition-all flex items-center justify-center gap-2 text-sm font-bold active:scale-95"
                  >
                    <Share2 className="w-5 h-5" />
                    {shareStatus[viewingPhoto.id] || 'Share Memory'}
                  </button>

                  <button 
                    onClick={async () => {
                      if (confirm("Are you sure you want to delete this memory?")) {
                        try {
                          await photoService.deletePhoto(viewingPhoto);
                          setViewingPhoto(null);
                        } catch (err: any) {
                          alert("Failed to delete memory: " + err.message);
                        }
                      }
                    }}
                    className="w-full py-4 border border-red-500/20 text-red-400 rounded-2xl hover:bg-red-500/10 transition-all flex items-center justify-center gap-2 text-sm font-bold active:scale-95"
                  >
                    <Trash2 className="w-5 h-5" />
                    Remove from Library
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Upload Modal */}
      <Modal isOpen={isUploadOpen} onClose={() => setIsUploadOpen(false)} title="Upload Photos">
        <UploadForm 
          albums={albums} 
          onClose={() => setIsUploadOpen(false)} 
          defaultAlbumId={selectedAlbumId}
        />
      </Modal>

      {/* Create Album Modal */}
      <Modal isOpen={isCreateAlbumOpen} onClose={() => setIsCreateAlbumOpen(false)} title="Create New Album">
        <AlbumForm onClose={() => setIsCreateAlbumOpen(false)} />
      </Modal>
    </div>
  );
}

interface SidebarItemProps {
  icon: ReactNode;
  label: string;
  active: boolean;
  onClick: () => void;
  onDelete?: (e: MouseEvent) => void;
}

const SidebarItem: FC<SidebarItemProps> = ({ 
  icon, 
  label, 
  active, 
  onClick, 
  onDelete 
}) => {
  return (
    <div 
      onClick={onClick}
      className={`w-full group flex items-center justify-between px-4 py-3 rounded-xl transition-all duration-300 cursor-pointer ${
        active 
          ? 'bg-white/10 text-white shadow-[0_4px_12px_rgba(0,0,0,0.1)] border border-white/10' 
          : 'text-slate-400 hover:bg-white/5 hover:text-slate-200'
      }`}
    >
      <div className="flex items-center gap-3">
        <div className={`p-1.5 rounded-lg transition-colors ${active ? 'bg-indigo-500/20 text-indigo-400' : 'text-inherit'}`}>
          {icon}
        </div>
        <span className="text-sm font-bold tracking-tight">{label}</span>
      </div>
      {onDelete && (
        <button 
          onClick={(e) => {
            e.stopPropagation();
            onDelete(e);
          }}
          className="opacity-0 group-hover:opacity-100 p-1.5 hover:bg-red-500/20 hover:text-red-400 rounded-lg transition-all"
        >
          <Trash2 className="w-3 h-3" />
        </button>
      )}
    </div>
  );
};

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}

const Modal: FC<ModalProps> = ({ isOpen, onClose, title, children }) => {
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-slate-900/80 backdrop-blur-md" 
            onClick={onClose} 
          />
          <motion.div 
            initial={{ scale: 0.95, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 20 }}
            className="relative w-full max-w-md bg-slate-800 rounded-[2.5rem] border border-white/10 shadow-2xl overflow-hidden"
          >
            <div className="px-10 py-8 border-b border-white/5 flex items-center justify-between bg-white/[0.02]">
              <h3 className="text-xl font-bold tracking-tight">{title}</h3>
              <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-10 max-h-[75vh] overflow-y-auto custom-scrollbar">
              {children}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

function UploadForm({ albums, onClose, defaultAlbumId }: { albums: Album[], onClose: () => void, defaultAlbumId: string | null }) {
  const [url, setUrl] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [albumId, setAlbumId] = useState(defaultAlbumId || '');
  const [submitting, setSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!url && files.length === 0) return;
    setSubmitting(true);
    
    try {
      if (files.length > 0) {
        const formData = new FormData();
        files.forEach(f => formData.append('files', f));
        
        const response = await fetch('/api/upload', {
          method: 'POST',
          body: formData,
        });
        
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ error: 'Upload failed' }));
          throw new Error(errorData.error || 'Upload failed');
        }
        const data = await response.json();
        const urls = data.urls as string[];

        // Create entries in Firestore for each photo
        await Promise.all(urls.map((u, i) => {
          const photoTitle = files.length === 1 ? (title || files[0].name) : files[i].name;
          return photoService.uploadPhoto(u, photoTitle, description, albumId || null);
        }));
      } else if (url) {
        await photoService.uploadPhoto(url, title || 'Untitled', description, albumId || null);
      }
      
      onClose();
    } catch (error: any) {
      console.error(error);
      alert(error instanceof Error ? error.message : 'Failed to upload memory. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const selectedFiles: File[] = Array.from(e.target.files);
      setFiles(selectedFiles);
      // Automatically set title if empty and only one file
      if (!title && selectedFiles.length === 1) {
        const name = selectedFiles[0].name.split('.')[0];
        setTitle(name.charAt(0).toUpperCase() + name.slice(1));
      }
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-4">
        <div 
          className="flex flex-col items-center justify-center border-2 border-dashed border-white/10 rounded-[2rem] p-8 hover:bg-white/[0.02] transition-colors cursor-pointer relative group" 
          onClick={() => document.getElementById('file-upload')?.click()}
        >
          <input 
            id="file-upload"
            type="file" 
            className="hidden" 
            accept="image/*"
            multiple
            onChange={handleFileChange}
          />
          {files.length > 0 ? (
            <div className="flex flex-col items-center">
              <div className="w-16 h-16 bg-indigo-500/20 rounded-2xl flex items-center justify-center text-indigo-400 mb-2">
                <ImageIcon className="w-8 h-8" />
              </div>
              <p className="text-sm font-bold text-white text-center">
                {files.length} {files.length === 1 ? 'file' : 'files'} selected
              </p>
              <div className="mt-2 max-h-32 overflow-y-auto w-full custom-scrollbar">
                {files.map((f, i) => (
                  <p key={i} className="text-[10px] text-slate-500 truncate text-center">{f.name}</p>
                ))}
              </div>
            </div>
          ) : (
            <>
              <div className="w-16 h-16 bg-white/5 rounded-2xl flex items-center justify-center text-slate-400 mb-4 group-hover:scale-110 transition-transform">
                <Upload className="w-8 h-8" />
              </div>
              <p className="text-sm font-bold text-white">Click to select photos</p>
              <p className="text-xs text-slate-500">From your device (multiple allowed)</p>
            </>
          )}
        </div>

        <div className="relative flex items-center py-2">
          <div className="flex-grow border-t border-white/5"></div>
          <span className="flex-shrink mx-4 text-[10px] uppercase font-bold text-slate-600">OR</span>
          <div className="flex-grow border-t border-white/5"></div>
        </div>

        <div className="space-y-2">
          <label className="text-[10px] uppercase tracking-[0.2em] font-bold text-slate-500 ml-1">Paste Image URL</label>
          <input 
            type="url" 
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            disabled={files.length > 0}
            placeholder="https://images.unsplash.com/..."
            className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500/50 transition-all font-medium disabled:opacity-50"
          />
        </div>
      </div>

      <div className="space-y-2">
        <label className="text-[10px] uppercase tracking-[0.2em] font-bold text-slate-500 ml-1">
          {files.length > 1 ? 'Common Description' : 'Title'}
        </label>
        {files.length <= 1 && (
          <input 
            required={!url && files.length === 0}
            type="text" 
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Give your memory a name"
            className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500/50 transition-all font-medium mb-4"
          />
        )}
      </div>
      <div className="space-y-2">
        <label className="text-[10px] uppercase tracking-[0.2em] font-bold text-slate-500 ml-1">Album</label>
        <div className="relative">
          <select 
            value={albumId}
            onChange={(e) => setAlbumId(e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500/50 transition-all font-medium appearance-none cursor-pointer"
          >
            <option value="" className="bg-slate-800">None</option>
            {albums.map(a => (
              <option key={a.id} value={a.id} className="bg-slate-800">{a.name}</option>
            ))}
          </select>
          <FolderOpen className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
        </div>
      </div>
      <div className="space-y-2">
        <label className="text-[10px] uppercase tracking-[0.2em] font-bold text-slate-500 ml-1">Description</label>
        <textarea 
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500/50 transition-all font-medium resize-none"
        />
      </div>
      <button 
        disabled={submitting}
        type="submit"
        className="w-full py-4 bg-indigo-500 text-white rounded-2xl font-bold hover:bg-indigo-400 transition-all flex items-center justify-center gap-2 disabled:opacity-50 shadow-lg shadow-indigo-500/20 active:scale-95"
      >
        {submitting ? 'Adding...' : 'Add memory'}
      </button>
    </form>
  );
}

function AlbumForm({ onClose }: { onClose: () => void }) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!name) return;
    setSubmitting(true);
    try {
      await photoService.createAlbum(name, description);
      onClose();
    } catch (error) {
      console.error(error);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-2">
        <label className="text-[10px] uppercase tracking-[0.2em] font-bold text-slate-500 ml-1">Album Name</label>
        <input 
          required
          type="text" 
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Summer 2024"
          className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500/50 transition-all font-medium"
        />
      </div>
      <div className="space-y-2">
        <label className="text-[10px] uppercase tracking-[0.2em] font-bold text-slate-500 ml-1">Description</label>
        <textarea 
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500/50 transition-all font-medium resize-none"
        />
      </div>
      <button 
        disabled={submitting}
        type="submit"
        className="w-full py-4 bg-indigo-500 text-white rounded-2xl font-bold hover:bg-indigo-400 transition-all flex items-center justify-center gap-2 disabled:opacity-50 shadow-lg shadow-indigo-500/20 active:scale-95"
      >
        {submitting ? 'Creating...' : 'Create Album'}
      </button>
    </form>
  );
}
