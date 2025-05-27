import { onAuthStateChanged, User } from 'firebase/auth';
import { auth } from '../../firebaseConfig'; // Assuming firebaseConfig.ts is in src

class FirebaseAuthService {
  private static instance: FirebaseAuthService;

  private constructor() {}

  public static getInstance(): FirebaseAuthService {
    if (!FirebaseAuthService.instance) {
      FirebaseAuthService.instance = new FirebaseAuthService();
    }
    return FirebaseAuthService.instance;
  }

  public onAuthStateChangedListener(callback: (user: User | null) => void): () => void {
    // This function returns the unsubscribe function from onAuthStateChanged
    return onAuthStateChanged(auth, callback);
  }

  // We will add login, logout, signup methods here later
  // For example:
  // async signInWithGoogle(): Promise<UserCredential> { ... }
  // async signOutUser(): Promise<void> { ... }
}

export const firebaseAuthService = FirebaseAuthService.getInstance(); 