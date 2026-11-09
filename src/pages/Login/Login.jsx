import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { User, Lock, Eye, EyeOff, Loader2Icon } from "lucide-react";
import useAuthStore from "../../store/authStore";
import toast from "react-hot-toast";
import { landingPath } from "../../config/navigation";

const Login = () => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const login = useAuthStore((state) => state.login);
  const [loading, setLoading] = useState(false);

  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();

    setLoading(true);
    const success = await login(username, password);
    setLoading(false);

    if (success) {
      const user = useAuthStore.getState().user;
      toast.success(`Welcome back, ${user.name}!`);

        localStorage.setItem('currentUsername', user.username);

      // First page in menu order the user was given (admin -> Dashboard).
      navigate(landingPath(user), { replace: true });
    } else {
      toast.error("Invalid credentials");
    }
  };

  const togglePasswordVisibility = () => {
    setShowPassword(!showPassword);
  };

  return (
    <div className="relative min-h-screen flex flex-col items-center justify-center p-4 overflow-hidden bg-gradient-to-br from-sky-100 via-white to-green-100">
      {/* Decorative background blobs, colored to match the logo (blue gear + green bars) */}
      <div className="pointer-events-none absolute -top-32 -left-32 h-96 w-96 rounded-full bg-sky-300/40 blur-3xl" />
      <div className="pointer-events-none absolute top-1/3 -right-32 h-96 w-96 rounded-full bg-lime-300/40 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-32 left-1/3 h-96 w-96 rounded-full bg-sky-200/40 blur-3xl" />

      <div className="relative z-10 max-w-md w-full">
        <div className="space-y-6 bg-white/70 backdrop-blur-xl p-8 sm:p-10 rounded-2xl shadow-2xl border border-white/60">
          <div className="text-center">
            <div className="flex justify-center">
              <div className="relative">
                <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-sky-400 to-lime-400 blur-lg opacity-40" />
                <div className="relative h-20 w-20 bg-white rounded-2xl flex items-center justify-center shadow-lg ring-1 ring-slate-200 p-3">
                  <img src="/divine-logo.svg" alt="Divine" className="h-full w-full object-contain" />
                </div>
              </div>
            </div>
            <h2 className="mt-6 text-2xl sm:text-3xl font-bold text-slate-800 tracking-tight">
              Service Support System
            </h2>
            <p className="mt-2 text-sm text-slate-500">
              Sign in to continue to your dashboard
            </p>
          </div>

          <form className="space-y-5" onSubmit={handleSubmit}>
            <div className="space-y-4">
              <div>
                <label htmlFor="username" className="sr-only">
                  Username
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                    <User className="h-4.5 w-4.5 text-slate-400" />
                  </div>
                  <input
                    id="username"
                    name="username"
                    type="text"
                    required
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="block w-full pl-10 pr-3 py-2.5 bg-white border border-slate-200 placeholder-slate-400 text-slate-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent transition-all sm:text-sm"
                    placeholder="Username"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="password" className="sr-only">
                  Password
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                    <Lock className="h-4.5 w-4.5 text-slate-400" />
                  </div>
                  <input
                    id="password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="block w-full pl-10 pr-11 py-2.5 bg-white border border-slate-200 placeholder-slate-400 text-slate-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent transition-all sm:text-sm"
                    placeholder="Password"
                  />
                  <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center">
                    <button
                      type="button"
                      onClick={togglePasswordVisibility}
                      className="text-slate-400 hover:text-slate-600 transition-colors focus:outline-none"
                    >
                      {showPassword ? (
                        <EyeOff className="h-4.5 w-4.5" />
                      ) : (
                        <Eye className="h-4.5 w-4.5" />
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg text-sm font-semibold text-white bg-blue-800 hover:bg-blue-900 shadow-lg shadow-blue-800/20 transition-all duration-200 hover:shadow-xl focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-800 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {loading && <Loader2Icon className="animate-spin h-4 w-4" />}
              Sign in
            </button>
          </form>
        </div>

        {/* Footer */}
        <div className="mt-8 text-center text-sm text-slate-500">
          Powered by <strong className="text-slate-700">Botivate</strong>
        </div>
      </div>
    </div>
  );
};

export default Login;
