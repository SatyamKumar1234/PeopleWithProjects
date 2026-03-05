'use client';
import { createContext, useContext, useEffect, useState } from 'react';
import {
    onAuthStateChanged,
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    signOut,
    signInWithPopup,
    GoogleAuthProvider,
    sendPasswordResetEmail,
    updateProfile
} from 'firebase/auth';
import { doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import { HoneypotProvider } from '@/lib/honeypot';

const AuthContext = createContext({});

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
            console.log('Auth state changed:', firebaseUser ? `User: ${firebaseUser.uid}` : 'No user');
            try {
                if (firebaseUser) {
                    const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
                    const userData = userDoc.exists() ? userDoc.data() : {};

                    setUser({
                        uid: firebaseUser.uid,
                        email: firebaseUser.email,
                        displayName: firebaseUser.displayName || userData.displayName || '',
                        photoURL: firebaseUser.photoURL || userData.photoURL || '',
                        ...userData
                    });
                } else {
                    setUser(null);
                }
            } catch (err) {
                console.error('Error fetching user profile from Firestore:', err);
                // Even if Firestore fails, we have the Auth user
                if (firebaseUser) {
                    setUser({
                        uid: firebaseUser.uid,
                        email: firebaseUser.email,
                        displayName: firebaseUser.displayName || '',
                        photoURL: firebaseUser.photoURL || '',
                    });
                }
            }
            setLoading(false);
        });
        return () => unsubscribe();
    }, []);

    const login = async (email, password) => {
        console.log('Attempting login...');
        const result = await signInWithEmailAndPassword(auth, email, password);
        return result;
    };

    const signup = async (email, password, displayName) => {
        console.log('Attempting signup...');
        const result = await createUserWithEmailAndPassword(auth, email, password);
        console.log('Auth user created. Updating profile and Firestore...');

        await updateProfile(result.user, { displayName });

        try {
            await setDoc(doc(db, 'users', result.user.uid), {
                displayName,
                email,
                photoURL: '',
                createdAt: serverTimestamp(),
                projectIds: []
            });
            console.log('Firestore user profile created successfully.');
        } catch (err) {
            console.error('FAILED to create Firestore user profile:', err);
            // We don't throw here so the user can still proceed as an authenticated user
            // but the dashboard might be empty until Firestore rules/service is fixed.
        }

        return result;
    };

    const loginWithGoogle = async () => {
        console.log('Attempting Google login...');
        const provider = new GoogleAuthProvider();
        const result = await signInWithPopup(auth, provider);

        try {
            const userDoc = await getDoc(doc(db, 'users', result.user.uid));
            if (!userDoc.exists()) {
                await setDoc(doc(db, 'users', result.user.uid), {
                    displayName: result.user.displayName,
                    email: result.user.email,
                    photoURL: result.user.photoURL,
                    createdAt: serverTimestamp(),
                    projectIds: []
                });
            }
        } catch (err) {
            console.error('Google login: Firestore profile sync failed:', err);
        }

        return result;
    };

    const logout = async () => {
        await signOut(auth);
    };

    const resetPassword = async (email) => {
        await sendPasswordResetEmail(auth, email);
    };

    return (
        <AuthContext.Provider value={{ user, loading, login, signup, loginWithGoogle, logout, resetPassword }}>
            <HoneypotProvider db={db}>
                {children}
            </HoneypotProvider>
        </AuthContext.Provider>
    );
}

export const useAuth = () => useContext(AuthContext);
