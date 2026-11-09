import { create } from "zustand";
import { persist } from "zustand/middleware";
import { supabase } from "../lib/supabase/client";
import { clearColumnPrefs } from "../lib/columnPrefs";
import { clearSessionFilters } from "../lib/sessionFilters";

const useAuthStore = create(
  persist(
    (set, get) => ({
      isAuthenticated: false,
      user: null,
      isLoading: false,

      login: async (username, password) => {
        set({ isLoading: true });

        try {
          const { data, error } = await supabase.rpc("sss_login", {
            p_username: username,
            p_password: password,
          });

          if (error) throw error;

          const row = Array.isArray(data) ? data[0] : data;

          if (!row) {
            set({ isLoading: false });
            return false;
          }

          localStorage.setItem("currentUsername", row.full_name);

          set({
            isAuthenticated: true,
            user: {
              id: row.uuid,
              username: row.full_name,
              name: row.full_name,
              role: row.role,
              page: row.page || [],
            },
            isLoading: false,
          });
          return true;
        } catch (error) {
          console.error("Login error:", error);
          set({ isLoading: false });
          return false;
        }
      },

      logout: () => {
        clearColumnPrefs();
        clearSessionFilters();
        set({
          isAuthenticated: false,
          user: null,
          isLoading: false,
        });
      },

      // Get current user info
      getCurrentUser: () => {
        return get().user;
      },

      // Check if user has specific role
      hasRole: (role) => {
        const user = get().user;
        return user && user.role === role;
      },

      // Check if user is admin
      isAdmin: () => {
        const user = get().user;
        return user && user.role === "admin";
      },

      // Check if user is engineer
      isEngineer: () => {
        const user = get().user;
        return user && user.role === "engineer";
      },
    }),
    {
      name: "o2d-auth-storage",
      // Only persist authentication state, not loading state
      partialize: (state) => ({
        isAuthenticated: state.isAuthenticated,
        user: state.user,
      }),
    }
  )
);

export default useAuthStore;
