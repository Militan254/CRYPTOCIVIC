import { useEffect, useState } from "react";
import AdminElectionCard from "../components/AdminElectionCard";
import LiveResults from "../components/LiveResults";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:3000/api";

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
};

type School = {
  school_id: number;
  school_code: string | null;
  school_name: string;
};

type Position = {
  position_id: number;
  position_name: string;
  description: string | null;
};

type Result = {
  candidate_id: number;
  name: string;
  manifesto: string | null;
  photo: string | null;
  votes: number;
  percentage: number;
};

type PendingCandidate = {
  candidate_id: number;
  student_id: number;
  election_id: number;

  registration_number: string;
  name: string;
  email: string;

  school_id: number;
  school_code: string | null;
  school_name: string;

  phone: string | null;
  course: string | null;
  year_of_study: string | null;

  election_title: string;
  position: string;
  election_scope: "SCHOOL" | "UNIVERSITY";

  manifesto: string | null;
  motivation: string | null;
  leadership_experience: string | null;
  vision: string | null;
  priorities: string | null;

  photo: string | null;
  video: string | null;
  fee_statement: string | null;
  result_slip: string | null;

  approval_status: "PENDING" | "APPROVED" | "REJECTED";
  created_at: string;
};
type AdminDashboardProps = {
  accessToken: string;
  adminRole: string;
};

type ManagedAdmin = {
  admin_id: number;
  name: string;
  email: string;
  role: "ADMIN" | "SUPER_ADMIN";
  created_at: string;
};

type Overview = {
  summary: Record<string, number>;
  elections: Array<Election & {
    candidate_count: number;
    pending_candidates: number;
    approved_candidates: number;
    rejected_candidates: number;
    total_votes: number;
  }>;
};

