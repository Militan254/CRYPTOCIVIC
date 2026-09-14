import { useEffect, useRef, useState } from "react";
import "./App.css";

import AdminLogin from "./pages/AdminLogin";
import AdminDashboard from "./pages/AdminDashboard";
import CandidateApplication from "./pages/CandidateApplication";

type Election = {
  election_id: number;
  title: string;
  position: string;
  election_scope: "SCHOOL" | "UNIVERSITY";
  school_id: number | null;
  school_name: string | null;
  start_time: string;
  end_time: string;
  status: "UPCOMING" | "ACTIVE" | "CLOSED";
  has_voted?: boolean;
};

type Candidate = {
  candidate_id: number;
  name: string;
  manifesto: string | null;
  photo: string | null;
};

type ElectionResults = {
  candidate_id: number;
  name: string;
  manifesto: string | null;
  photo: string | null;
  votes: number;
  percentage: number;
};

type Admin = {
  admin_id: number;
  name: string;
  email: string;
  role: string;
};

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:3000/api";

function getStoredAdminToken(): string | null {
  const token = localStorage.getItem("jooust_admin_token");

  if (!token) {
    return null;
  }

  try {
    const payload = JSON.parse(atob(token.split(".")[1])) as {
      exp?: number;
    };

    if (payload.exp && payload.exp * 1000 <= Date.now()) {
      localStorage.removeItem("jooust_admin_token");
      localStorage.removeItem("jooust_admin");
      return null;
    }
  } catch {
    localStorage.removeItem("jooust_admin_token");
    localStorage.removeItem("jooust_admin");
    return null;
  }

  return token;
}

function App() {
  const isAdminRoute =
    new URLSearchParams(window.location.search).has("admin");
  const isSuperAdminRoute = window.location.pathname === "/super-admin";

  const [adminToken, setAdminToken] =
    useState<string | null>(() =>
      localStorage.getItem(isSuperAdminRoute ? "jooust_super_admin_token" : "jooust_admin_token") ||
      (isSuperAdminRoute ? null : getStoredAdminToken())
    );

  const [admin, setAdmin] = useState<Admin | null>(() => {
    const saved = localStorage.getItem("jooust_admin");

    if (!saved) {
      return null;
    }

    try {
      return JSON.parse(saved);
    } catch {
      return null;
    }
  });

  function handleAdminLogin(
    token: string,
    adminData: Admin
  ) {
    localStorage.setItem(
      isSuperAdminRoute ? "jooust_super_admin_token" : "jooust_admin_token",
      token
    );

    localStorage.setItem(
      "jooust_admin",
      JSON.stringify(adminData)
    );

    setAdminToken(token);
    setAdmin(adminData);
  }

  function handleAdminLogout() {
    localStorage.removeItem(
      isSuperAdminRoute ? "jooust_super_admin_token" : "jooust_admin_token"
    );

    localStorage.removeItem(
      "jooust_admin"
    );

    setAdminToken(null);
    setAdmin(null);
  }

  if (window.location.pathname === "/apply") {
    return <CandidateApplication />;
  }

  if (isAdminRoute || isSuperAdminRoute) {
    if (!adminToken) {
      return (
        <AdminLogin
          onLogin={handleAdminLogin}
          loginPath={isSuperAdminRoute ? "/auth/super-admin/login" : "/auth/login"}
          portalTitle={isSuperAdminRoute ? "Super Administrator Portal" : "Admin Portal"}
        />
      );
    }

    return (
      <div>
        <div className="admin-topbar">
          <div>
            <strong>{admin?.name || "Administrator"}</strong>
            <span>{admin?.role || "ADMIN"}</span>
          </div>

          <button className="secondary-button" onClick={handleAdminLogout}>
            Sign out
          </button>
        </div>

        <AdminDashboard accessToken={adminToken} adminRole={admin?.role || "ADMIN"} />
      </div>
    );
  }

  return <VoterPortal />;
}

