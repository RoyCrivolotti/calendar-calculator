import { 
  onAuthStateChanged, 
  User, 
  GoogleAuthProvider, 
  signInWithPopup,
  signOut,
  UserCredential
} from 'firebase/auth';
import { auth } from '../../firebaseConfig'; // Assuming firebaseConfig.ts is in src

class FirebaseAuthService {
  private static instance: FirebaseAuthService;
  private googleProvider: GoogleAuthProvider;

  private constructor() {
    this.googleProvider = new GoogleAuthProvider();
    // Example: Forcing account selection on every Google sign-in
    // this.googleProvider.setCustomParameters({ prompt: 'select_account' }); 
  }

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

  public async signInWithGooglePopup(): Promise<UserCredential> {
    try {
      const result = await signInWithPopup(auth, this.googleProvider);
      // const credential = GoogleAuthProvider.credentialFromResult(result);
      // const token = credential?.accessToken;
      // const user = result.user;
      // You can access user details here if needed immediately after sign-in
      return result;
    } catch (error) {
      // Handle Errors here.
      // const errorCode = error.code;
      // const errorMessage = error.message;
      // The email of the user's account used.
      // const email = error.customData.email;
      // The AuthCredential type that was used.
      // const credential = GoogleAuthProvider.credentialFromError(error);
      console.error("Error during Google sign-in popup:", error);
      throw error; // Re-throw to be handled by the caller
    }
  }

  public async signOutUser(): Promise<void> {
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Error signing out:", error);
      throw error; // Re-throw to be handled by the caller
    }
  }

  // We will add login, logout, signup methods here later
  // For example:
  // async signInWithGoogle(): Promise<UserCredential> { ... }
  // async signOutUser(): Promise<void> { ... }
}

export const firebaseAuthService = FirebaseAuthService.getInstance(); 