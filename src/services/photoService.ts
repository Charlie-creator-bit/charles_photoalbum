import { 
  collection, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  query, 
  where, 
  onSnapshot,
  serverTimestamp,
  Timestamp,
  getDocFromServer,
  getDoc
} from 'firebase/firestore';
import { db, auth } from './firebase';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Permission Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export interface Photo {
  id: string;
  url: string; // This will be the base64 string
  title?: string;
  description?: string;
  albumId?: string | null;
  userId: string;
  createdAt: Timestamp;
  tags?: string[];
  isPublic?: boolean;
}

export interface Album {
  id: string;
  name: string;
  description?: string;
  userId: string;
  createdAt: Timestamp;
}

const PHOTOS_COL = 'photos';
const ALBUMS_COL = 'albums';

// Helper for image compression
const compressImage = async (file: File, maxDimension: number = 1600, maxSizeBytes: number = 1048487): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxDimension) {
            height *= maxDimension / width;
            width = maxDimension;
          }
        } else {
          if (height > maxDimension) {
            width *= maxDimension / height;
            height = maxDimension;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return reject(new Error('Failed to get canvas context'));

        let quality = 0.9;
        let base64 = '';

        const attemptCompression = () => {
          ctx.clearRect(0, 0, width, height);
          ctx.drawImage(img, 0, 0, width, height);
          base64 = canvas.toDataURL('image/jpeg', quality);

          // Approximate byte size check
          const sizeInBytes = Math.floor((base64.length * 3) / 4);

          if (sizeInBytes > maxSizeBytes && quality > 0.1) {
            quality -= 0.1;
            attemptCompression();
          } else {
            resolve(base64);
          }
        };

        attemptCompression();
      };
      img.onerror = () => reject(new Error('Failed to load image'));
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
  });
};

export const photoService = {
  getPhotos: (albumId: string | null, callback: (photos: Photo[]) => void) => {
    if (!auth.currentUser) return () => {};
    
    // Always filter by userId
    let q = query(
      collection(db, PHOTOS_COL),
      where('userId', '==', auth.currentUser.uid)
    );

    // If albumId is provided, filter by it too
    if (albumId) {
      q = query(q, where('albumId', '==', albumId));
    }

    // Subscribe to changes
    return onSnapshot(q, (snapshot) => {
      const photos = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Photo));
      
      // Perform sorting in-memory to avoid requiring a composite index in Firestore
      photos.sort((a, b) => {
        const timeA = a.createdAt?.toMillis() || 0;
        const timeB = b.createdAt?.toMillis() || 0;
        return timeB - timeA; // Descending
      });
      
      callback(photos);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, PHOTOS_COL);
    });
  },

  getAlbums: (callback: (albums: Album[]) => void) => {
    if (!auth.currentUser) return () => {};

    const q = query(
      collection(db, ALBUMS_COL),
      where('userId', '==', auth.currentUser.uid)
    );

    return onSnapshot(q, (snapshot) => {
      const albums = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Album));
      
      // In-memory sort
      albums.sort((a, b) => {
        const timeA = a.createdAt?.toMillis() || 0;
        const timeB = b.createdAt?.toMillis() || 0;
        return timeB - timeA;
      });
      
      callback(albums);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, ALBUMS_COL);
    });
  },

  createAlbum: async (name: string, description: string = '') => {
    if (!auth.currentUser) throw new Error('Not authenticated');
    try {
      const docRef = await addDoc(collection(db, ALBUMS_COL), {
        name,
        description,
        userId: auth.currentUser.uid,
        createdAt: serverTimestamp()
      });
      return docRef.id;
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, ALBUMS_COL);
    }
  },

  uploadFile: async (file: File): Promise<string> => {
    if (!auth.currentUser) throw new Error('Not authenticated');
    
    if (file.size > 4 * 1024 * 1024) {
      throw new Error('File size exceeds the 4MB limit for initial upload');
    }

    return await compressImage(file);
  },

  uploadPhoto: async (url: string, title: string = '', description: string = '', albumId: string | null = null) => {
    if (!auth.currentUser) throw new Error('Not authenticated');
    
    // Security check: Verify album belongs to user if albumId is provided
    if (albumId) {
      try {
        const albumDoc = await getDoc(doc(db, ALBUMS_COL, albumId));
        if (!albumDoc.exists() || albumDoc.data()?.userId !== auth.currentUser.uid) {
          throw new Error('Permission denied: You do not own this album.');
        }
      } catch (err) {
        handleFirestoreError(err, OperationType.GET, `${ALBUMS_COL}/${albumId}`);
      }
    }

    try {
      const docRef = await addDoc(collection(db, PHOTOS_COL), {
        url,
        title,
        description,
        albumId,
        userId: auth.currentUser.uid,
        createdAt: serverTimestamp(),
        tags: [],
        isPublic: false
      });
      return docRef.id;
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, PHOTOS_COL);
    }
  },

  updatePhoto: async (photoId: string, updates: Partial<Pick<Photo, 'title' | 'description' | 'albumId' | 'tags' | 'isPublic'>>) => {
    try {
      const docRef = doc(db, PHOTOS_COL, photoId);
      await updateDoc(docRef, updates);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `${PHOTOS_COL}/${photoId}`);
    }
  },

  deletePhoto: async (photo: Photo) => {
    try {
      // Photo is now entirely in Firestore, no external files to delete.
      const docRef = doc(db, PHOTOS_COL, photo.id);
      await deleteDoc(docRef);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `${PHOTOS_COL}/${photo.id}`);
    }
  },

  deleteAlbum: async (albumId: string) => {
    try {
      const docRef = doc(db, ALBUMS_COL, albumId);
      await deleteDoc(docRef);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `${ALBUMS_COL}/${albumId}`);
    }
  },

  getPhotoById: async (photoId: string): Promise<Photo | null> => {
    try {
      const docRef = doc(db, PHOTOS_COL, photoId);
      const docSnap = await getDocFromServer(docRef);
      if (docSnap.exists()) {
        return { id: docSnap.id, ...docSnap.data() } as Photo;
      }
      return null;
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, `${PHOTOS_COL}/${photoId}`);
      return null;
    }
  },

  deleteAllPhotos: async (photos: Photo[]) => {
    return Promise.all(photos.map(p => photoService.deletePhoto(p)));
  }
};
