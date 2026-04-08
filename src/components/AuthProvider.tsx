"use client";

import React, { createContext, useContext, useState, useCallback } from "react";
import { Staff } from "@/lib/types";

interface AuthContextType {
  isAuthenticated: boolean;
  currentStaff: Staff | null;
  login: (staff: Staff) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType>({
  isAuthenticated: false,
  currentStaff: null,
  login: () => {},
  logout: () => {},
});

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentStaff, setCurrentStaff] = useState<Staff | null>(null);

  const login = useCallback((staff: Staff) => {
    setIsAuthenticated(true);
    setCurrentStaff(staff);
  }, []);

  const logout = useCallback(() => {
    setIsAuthenticated(false);
    setCurrentStaff(null);
  }, []);

  return (
    <AuthContext.Provider value={{ isAuthenticated, currentStaff, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}
