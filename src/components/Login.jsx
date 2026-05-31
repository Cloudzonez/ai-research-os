import { useState } from "react";
import { LogIn, UserPlus, AlertCircle } from "lucide-react";
import { useAuth } from "./AuthContext.jsx";

export default function Login({ t, locale, onLogin }) {
  const { login: authLogin, register: authRegister } = useAuth();
  const [mode, setMode] = useState("login"); // login | register
  const [email, setEmail] = useState("teacher@university.edu");
  const [password, setPassword] = useState("demo123456");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const isZh = locale === "zh";

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    if (!email || !password) {
      setError(isZh ? "请输入邮箱和密码" : "Email and password required");
      return;
    }
    if (mode === "register" && !name) {
      setError(isZh ? "请输入姓名" : "Name is required");
      return;
    }
    setLoading(true);
    try {
      let result;
      if (mode === "register") {
        result = await authRegister(email, password, name);
      } else {
        result = await authLogin(email, password);
      }
      onLogin(result.user, result.token);
    } catch (err) {
      setError(err.message || (isZh ? "认证失败" : "Authentication failed"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-white dark:bg-zinc-950">
      <div className="w-full max-w-sm mx-4">
        <div className="text-center mb-8">
          <div className="h-12 w-12 rounded-xl bg-emerald-500/20 flex items-center justify-center mx-auto mb-4">
            <div className="h-4 w-4 rounded-sm bg-emerald-500 rotate-45" />
          </div>
          <h1 className="text-xl font-semibold text-main">{t.product}</h1>
          <p className="text-sm text-muted mt-1">{isZh ? "高校 AI 科研操作系统" : "University AI Research OS"}</p>
        </div>

        <form onSubmit={handleSubmit} className="surface p-6 space-y-4">
          <div className="flex rounded-lg bg-gray-100 dark:bg-white/5 p-0.5">
            <button
              type="button"
              className={`flex-1 py-2 text-xs font-medium rounded-md transition-colors ${
                mode === "login" ? "bg-white dark:bg-zinc-800 text-main shadow-sm" : "text-muted hover:text-dull"
              }`}
              onClick={() => setMode("login")}
            >
              <LogIn className="h-3.5 w-3.5 inline mr-1.5" />
              {isZh ? "登录" : "Login"}
            </button>
            <button
              type="button"
              className={`flex-1 py-2 text-xs font-medium rounded-md transition-colors ${
                mode === "register" ? "bg-white dark:bg-zinc-800 text-main shadow-sm" : "text-muted hover:text-dull"
              }`}
              onClick={() => setMode("register")}
            >
              <UserPlus className="h-3.5 w-3.5 inline mr-1.5" />
              {isZh ? "注册" : "Register"}
            </button>
          </div>

          {mode === "register" && (
            <div>
              <label className="text-[11px] font-medium text-muted uppercase tracking-wider">
                {isZh ? "姓名" : "Name"}
              </label>
              <input
                className="input mt-1"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                aria-label={isZh ? "姓名" : "Name"}
                placeholder={isZh ? "您的姓名" : "Your name"}
                autoComplete="name"
              />
            </div>
          )}

          <div>
            <label className="text-[11px] font-medium text-muted uppercase tracking-wider">Email</label>
            <input
              className="input mt-1"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              aria-label="Email"
              placeholder="teacher@university.edu"
              autoComplete="email"
            />
          </div>

          <div>
            <label className="text-[11px] font-medium text-muted uppercase tracking-wider">
              {isZh ? "密码" : "Password"}
            </label>
            <input
              className="input mt-1"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              aria-label={isZh ? "密码" : "Password"}
              placeholder="········"
              autoComplete={mode === "register" ? "new-password" : "current-password"}
            />
          </div>

          {error && (
            <div className="flex items-center gap-2 text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-500/10 rounded-lg px-3 py-2">
              <AlertCircle className="h-3.5 w-3.5 shrink-0" />
              {error}
            </div>
          )}

          <button className="btn-primary w-full" type="submit" disabled={loading}>
            {loading ? (
              <div className="h-4 w-4 rounded-full border-2 border-white border-t-transparent animate-spin mx-auto" />
            ) : mode === "register" ? (
              isZh ? "创建账号" : "Create account"
            ) : (
              isZh ? "登录" : "Sign in"
            )}
          </button>
        </form>

        <p className="text-[11px] text-muted text-center mt-4">
          {isZh ? "使用学校邮箱注册 · 院系共享默认开启" : "Register with university email · School sharing by default"}
        </p>
      </div>
    </div>
  );
}
