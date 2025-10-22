import { User } from '../types';
import { LoginCredentials, SignUpData } from '../components/AuthModal';

// --- This service simulates a backend API for authentication ---
// In a real application, these functions would make network requests (e.g., using fetch)
// to a secure backend server that interacts with a database. For this project,
// we use localStorage to persist user data and simulate asynchronous API calls.

const ALL_USERS_KEY = 'nexus_all_users';
const CURRENT_USER_KEY = 'nexus_current_user';

// In a real app, this would be a secure, server-side user object.
// Here we include the password hash for local simulation.
interface StoredUser extends User {
    passwordHash: string;
}

const getUsers = (): StoredUser[] => {
    try {
        const users = localStorage.getItem(ALL_USERS_KEY);
        return users ? JSON.parse(users) : [];
    } catch (error) {
        console.error("Failed to parse users from localStorage", error);
        return [];
    }
};

const saveUsers = (users: StoredUser[]): void => {
    localStorage.setItem(ALL_USERS_KEY, JSON.stringify(users));
};

// Simulates a network delay for API calls
const fakeApiCall = (delay = 500) => new Promise(res => setTimeout(res, delay));


/**
 * Checks for an active user session.
 * In a real app, this would hit an endpoint like `/api/session` to verify a session cookie.
 * @returns A Promise that resolves to the User object or null if not logged in.
 */
export const checkSession = async (): Promise<User | null> => {
    await fakeApiCall(100); // Simulate initial session check latency
    try {
        const user = localStorage.getItem(CURRENT_USER_KEY);
        return user ? JSON.parse(user) : null;
    } catch (error) {
        console.error("Failed to parse current user from localStorage", error);
        return null;
    }
};

/**
 * Attempts to log in a user.
 * In a real app, this would POST credentials to `/api/login`.
 * @param credentials The user's login credentials.
 * @returns A Promise that resolves to the logged-in User object.
 */
export const login = async (credentials: LoginCredentials): Promise<User> => {
    await fakeApiCall();
    const users = getUsers();
    const foundUser = users.find(u => u.name.toLowerCase() === credentials.username.toLowerCase());
    
    if (!foundUser || foundUser.passwordHash !== credentials.password) {
        throw new Error("Invalid username or password.");
    }
    
    // Don't expose password hash to the rest of the app
    const { passwordHash, ...userToReturn } = foundUser;
    
    // Simulate creating a session
    localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(userToReturn));
    
    return userToReturn;
};

/**
 * Signs up a new user.
 * In a real app, this would POST user data (often as FormData) to `/api/signup`.
 * @param data The new user's sign-up data.
 * @returns A Promise that resolves to the newly created User object.
 */
export const signUp = async (data: SignUpData): Promise<User> => {
    await fakeApiCall();
    const users = getUsers();

    if (users.find(u => u.name.toLowerCase() === data.username.toLowerCase())) {
        throw new Error("Username already exists.");
    }
    
    const fileToBase64 = (file: File): Promise<string> => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = error => reject(error);
        });
    };

    const avatarUrl = data.avatar ? await fileToBase64(data.avatar) : `https://api.dicebear.com/8.x/bottts/svg?seed=${data.username}`;
    const bannerUrl = data.banner ? await fileToBase64(data.banner) : undefined;
    
    const newUser: StoredUser = {
      id: Date.now().toString(),
      name: data.username,
      passwordHash: data.password, // In a real app, the server would hash this securely!
      avatarUrl,
      bannerUrl,
      bio: `A new user exploring the digital nexus.`,
      joinDate: new Date().toISOString(),
    };

    saveUsers([...users, newUser]);
    
    const { passwordHash, ...userToReturn } = newUser;
    
    // Simulate creating a session after signup
    localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(userToReturn));

    return userToReturn;
};

/**
 * Logs out the current user.
 * In a real app, this would POST to `/api/logout` to invalidate the session cookie.
 * @returns A Promise that resolves when logout is complete.
 */
export const logout = async (): Promise<void> => {
    await fakeApiCall(200);
    localStorage.removeItem(CURRENT_USER_KEY);
};

/**
 * Simulates a password reset request.
 * In a real app, this would POST to `/api/request-reset` and the backend would handle sending an email.
 * For security, the API should always return a successful-looking response to prevent username enumeration.
 * @param username The username to reset password for.
 * @returns A promise that resolves when complete.
 */
export const requestPasswordReset = async (username: string): Promise<void> => {
    await fakeApiCall();
    const users = getUsers();
    const userExists = users.some(u => u.name.toLowerCase() === username.toLowerCase());
    console.log(`(Simulation) Password reset requested for ${username}. User exists: ${userExists}`);
    // No error is thrown, and no data is returned, to protect user privacy.
};
