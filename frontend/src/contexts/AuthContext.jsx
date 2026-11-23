import React, { createContext, useContext, useState, useEffect } from 'react';
import { authService } from '../services/authService';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const storedUser = authService.getUserFromStorage();
    if (storedUser && authService.isAuthenticated()) {
      setUser(storedUser);
    }
    setLoading(false);
  }, []);

  const login = async (email, password) => {
    const loggedUser = await authService.login(email, password);
    setUser(loggedUser);
    return loggedUser;
  };

  const logout = () => {
    authService.logout();
    setUser(null);
  };

  const value = {
    user,
    role: user?.role,
    isDoctor: user?.role === 'MEDECIN',
    isReceptionist: user?.role === 'AGENT',
    isDirector: user?.role === 'DIRECTEUR' || user?.is_director,
    isAdmin: user?.role === 'ADMIN' || user?.is_admin,
    loading,
    login,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth doit être utilisé à l\'intérieur d\'un AuthProvider');
  }
  return context;
};