function VoterPortal() {
  const [registrationNumber, setRegistrationNumber] = useState("");
  const [password, setPassword] = useState("");
  const [voterToken, setVoterToken] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [verificationPending, setVerificationPending] = useState(false);
  const [passwordResetMode, setPasswordResetMode] = useState(false);
  const [resetIdentifier, setResetIdentifier] = useState("");
  const [resetCode, setResetCode] = useState("");
  const [resetPassword, setResetPassword] = useState("");
  const [resetConfirmation, setResetConfirmation] = useState("");
  const [studentName, setStudentName] = useState("");
  const [studentId, setStudentId] = useState<number | null>(null);
  const [elections, setElections] = useState<Election[]>([]);
  const [selectedElection, setSelectedElection] = useState<Election | null>(null);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [results, setResults] = useState<ElectionResults[]>([]);
  const [totalVotes, setTotalVotes] = useState(0);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [now, setNow] = useState<number>(0);
  const votingSectionRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (selectedElection && votingSectionRef.current) {
      votingSectionRef.current.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }
  }, [selectedElection]);

  async function findElections() {
    const registration = registrationNumber.trim();
    const voterPassword = password.trim();

    if (!registration) {
      setError("Please enter your registration number.");
      return;
    }

    if (!voterPassword) {
      setError("Please enter your password.");
      return;
    }

    setLoading(true);
    setError("");
    setMessage("");

    try {
      const loginResponse = await fetch(`${API_BASE_URL}/students/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          registration_number: registration,
          password: voterPassword,
        }),
      });

      const loginData = await loginResponse.json();

      if (!loginResponse.ok) {
        throw new Error(loginData.message || "Invalid registration number or password.");
      }

      if (loginData.requiresVerification) {
        setVerificationPending(true);
        setStudentName(loginData.student?.name || "Student");
        setMessage("A verification code has been sent to your registered university email.");
        return;
      }

      const response = await fetch(
        `${API_BASE_URL}/elections/eligible/${encodeURIComponent(registration)}`,
        {
          headers: {
            Authorization: `Bearer ${loginData.token}`,
          },
        }
      );
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Unable to retrieve elections.");
      }

      setStudentId(loginData.student?.student_id ?? data.student_id);
      setVoterToken(loginData.token);
      setStudentName(loginData.student?.name || "Student");
      setElections(data.elections || []);
      setSelectedElection(null);
      setCandidates([]);
      setResults([]);
      setTotalVotes(0);

      if (!data.elections || data.elections.length === 0) {
        setMessage("There are no elections currently available for you.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  async function completePasswordSetup(event: React.FormEvent) {
    event.preventDefault();

    if (newPassword.length < 8) {
      setError("Your new password must be at least 8 characters.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("The passwords do not match.");
      return;
    }

    setLoading(true);
    setError("");
    setMessage("");

    try {
      const response = await fetch(`${API_BASE_URL}/students/password-setup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          registration_number: registrationNumber.trim(),
          code: verificationCode.trim(),
          new_password: newPassword,
        }),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Unable to create your password.");
      }

      setVerificationPending(false);
      setPassword(newPassword);
      setVerificationCode("");
      setNewPassword("");
      setConfirmPassword("");
      setStudentId(data.student.student_id);
      setVoterToken(data.token);
      setStudentName(data.student.name);

      const electionsResponse = await fetch(
        `${API_BASE_URL}/elections/eligible/${encodeURIComponent(registrationNumber.trim())}`,
        {
          headers: {
            Authorization: `Bearer ${data.token}`,
          },
        }
      );
      const electionsData = await electionsResponse.json();

      if (!electionsResponse.ok) {
        throw new Error(electionsData.message || "Unable to retrieve elections.");
      }

      setElections(electionsData.elections || []);
      setMessage("Password created successfully. You are now signed in.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to create your password.");
    } finally {
      setLoading(false);
    }
  }

  async function resendVerificationCode() {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`${API_BASE_URL}/students/verification-code/resend`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ registration_number: registrationNumber.trim(), password: password.trim() }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Unable to resend verification code.");
      setMessage(data.message);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to resend verification code.");
    } finally {
      setLoading(false);
    }
  }

  async function requestPasswordReset() {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`${API_BASE_URL}/students/password-reset/request`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ registration_number: resetIdentifier.trim() }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Unable to request password reset.");
      setMessage(data.message);
      setPasswordResetMode(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to request password reset.");
    } finally {
      setLoading(false);
    }
  }

  async function completePasswordReset() {
    if (resetPassword.length < 8 || resetPassword !== resetConfirmation) {
      setError("Use a matching password of at least 8 characters.");
      return;
    }

    setLoading(true);
    setError("");
    try {
      const response = await fetch(`${API_BASE_URL}/students/password-reset/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ registration_number: resetIdentifier.trim(), code: resetCode.trim(), new_password: resetPassword }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Unable to reset password.");
      setPasswordResetMode(false);
      setResetCode("");
      setResetPassword("");
      setResetConfirmation("");
      setMessage("Password reset successfully. You can now sign in.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to reset password.");
    } finally {
      setLoading(false);
    }
  }

  async function selectElection(election: Election) {
    setSelectedElection(election);
    setError("");
    setMessage("");
    setResults([]);
    setTotalVotes(0);

    try {
      const response = await fetch(`${API_BASE_URL}/candidates/${election.election_id}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Unable to retrieve candidates.");
      }

      setCandidates(data.candidates || []);
      await loadResults(election.election_id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load election.");
    }
  }

  async function loadResults(electionId: number) {
    try {
      const response = await fetch(`${API_BASE_URL}/results/${electionId}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Unable to retrieve results.");
      }

      setResults(data.results || []);
      setTotalVotes(data.total_votes || 0);
    } catch (err) {
      console.error("Results loading error:", err);
    }
  }

  async function castVote(candidateId: number) {
    if (!selectedElection || !registrationNumber.trim()) {
      return;
    }

    const confirmed = window.confirm(
      "Are you sure you want to cast this vote? You will not be able to vote again in this election."
    );

    if (!confirmed) {
      return;
    }

    setLoading(true);
    setError("");
    setMessage("");

    try {
      const response = await fetch(`${API_BASE_URL}/votes`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${voterToken}`,
        },
        body: JSON.stringify({
          election_id: selectedElection.election_id,
          candidate_id: candidateId,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Unable to cast vote.");
      }

      setMessage("Your vote has been cast successfully.");

      setElections((current) =>
        current.map((election) =>
          election.election_id === selectedElection.election_id
            ? { ...election, has_voted: true }
            : election
        )
      );

      setSelectedElection((current) =>
        current ? { ...current, has_voted: true } : current
      );

      await loadResults(selectedElection.election_id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to cast vote.");
    } finally {
      setLoading(false);
    }
  }

  function resetStudent() {
    setStudentId(null);
    setElections([]);
    setSelectedElection(null);
    setCandidates([]);
    setResults([]);
    setTotalVotes(0);
    setRegistrationNumber("");
    setPassword("");
    setVoterToken("");
    setStudentName("");
    setMessage("");
    setError("");
  }

  return (
    <main className="app">
      <div className="site-video-wrap" aria-hidden="true">
        <video
          className="site-video"
          src="/BACKGROUND.mp4"
          autoPlay
          muted
          loop
          playsInline
          preload="auto"
        />
      </div>
      <header className="hero">
        <div className="hero-content">
          <h1>Blockchain Online Voting System</h1>
          <p className="subtitle">
            Cast your vote, track election time, and review verified results through a secure digital voting experience.
          </p>

          <p className="eyebrow">secure • transparent • digital</p>

          <div className="hero-actions">
            <a
              className="cta-link"
              href="/apply"
            >
              Apply for a position
            </a>
          </div>
        </div>
      </header>

      <section className="container">
        {!studentId && (
          <div className="card login-card">
            <h2>{verificationPending ? "Verify your identity" : "Access your elections"}</h2>
            <p>
              {verificationPending
                ? "Enter the verification code sent to your registered university email, then create a new password."
                : "Enter your student registration number and password to view your eligible elections."}
            </p>

            {!verificationPending ? <form
              onSubmit={(event) => {
                event.preventDefault();
                findElections();
              }}
            >
              <label>
                Registration number
                <input
                  value={registrationNumber}
                  onChange={(event) => setRegistrationNumber(event.target.value)}
                  placeholder="e.g. I132G1325824"
                  autoComplete="off"
                />
              </label>

              <label>
                Password
                <input
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Enter your password"
                  autoComplete="current-password"
                />
              </label>

              <button type="submit" disabled={loading}>
                {loading ? "Checking..." : "View my elections"}
              </button>
              <button className="text-button" type="button" onClick={() => setPasswordResetMode(true)}>
                Forgot password?
              </button>
            </form> : <form onSubmit={completePasswordSetup}>
              <label>
                Verification code
                <input
                  inputMode="numeric"
                  value={verificationCode}
                  onChange={(event) => setVerificationCode(event.target.value)}
                  placeholder="Enter the 6-digit code"
                  maxLength={6}
                  required
                />
              </label>

              <label>
                New password
                <input
                  type="password"
                  value={newPassword}
                  onChange={(event) => setNewPassword(event.target.value)}
                  placeholder="At least 8 characters"
                  autoComplete="new-password"
                  required
                />
              </label>

              <label>
                Confirm new password
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  placeholder="Repeat your new password"
                  autoComplete="new-password"
                  required
                />
              </label>

              <button type="submit" disabled={loading}>
                {loading ? "Creating password..." : "Create password"}
              </button>
              <button className="text-button" type="button" onClick={resendVerificationCode} disabled={loading}>
                Resend verification code
              </button>
            </form>}

            {passwordResetMode && (
              <div className="password-reset-panel">
                <h3>Reset password</h3>
                <label>
                  Registration number or university email
                  <input value={resetIdentifier} onChange={(event) => setResetIdentifier(event.target.value)} required />
                </label>
                <button className="secondary-button" type="button" onClick={requestPasswordReset} disabled={loading}>
                  Send reset code
                </button>
                <label>
                  Reset code
                  <input inputMode="numeric" maxLength={6} value={resetCode} onChange={(event) => setResetCode(event.target.value)} />
                </label>
                <label>
                  New password
                  <input type="password" value={resetPassword} onChange={(event) => setResetPassword(event.target.value)} />
                </label>
                <label>
                  Confirm new password
                  <input type="password" value={resetConfirmation} onChange={(event) => setResetConfirmation(event.target.value)} />
                </label>
                <button className="primary-button" type="button" onClick={completePasswordReset} disabled={loading}>
                  Reset password
                </button>
              </div>
            )}
          </div>
        )}

        {studentId && (
          <>
            <div className="student-bar">
              <div>
                <span>Signed in voter</span>
                <strong>{studentName || "Student"}</strong>
                <small>{registrationNumber}</small>
              </div>

              <button className="secondary-button" onClick={resetStudent}>
                Log out
              </button>
            </div>

            <div className="section-heading">
              <div>
                <p className="eyebrow">Elections</p>
                <h2>Choose an election</h2>
              </div>
            </div>

            <div className="election-grid">
              {elections.map((election) => (
                <button
                  key={election.election_id}
                  className={`election-card ${selectedElection?.election_id === election.election_id ? "selected" : ""}`}
                  onClick={() => selectElection(election)}
                >
                  <span className={`status ${election.status.toLowerCase()}`}>
                    {election.status}
                  </span>

                  <h3>{election.title}</h3>
                  <p>{election.position}</p>
                  <small>
                    {election.election_scope} • {election.school_name ?? "General"}
                  </small>

                  <div className="countdown-pill">
                    {formatCountdown(election.end_time, now)}
                  </div>
                </button>
              ))}
            </div>

            {selectedElection && (
              <section ref={votingSectionRef} className="voting-section">
                <div className="section-heading">
                  <div>
                    <p className="eyebrow">Selected election</p>
                    <h2>{selectedElection.title}</h2>
                    <p>{selectedElection.position}</p>
                  </div>

                  <div className="selected-election-meta">
                    <span className={`status ${selectedElection.status.toLowerCase()}`}>
                      {selectedElection.status}
                    </span>

                    {selectedElection.status !== "CLOSED" && (
                      <span className="countdown-badge">
                        Time left: {formatCountdown(selectedElection.end_time, now)}
                      </span>
                    )}
                  </div>
                </div>

                {selectedElection.has_voted && (
                  <div className="message info">
                    You have already voted in this election. Your vote remains private.
                  </div>
                )}

                {selectedElection.status === "ACTIVE" && !selectedElection.has_voted && (
                  <div className="candidate-grid">
                    {candidates.map((candidate) => (
                      <article className="candidate-card" key={candidate.candidate_id}>
                        <div className="candidate-avatar">
                          {candidate.name.charAt(0).toUpperCase()}
                        </div>

                        <h3>{candidate.name}</h3>
                        <p>{candidate.manifesto || "No manifesto provided."}</p>

                        <button onClick={() => castVote(candidate.candidate_id)} disabled={loading}>
                          Vote for {candidate.name}
                        </button>
                      </article>
                    ))}
                  </div>
                )}

                {(selectedElection.status === "CLOSED" || selectedElection.has_voted) && (
                  <div className="results-card">
                    <div className="results-header">
                      <div>
                        <p className="eyebrow">Live results</p>
                        <h2>Current standings</h2>
                      </div>

                      <strong>
                        {totalVotes} {totalVotes === 1 ? "vote" : "votes"}
                      </strong>
                    </div>

                    {results.map((result) => (
                      <div className="result-row" key={result.candidate_id}>
                        <div className="result-info">
                          <strong>{result.name}</strong>
                          <span>
                            {result.votes} {result.votes === 1 ? "vote" : "votes"} · {result.percentage}%
                          </span>
                        </div>

                        <div className="progress">
                          <div
                            className="progress-bar"
                            style={{ width: `${result.percentage}%` }}
                          />
                        </div>
                      </div>
                    ))}

                    {results.length === 0 && <p>No votes have been recorded yet.</p>}
                  </div>
                )}
              </section>
            )}
          </>
        )}

        {message && <div className="message success">{message}</div>}
        {error && <div className="message error">{error}</div>}
      </section>

      <footer className="partner-signature">
        <span>Built for transparent student leadership</span>
        <strong>JOOUST Blockchain Voting Project</strong>
        <span>In partnership with university election stakeholders</span>
      </footer>
    </main>
  );
}

function formatCountdown(endTime: string, now: number): string {
  const diff = new Date(endTime).getTime() - now;

  if (Number.isNaN(diff)) {
    return "Unknown";
  }

  if (diff <= 0) {
    return "Closed";
  }

  const totalSeconds = Math.floor(diff / 1000);
  const days = Math.floor(totalSeconds / (60 * 60 * 24));
  const hours = Math.floor((totalSeconds % (60 * 60 * 24)) / (60 * 60));
  const minutes = Math.floor((totalSeconds % (60 * 60)) / 60);
  const seconds = totalSeconds % 60;

  if (days > 0) {
    return `${days}d ${hours}h ${minutes}m ${seconds}s left`;
  }

  if (hours > 0) {
    return `${hours}h ${minutes}m ${seconds}s left`;
  }

  if (minutes > 0) {
    return `${minutes}m ${seconds}s left`;
  }

  return `${seconds}s left`;
}

export default App;
