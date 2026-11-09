import useAuthStore from "../store/authStore";

// The signed-in user, read from the auth store. Replaces the per-page
// `JSON.parse(localStorage.getItem("o2d-auth-storage")).state.user.role`, which threw
// when the key was missing and was copied into ~14 pages.
export default function useAuth() {
  const user = useAuthStore((s) => s.user);
  return {
    user,
    userName: user?.name || "",
    role: user?.role || "",
    isAdmin: user?.role === "admin",
    isEngineer: user?.role === "engineer",
  };
}
