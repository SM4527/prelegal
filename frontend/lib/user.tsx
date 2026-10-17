"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { auth, type User } from "./api";

/** The signed-in user, null when signed out, undefined while still checking. */
type UserState = User | null | undefined;

const UserContext = createContext<UserState>(null);

/** Asks the backend once per page load who is signed in, for every component below. */
export function UserProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserState>(undefined);

  useEffect(() => {
    auth.me().then(setUser, () => setUser(null));
  }, []);

  return <UserContext.Provider value={user}>{children}</UserContext.Provider>;
}

export const useUser = () => useContext(UserContext);
