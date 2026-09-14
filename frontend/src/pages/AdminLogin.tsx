import { useState } from "react";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:3000/api";

type Admin = {
  admin_id: number;
  name: string;
  email: string;
  role: string;
};

type AdminLoginProps = {
  onLogin: (
    token: string,
    adminData: Admin
  ) => void;
  loginPath?: string;
  portalTitle?: string;
};

export default function AdminLogin({
  onLogin,
  loginPath = "/auth/login",
  portalTitle = "Admin Portal",
}: AdminLoginProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] =
    useState("");

  const [loading, setLoading] =
    useState(false);

  const [error, setError] =
    useState("");

  async function handleSubmit(
    event: React.FormEvent
  ) {
    event.preventDefault();

    setError("");

    if (!email.trim()) {
      setError("Please enter your email.");
      return;
    }

    if (!password) {
      setError("Please enter your password.");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(
        `${API_BASE_URL}${loginPath}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            email: email.trim(),
            password,
          }),
        }
      );

      let data: { message?: string; token?: string; admin?: Admin } = {};

      try {
        data = await response.json();
      } catch {
        data = {};
      }

      if (!response.ok) {
        throw new Error(
          data.message ||
            "Invalid administrator credentials."
        );
      }

      if (!data.token) {
        throw new Error(
          "Login succeeded but no authentication token was returned."
        );
      }

      if (!data.admin) {
        throw new Error(
          "Login succeeded but administrator information was not returned."
        );
      }

      onLogin(
        data.token,
        data.admin
      );
    } catch (err) {
      const message =
        err instanceof TypeError && err.message === "Failed to fetch"
          ? "Unable to reach the admin API. Start the backend and make sure MySQL is running before trying again."
          : err instanceof Error
            ? err.message
            : "Unable to sign in.";

      setError(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="app">
      <header className="hero">
        <div>
          <p className="eyebrow">
            Jaramogi Oginga Odinga
            University of Science and
            Technology
          </p>

          <h1>
            {portalTitle}
          </h1>

          <p className="subtitle">
            Secure administration for
            JOOUST elections.
          </p>
        </div>
      </header>

      <section className="container">
        <div className="card login-card">
          <h2>
            Administrator Sign In
          </h2>

          <p>
            Sign in with your administrator
            account to manage elections,
            candidates, and results.
          </p>

          <form
            onSubmit={handleSubmit}
          >
            <label>
              Email

              <input
                type="email"
                value={email}
                onChange={(event) =>
                  setEmail(
                    event.target.value
                  )
                }
                placeholder="admin@example.com"
                autoComplete="username"
                disabled={loading}
              />
            </label>

            <label>
              Password

              <input
                type="password"
                value={password}
                onChange={(event) =>
                  setPassword(
                    event.target.value
                  )
                }
                placeholder="Enter your password"
                autoComplete="current-password"
                disabled={loading}
              />
            </label>

            <button
              type="submit"
              disabled={loading}
            >
              {loading
                ? "Signing in..."
                : "Sign in"}
            </button>
          </form>

          {error && (
            <div className="message error">
              {error}
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