export default function AdminDashboard({
  accessToken,
  adminRole,
}: AdminDashboardProps) {
  const isSuperAdmin = adminRole === "SUPER_ADMIN";
  const candidateManagementPage = new URLSearchParams(window.location.search).has("candidates");
  const [elections, setElections] = useState<Election[]>([]);
  const [schools, setSchools] = useState<School[]>([]);
  const [positions, setPositions] = useState<Position[]>([]);

  const [pendingCandidates, setPendingCandidates] =
    useState<PendingCandidate[]>([]);

  const [selectedElectionId, setSelectedElectionId] =
    useState<number | null>(null);

  const [results, setResults] = useState<Result[]>([]);
  const [totalVotes, setTotalVotes] = useState(0);

  const [loading, setLoading] = useState(false);
  const [creatingElection, setCreatingElection] = useState(false);

  const [processingCandidate, setProcessingCandidate] =
    useState<number | null>(null);
  const [expandedCandidateId, setExpandedCandidateId] =
    useState<number | null>(null);

  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [managedAdmins, setManagedAdmins] = useState<ManagedAdmin[]>([]);
  const [overview, setOverview] = useState<Overview | null>(null);
  const [newAdminName, setNewAdminName] = useState("");
  const [newAdminEmail, setNewAdminEmail] = useState("");
  const [newAdminPassword, setNewAdminPassword] = useState("");
  const [newVoterName, setNewVoterName] = useState("");
  const [newVoterRegistration, setNewVoterRegistration] = useState("");
  const [newVoterEmail, setNewVoterEmail] = useState("");
  const [newVoterSchoolId, setNewVoterSchoolId] = useState("");

  const [title, setTitle] = useState("");
  const [position, setPosition] = useState("");

  const [electionScope, setElectionScope] = useState<
    "UNIVERSITY" | "SCHOOL"
  >("UNIVERSITY");

  const [schoolId, setSchoolId] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [startClock, setStartClock] = useState("");
  const [endClock, setEndClock] = useState("");

  useEffect(() => {
    void Promise.all([
      loadElections(),
      loadSchools(),
      loadPositions(),
      loadPendingCandidates(),
      ...(isSuperAdmin ? [loadSuperAdminData()] : []),
    ]);
    // These loaders are component-local actions for the initial dashboard load.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSuperAdmin]);

  async function loadSuperAdminData() {
    const headers = { Authorization: `Bearer ${accessToken}` };
    const [adminsResponse, overviewResponse] = await Promise.all([
      fetch(`${API_BASE_URL}/admins`, { headers }),
      fetch(`${API_BASE_URL}/admins/overview`, { headers }),
    ]);
    const adminsData = await adminsResponse.json();
    const overviewData = await overviewResponse.json();

    if (!adminsResponse.ok) throw new Error(adminsData.message || "Unable to load administrators.");
    if (!overviewResponse.ok) throw new Error(overviewData.message || "Unable to load system overview.");

    setManagedAdmins(adminsData.administrators || []);
    setOverview(overviewData);
  }

  async function createManagedAdmin(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setMessage("");

    try {
      const response = await fetch(`${API_BASE_URL}/admins`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: newAdminName.trim(),
          email: newAdminEmail.trim(),
          password: newAdminPassword,
          role: "ADMIN",
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Unable to create administrator.");
      setNewAdminName("");
      setNewAdminEmail("");
      setNewAdminPassword("");
      setMessage("Administrator created successfully.");
      await loadSuperAdminData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to create administrator.");
    }
  }

  async function removeManagedAdmin(adminId: number) {
    if (!window.confirm("Delete this administrator account? This cannot be undone.")) return;

    try {
      const response = await fetch(`${API_BASE_URL}/admins/${adminId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Unable to delete administrator.");
      setMessage("Administrator deleted successfully.");
      await loadSuperAdminData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to delete administrator.");
    }
  }

  async function changeManagedAdminRole(adminId: number, role: "ADMIN" | "SUPER_ADMIN") {
    try {
      const response = await fetch(`${API_BASE_URL}/admins/${adminId}/role`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ role }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Unable to update administrator role.");
      setMessage("Administrator role updated successfully.");
      await loadSuperAdminData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to update administrator role.");
    }
  }

  async function createManagedVoter(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setMessage("");

    try {
      const response = await fetch(`${API_BASE_URL}/admins/voters`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: newVoterName.trim(),
          registration_number: newVoterRegistration.trim(),
          email: newVoterEmail.trim(),
          school_id: Number(newVoterSchoolId),
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Unable to add voter.");
      setNewVoterName("");
      setNewVoterRegistration("");
      setNewVoterEmail("");
      setNewVoterSchoolId("");
      setMessage("Voter added. Their initial password is jooust2030 and identity verification is required on first login.");
      await loadSuperAdminData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to add voter.");
    }
  }

  useEffect(() => {
    if (selectedElectionId === null) {
      return;
    }

    loadResults(selectedElectionId);

    const interval = setInterval(() => {
      loadResults(selectedElectionId);
    }, 5000);

    return () => clearInterval(interval);
  }, [selectedElectionId]);

  useEffect(() => {
    const handleDocumentClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target) {
        return;
      }

      const clickedInsideCard = target.closest(".candidate-approval-card");
      if (!clickedInsideCard && expandedCandidateId !== null) {
        setExpandedCandidateId(null);
      }
    };

    document.addEventListener("click", handleDocumentClick);
    return () => document.removeEventListener("click", handleDocumentClick);
  }, [expandedCandidateId]);

  async function loadElections() {
    setLoading(true);
    setError("");

    try {
      const response = await fetch(
        `${API_BASE_URL}/elections`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message || "Unable to load elections."
        );
      }

      setElections(data.elections || []);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to load elections."
      );
    } finally {
      setLoading(false);
    }
  }

  async function loadSchools() {
    try {
      const response = await fetch(
        `${API_BASE_URL}/schools`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message || "Unable to load schools."
        );
      }

      setSchools(data.schools || []);
    } catch (err) {
      console.error("School loading error:", err);

      setError(
        err instanceof Error
          ? err.message
          : "Unable to load schools."
      );
    }
  }

  async function loadPositions() {
    try {
      const response = await fetch(
        `${API_BASE_URL}/positions`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message || "Unable to load positions."
        );
      }

      setPositions(data.positions || []);
    } catch (err) {
      console.error("Position loading error:", err);

      setError(
        err instanceof Error
          ? err.message
          : "Unable to load positions."
      );
    }
  }

  async function loadPendingCandidates() {
    try {
      const response = await fetch(
        `${API_BASE_URL}/candidates/pending/list`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message ||
            "Unable to load candidate applications."
        );
      }

      setPendingCandidates(data.candidates || []);
    } catch (err) {
      console.error(
        "Candidate loading error:",
        err
      );

      setError(
        err instanceof Error
          ? err.message
          : "Unable to load candidate applications."
      );
    }
  }

  async function openCandidateFile(candidateId: number, fileType: string) {
    try {
      const response = await fetch(
        `${API_BASE_URL}/candidates/${candidateId}/file/${fileType}`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );

      if (!response.ok) {
        throw new Error("Unable to open candidate file.");
      }

      const blobUrl = URL.createObjectURL(await response.blob());
      window.open(blobUrl, "_blank", "noopener,noreferrer");
      window.setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to open candidate file.");
    }
  }

  async function deleteElection(electionId: number) {
    if (!window.confirm("Delete this closed election and its stored results? This cannot be undone.")) {
      return;
    }

    setLoading(true);
    setError("");
    setMessage("");

    try {
      const response = await fetch(`${API_BASE_URL}/elections/${electionId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || "Unable to delete election.");
      }
      setMessage("Closed election deleted successfully.");
      await loadElections();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to delete election.");
    } finally {
      setLoading(false);
    }
  }

  async function createElection(
    event: React.FormEvent
  ) {
    event.preventDefault();

    setCreatingElection(true);
    setError("");
    setMessage("");

    try {
      if (!title.trim()) {
        throw new Error(
          "Election title is required."
        );
      }

      if (!position.trim()) {
        throw new Error(
          "Election position is required."
        );
      }

      if (!startDate || !endDate || !startClock || !endClock) {
        throw new Error(
          "Start and end time are required."
        );
      }

      const startValue = `${startDate}T${startClock}`;
      const endValue = `${endDate}T${endClock}`;

      const startDateValue = new Date(startValue);
      const endDateValue = new Date(endValue);

      if (
        Number.isNaN(startDateValue.getTime()) ||
        Number.isNaN(endDateValue.getTime())
      ) {
        throw new Error(
          "Please enter valid start and end times."
        );
      }

      if (
        startDateValue.getTime() >= endDateValue.getTime()
      ) {
        throw new Error(
          "End time must be later than start time."
        );
      }

      if (
        electionScope === "SCHOOL" &&
        !schoolId
      ) {
        throw new Error(
          "Please select a school for a school election."
        );
      }

      const payload = {
        title: title.trim(),
        position: position.trim(),
        election_scope: electionScope,
        school_id:
          electionScope === "SCHOOL"
            ? Number(schoolId)
            : null,
        start_time: startValue,
        end_time: endValue,
      };

      const response = await fetch(
        `${API_BASE_URL}/elections`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify(payload),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message ||
            "Unable to create election."
        );
      }

      setMessage(
        "Election created successfully."
      );

      setTitle("");
      setPosition("");
      setElectionScope("UNIVERSITY");
      setSchoolId("");
      setStartDate("");
      setEndDate("");
      setStartClock("");
      setEndClock("");

      await loadElections();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to create election."
      );
    } finally {
      setCreatingElection(false);
    }
  }

  async function activateElection(
    electionId: number
  ) {
    setLoading(true);
    setError("");
    setMessage("");

    try {
      const response = await fetch(
        `${API_BASE_URL}/elections/${electionId}/activate`,
        {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message ||
            "Unable to activate election."
        );
      }

      setMessage(
        "Election activated successfully."
      );

      await loadElections();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to activate election."
      );
    } finally {
      setLoading(false);
    }
  }

  async function closeElection(
    electionId: number
  ) {
    const confirmed = window.confirm(
      "Are you sure you want to close this election? Voting will no longer be available."
    );

    if (!confirmed) {
      return;
    }

    setLoading(true);
    setError("");
    setMessage("");

    try {
      const response = await fetch(
        `${API_BASE_URL}/elections/${electionId}/close`,
        {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message ||
            "Unable to close election."
        );
      }

      setMessage(
        "Election closed successfully."
      );

      await loadElections();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to close election."
      );
    } finally {
      setLoading(false);
    }
  }

  async function updateCandidateApproval(
    candidateId: number,
    approvalStatus:
      | "APPROVED"
      | "REJECTED"
  ) {
    const action =
      approvalStatus === "APPROVED"
        ? "approve"
        : "reject";

    const confirmed = window.confirm(
      `Are you sure you want to ${action} this candidate?`
    );

    if (!confirmed) {
      return;
    }

    setProcessingCandidate(candidateId);
    setError("");
    setMessage("");

    try {
      const response = await fetch(
        `${API_BASE_URL}/candidates/${candidateId}/approval`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({
            approval_status: approvalStatus,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message ||
            `Unable to ${action} candidate.`
        );
      }

      setMessage(
        approvalStatus === "APPROVED"
          ? "Candidate approved successfully."
          : "Candidate rejected successfully."
      );

      await loadPendingCandidates();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : `Unable to ${action} candidate.`
      );
    } finally {
      setProcessingCandidate(null);
    }
  }

  async function loadResults(
    electionId: number
  ) {
    try {
      const response = await fetch(
        `${API_BASE_URL}/results/${electionId}`
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message ||
            "Unable to load results."
        );
      }

      setResults(data.results || []);
      setTotalVotes(data.total_votes || 0);
    } catch (err) {
      console.error(
        "Admin results error:",
        err
      );
    }
  }

  function viewResults(
    electionId: number
  ) {
    setSelectedElectionId(electionId);
    setError("");
    setMessage("");
    window.setTimeout(() => {
      document.getElementById("admin-results")?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }, 0);
  }

  function toggleCandidateExpansion(candidateId: number) {
    setExpandedCandidateId((current) =>
      current === candidateId ? null : candidateId
    );
  }

  const selectedElection =
    elections.find(
      (election) =>
        election.election_id ===
        selectedElectionId
    );

  return (
  <main className={`app admin-app ${candidateManagementPage ? "candidate-management-only" : ""}`}>
    <div
      className="site-video-wrap"
      aria-hidden="true"
    >
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

    <header className="hero admin-hero">
      <div className="hero-content admin-hero-content">
        <p className="eyebrow">
          ONLINE VOTING SYSTEM
        </p>

        <h1>
          Admin Dashboard
        </h1>

        <p className="subtitle">
          Manage elections, review candidates,
          and monitor voting activity securely
          from one place.
        </p>
      </div>
    </header>

    {!candidateManagementPage && (
      <div className="admin-page-link-wrap">
        <a className="secondary-button" href="?admin&candidates">
          Open candidate management
        </a>
      </div>
    )}

    {candidateManagementPage && (
      <div className="admin-page-link-wrap">
        <a className="secondary-button" href="?admin">
          Back to election dashboard
        </a>
      </div>
    )}

      <section className="container">
        {message && (
          <div className="message success">
            {message}
          </div>
        )}

        {error && (
          <div className="message error">
            {error}
          </div>
        )}

        {isSuperAdmin && (
          <section className="super-admin-panel">
            <div className="section-heading">
              <div>
                <p className="eyebrow">Super administrator</p>
                <h2>System overview</h2>
                <p>Review the whole election system and manage administrator access.</p>
              </div>
              <span className="pending-count">GOD MODE</span>
            </div>

            {overview && (
              <div className="overview-stat-grid">
                {Object.entries(overview.summary).map(([label, value]) => (
                  <div className="overview-stat" key={label}>
                    <span>{label.replaceAll("_", " ")}</span>
                    <strong>{value}</strong>
                  </div>
                ))}
              </div>
            )}

            {overview && (
              <div className="godmode-election-list">
                <h3>All elections</h3>
                {overview.elections.map((election) => (
                  <div className="godmode-election-row" key={election.election_id}>
                    <div>
                      <strong>{election.title}</strong>
                      <span>{election.position} · {election.status}</span>
                    </div>
                    <div className="godmode-election-metrics">
                      <span>{election.candidate_count} candidates</span>
                      <span>{election.approved_candidates} approved</span>
                      <span>{election.pending_candidates} pending</span>
                      <span>{election.total_votes} votes</span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="super-admin-management-grid">
              <form className="admin-form-card" onSubmit={createManagedAdmin}>
                <p className="eyebrow">Administrator access</p>
                <h3>Add administrator</h3>
                <label>Name<input value={newAdminName} onChange={(event) => setNewAdminName(event.target.value)} required /></label>
                <label>Email<input type="email" value={newAdminEmail} onChange={(event) => setNewAdminEmail(event.target.value)} required /></label>
                <label>Temporary password<input type="password" value={newAdminPassword} onChange={(event) => setNewAdminPassword(event.target.value)} minLength={8} required /></label>
                <button className="primary-button" type="submit">Add administrator</button>
              </form>

              <div className="admin-form-card">
                <p className="eyebrow">Administrator accounts</p>
                <h3>Manage administrators</h3>
                <div className="managed-admin-list">
                  {managedAdmins.map((managedAdmin) => (
                    <div className="managed-admin-row" key={managedAdmin.admin_id}>
                      <div>
                        <strong>{managedAdmin.name}</strong>
                        <span>{managedAdmin.email} · {managedAdmin.role}</span>
                      </div>
                      <select
                        value={managedAdmin.role}
                        onChange={(event) => changeManagedAdminRole(
                          managedAdmin.admin_id,
                          event.target.value as "ADMIN" | "SUPER_ADMIN"
                        )}
                        disabled={managedAdmin.role === "SUPER_ADMIN" && managedAdmins.filter((item) => item.role === "SUPER_ADMIN").length === 1}
                        aria-label={`Role for ${managedAdmin.name}`}
                      >
                        <option value="ADMIN">Admin</option>
                        <option value="SUPER_ADMIN">Super admin</option>
                      </select>
                      <button className="danger-button" type="button" onClick={() => removeManagedAdmin(managedAdmin.admin_id)}>
                        Delete
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <form className="admin-form-card" onSubmit={createManagedVoter}>
                <p className="eyebrow">Voter registry</p>
                <h3>Add voter</h3>
                <label>Name<input value={newVoterName} onChange={(event) => setNewVoterName(event.target.value)} required /></label>
                <label>Registration number<input value={newVoterRegistration} onChange={(event) => setNewVoterRegistration(event.target.value)} required /></label>
                <label>University email<input type="email" value={newVoterEmail} onChange={(event) => setNewVoterEmail(event.target.value)} required /></label>
                <label>School<select value={newVoterSchoolId} onChange={(event) => setNewVoterSchoolId(event.target.value)} required><option value="">Select school</option>{schools.map((school) => <option key={school.school_id} value={school.school_id}>{school.school_code ? `${school.school_code} — ` : ""}{school.school_name}</option>)}</select></label>
                <button className="primary-button" type="submit">Add voter</button>
              </form>
            </div>
          </section>
        )}

        {/* CREATE ELECTION */}
        <section className="card admin-form-card">
          <div className="section-heading">
            <div>
              <p className="eyebrow">
                Election Management
              </p>

              <h2>
                Create Election
              </h2>

              <p>
                Create a new university or
                school election.
              </p>
            </div>
          </div>

          <form
            className="admin-form"
            onSubmit={createElection}
          >
            <div className="form-grid">
              <label>
                Election Title

                <input
                  type="text"
                  value={title}
                  onChange={(event) =>
                    setTitle(
                      event.target.value
                    )
                  }
                  placeholder="e.g. JOOUST 2026 General Elections"
                />
              </label>

              <label>
                Position

                <select
                  value={position}
                  onChange={(event) =>
                    setPosition(
                      event.target.value
                    )
                  }
                >
                  <option value="">
                    Select a position
                  </option>

                  {positions.map(
                    (positionItem) => (
                      <option
                        key={
                          positionItem.position_id
                        }
                        value={
                          positionItem.position_name
                        }
                      >
                        {
                          positionItem.position_name
                        }
                      </option>
                    )
                  )}
                </select>
              </label>

              <label>
                Election Scope

                <select
                  value={electionScope}
                  onChange={(event) =>
                    setElectionScope(
                      event.target.value as
                        | "UNIVERSITY"
                        | "SCHOOL"
                    )
                  }
                >
                  <option value="UNIVERSITY">
                    University
                  </option>

                  <option value="SCHOOL">
                    School
                  </option>
                </select>
              </label>

              {electionScope === "SCHOOL" && (
                <label>
                  School

                  <select
                    value={schoolId}
                    onChange={(event) =>
                      setSchoolId(
                        event.target.value
                      )
                    }
                  >
                    <option value="">
                      Select a school
                    </option>

                    {schools.map(
                      (school) => (
                        <option
                          key={
                            school.school_id
                          }
                          value={
                            school.school_id
                          }
                        >
                          {school.school_code
                            ? `${school.school_code} — `
                            : ""}
                          {school.school_name}
                        </option>
                      )
                    )}
                  </select>
                </label>
              )}

              <label>
                Start Date & Time

                <input
                  type="date"
                  value={startDate}
                  onChange={(event) =>
                    setStartDate(
                      event.target.value
                    )
                  }
                />
                <input
                  type="time"
                  value={startClock}
                  onChange={(event) => setStartClock(event.target.value)}
                  aria-label="Start time"
                />
              </label>

              <label>
                End Date & Time

                <input
                  type="date"
                  value={endDate}
                  onChange={(event) =>
                    setEndDate(
                      event.target.value
                    )
                  }
                />
                <input
                  type="time"
                  value={endClock}
                  onChange={(event) => setEndClock(event.target.value)}
                  aria-label="End time"
                />
              </label>
            </div>

            <button
              className="primary-button"
              type="submit"
              disabled={creatingElection}
            >
              {creatingElection
                ? "Creating..."
                : "Create Election"}
            </button>
          </form>
        </section>

        {/* ELECTIONS */}
        <section id="admin-elections" className="admin-election-management">
          <div className="section-heading">
            <div>
              <p className="eyebrow">
                Administration
              </p>

              <h2>
                Elections
              </h2>

              <p>
                Activate, close, and monitor
                elections.
              </p>
            </div>

            <button
              className="secondary-button"
              onClick={() => {
                loadElections();
                loadSchools();
                loadPositions();
                loadPendingCandidates();
              }}
              disabled={loading}
            >
              Refresh
            </button>
          </div>

          {loading &&
            elections.length === 0 && (
              <div className="card login-card">
                <p>
                  Loading elections...
                </p>
              </div>
            )}

          <div className="election-grid">
            {elections.map(
              (election) => (
                <AdminElectionCard
                  key={
                    election.election_id
                  }
                  election={election}
                  onActivate={
                    activateElection
                  }
                  onClose={
                    closeElection
                  }
                  onViewResults={
                    viewResults
                  }
                  onDelete={deleteElection}
                />
              )
            )}
          </div>

          {elections.length === 0 &&
            !loading && (
              <div className="card login-card">
                <p>
                  No elections found.
                </p>
              </div>
            )}
        </section>

{/* CANDIDATE APPROVAL */}
{candidateManagementPage && (
  <section className="admin-section candidate-management-section">
  <div className="section-heading">
    <div>
      <p className="eyebrow">
        Candidate Management
      </p>

      <h2>
        Candidate Applications
      </h2>

      <p>
        Carefully review each candidate's personal
        information, academic records, campaign
        materials, supporting documents, and
        motivation before making a decision.
      </p>
    </div>

    <span className="pending-count">
      {pendingCandidates.filter((candidate) => candidate.approval_status === "PENDING").length} Pending
    </span>
  </div>

  {pendingCandidates.length === 0 && (
    <div className="card empty-state">
      <p>
        No candidate applications found.
      </p>
    </div>
  )}

  <div className="candidate-approval-grid">
    {pendingCandidates.map((candidate) => {
      const isExpanded = expandedCandidateId === candidate.candidate_id;

      return (
        <article
          className={`candidate-approval-card ${isExpanded ? "expanded" : "collapsed"}`}
          key={candidate.candidate_id}
          onClick={() => toggleCandidateExpansion(candidate.candidate_id)}
        >
          <div className="candidate-approval-header">
            <div className="candidate-avatar">
              {candidate.name.charAt(0).toUpperCase()}
            </div>

            <div className="candidate-header-info">
              <h3>{candidate.name}</h3>
              <p>{candidate.registration_number}</p>
              <span>{candidate.position}</span>
            </div>

            <div className="candidate-header-meta">
              <span className={`status ${candidate.approval_status.toLowerCase()}`}>
                {candidate.approval_status}
              </span>
              <span className="expand-hint">{isExpanded ? "Hide" : "View"}</span>
            </div>
          </div>

          <div className="candidate-summary">
            <div>
              <strong>Election</strong>
              <span>{candidate.election_title}</span>
            </div>
            <div>
              <strong>School</strong>
              <span>{candidate.school_name}</span>
            </div>
            <div>
              <strong>Course</strong>
              <span>{candidate.course || "Not provided"}</span>
            </div>
          </div>

          {isExpanded && (
            <>
              <div className="admin-application-section">
                <div className="admin-application-section-title">
                  <span>01</span>
                  <div>
                    <h4>Personal Details</h4>
                    <p>Applicant's registered student information.</p>
                  </div>
                </div>

                <div className="admin-detail-grid">
                  <div>
                    <strong>Full name</strong>
                    <span>{candidate.name}</span>
                  </div>

                  <div>
                    <strong>Registration number</strong>
                    <span>{candidate.registration_number}</span>
                  </div>

                  <div>
                    <strong>Email address</strong>
                    <span>{candidate.email}</span>
                  </div>

                  <div>
                    <strong>Phone number</strong>
                    <span>{candidate.phone || "Not provided"}</span>
                  </div>

                  <div>
                    <strong>School</strong>
                    <span>{candidate.school_name}</span>
                  </div>

                  <div>
                    <strong>School code</strong>
                    <span>{candidate.school_code || "N/A"}</span>
                  </div>

                  <div>
                    <strong>Course</strong>
                    <span>{candidate.course || "Not provided"}</span>
                  </div>

                  <div>
                    <strong>Year of study</strong>
                    <span>{candidate.year_of_study || "Not provided"}</span>
                  </div>
                </div>
              </div>

              <div className="admin-application-section">
                <div className="admin-application-section-title">
                  <span>02</span>
                  <div>
                    <h4>Election Details</h4>
                    <p>Election and position applied for.</p>
                  </div>
                </div>

                <div className="admin-detail-grid">
                  <div>
                    <strong>Election</strong>
                    <span>{candidate.election_title}</span>
                  </div>

                  <div>
                    <strong>Position</strong>
                    <span>{candidate.position}</span>
                  </div>

                  <div>
                    <strong>Election scope</strong>
                    <span>{candidate.election_scope}</span>
                  </div>

                  <div>
                    <strong>Application date</strong>
                    <span>{new Date(candidate.created_at).toLocaleString()}</span>
                  </div>
                </div>
              </div>

              <div className="admin-application-section">
                <div className="admin-application-section-title">
                  <span>03</span>
                  <div>
                    <h4>Candidate Photograph</h4>
                    <p>Photograph submitted with the application.</p>
                  </div>
                </div>

                {candidate.photo ? (
                  <div className="admin-candidate-photo">
                    <button
                      className="secondary-button"
                      onClick={(event) => {
                        event.stopPropagation();
                        openCandidateFile(candidate.candidate_id, "photo");
                      }}
                    >
                      View candidate photograph
                    </button>
                  </div>
                ) : (
                  <div className="admin-missing-file">No candidate photograph submitted.</div>
                )}
              </div>

              <div className="admin-application-section">
                <div className="admin-application-section-title">
                  <span>04</span>
                  <div>
                    <h4>Motivation & Leadership</h4>
                    <p>Applicant's reasons and leadership background.</p>
                  </div>
                </div>

                <div className="admin-writing-block">
                  <h5>Why do you want to contest?</h5>
                  <p>{candidate.motivation || "No motivation provided."}</p>
                </div>

                <div className="admin-writing-block">
                  <h5>Leadership experience</h5>
                  <p>{candidate.leadership_experience || "No leadership experience provided."}</p>
                </div>
              </div>

              <div className="admin-application-section">
                <div className="admin-application-section-title">
                  <span>05</span>
                  <div>
                    <h4>Vision & Priorities</h4>
                    <p>Proposed direction and priorities for the student body.</p>
                  </div>
                </div>

                <div className="admin-writing-block">
                  <h5>Vision</h5>
                  <p>{candidate.vision || "No vision provided."}</p>
                </div>

                <div className="admin-writing-block">
                  <h5>Key priorities</h5>
                  <p>{candidate.priorities || "No priorities provided."}</p>
                </div>
              </div>

              <div className="admin-application-section">
                <div className="admin-application-section-title">
                  <span>06</span>
                  <div>
                    <h4>Manifesto</h4>
                    <p>Full manifesto submitted by the applicant.</p>
                  </div>
                </div>

                <div className="admin-manifesto">
                  <p>{candidate.manifesto || "No manifesto provided."}</p>
                </div>
              </div>

              <div className="admin-application-section">
                <div className="admin-application-section-title">
                  <span>07</span>
                  <div>
                    <h4>Candidate Video</h4>
                    <p>Applicant's video explaining their motivation for contesting.</p>
                  </div>
                </div>

                {candidate.video ? (
                  <div className="admin-video-container">
                    <button
                      className="secondary-button"
                      onClick={(event) => {
                        event.stopPropagation();
                        openCandidateFile(candidate.candidate_id, "video");
                      }}
                    >
                      View motivation video
                    </button>
                  </div>
                ) : (
                  <div className="admin-missing-file">No motivation video submitted.</div>
                )}
              </div>

              <div className="admin-application-section">
                <div className="admin-application-section-title">
                  <span>08</span>
                  <div>
                    <h4>Supporting Documents</h4>
                    <p>Documents submitted for eligibility verification.</p>
                  </div>
                </div>

                <div className="admin-document-grid">
                  {candidate.fee_statement ? (
                    <button
                      className="admin-document-card"
                      onClick={(event) => {
                        event.stopPropagation();
                        openCandidateFile(candidate.candidate_id, "fee_statement");
                      }}
                    >
                      <div className="document-icon">📄</div>
                      <div>
                        <strong>Fee Statement</strong>
                        <span>View submitted statement</span>
                      </div>
                      <span className="document-action">View</span>
                    </button>
                  ) : (
                    <div className="admin-document-card missing">
                      <strong>Fee Statement</strong>
                      <span>Not submitted</span>
                    </div>
                  )}

                  {candidate.result_slip ? (
                    <button
                      className="admin-document-card"
                      onClick={(event) => {
                        event.stopPropagation();
                        openCandidateFile(candidate.candidate_id, "result_slip");
                      }}
                    >
                      <div className="document-icon">📑</div>
                      <div>
                        <strong>Previous Semester Result Slip</strong>
                        <span>View submitted result slip</span>
                      </div>
                      <span className="document-action">View</span>
                    </button>
                  ) : (
                    <div className="admin-document-card missing">
                      <strong>Previous Semester Result Slip</strong>
                      <span>Not submitted</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="admin-review-notice">
                <strong>Important:</strong>
                <p>
                  All information and supporting documents submitted through this application
                  must be reviewed by the election administrators before the candidature is approved.
                </p>
              </div>

              {candidate.approval_status === "PENDING" && <div className="candidate-actions">
                <button
                  className="approve-button"
                  disabled={processingCandidate === candidate.candidate_id}
                  onClick={(event) => {
                    event.stopPropagation();
                    updateCandidateApproval(candidate.candidate_id, "APPROVED");
                  }}
                >
                  {processingCandidate === candidate.candidate_id ? "Processing..." : "Approve Candidate"}
                </button>

                <button
                  className="reject-button"
                  disabled={processingCandidate === candidate.candidate_id}
                  onClick={(event) => {
                    event.stopPropagation();
                    updateCandidateApproval(candidate.candidate_id, "REJECTED");
                  }}
                >
                  Reject Application
                </button>
              </div>}
            </>
          )}
        </article>
      );
    })}
  </div>
</section>
)}

        {/* LIVE RESULTS */}
        {selectedElection && (
          <section id="admin-results" className="voting-section admin-live-results">
            <div className="section-heading">
              <div>
                <p className="eyebrow">
                  Monitoring
                </p>

                <h2>
                  {
                    selectedElection.title
                  }
                </h2>

                <p>
                  {
                    selectedElection.position
                  }
                </p>
              </div>

              <span
                className={`status ${selectedElection.status.toLowerCase()}`}
              >
                {
                  selectedElection.status
                }
              </span>
            </div>

            <LiveResults
              results={results}
              totalVotes={totalVotes}
            />
          </section>
        )}
      </section>
    </main>
  );
}

