import { useEffect, useRef, useState } from "react";
import "../App.css";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:3000/api";

type Election = {
  election_id: number;
  title: string;
  position: string;
  election_scope: "SCHOOL" | "UNIVERSITY";
  school_name: string | null;
  status: "UPCOMING" | "ACTIVE" | "CLOSED";
};

type Student = {
  student_id: number;
  registration_number: string;
  name: string;
  email: string;
  school_id: number;
  school_name: string | null;
};

type CandidateApplicationStatus = {
  candidate_id: number;
  election_title: string;
  position: string;
  election_scope: "SCHOOL" | "UNIVERSITY";
  approval_status: "PENDING" | "APPROVED" | "REJECTED";
  created_at: string;
};

export default function CandidateApplication() {
  const [elections, setElections] = useState<Election[]>([]);
  const [student, setStudent] = useState<Student | null>(null);
  const [applications, setApplications] = useState<CandidateApplicationStatus[]>([]);

  const [registrationNumber, setRegistrationNumber] = useState("");
  const [password, setPassword] = useState("");
  const [voterToken, setVoterToken] = useState("");
  const [electionId, setElectionId] = useState("");

  const [phone, setPhone] = useState("");
  const [course, setCourse] = useState("");
  const [yearOfStudy, setYearOfStudy] = useState("");

  const [motivation, setMotivation] = useState("");
  const [leadershipExperience, setLeadershipExperience] = useState("");
  const [vision, setVision] = useState("");
  const [priorities, setPriorities] = useState("");
  const [manifesto, setManifesto] = useState("");

  const [photo, setPhoto] = useState<File | null>(null);
  const [video, setVideo] = useState<File | null>(null);
  const [feeStatement, setFeeStatement] = useState<File | null>(null);
  const [resultSlip, setResultSlip] = useState<File | null>(null);

  const [photoPreview, setPhotoPreview] = useState("");
  const [videoPreview, setVideoPreview] = useState("");

  const [loadingStudent, setLoadingStudent] = useState(false);
  const [loading, setLoading] = useState(false);

  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    async function loadElections() {
      try {
        const response = await fetch(`${API_BASE_URL}/elections/open`);

        if (!response.ok) {
          throw new Error("Unable to load available elections.");
        }

        const data = await response.json();

        setElections(
          (data.elections || []).filter(
            (election: Election) => election.status !== "CLOSED"
          )
        );
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Unable to load available elections."
        );
      }
    }

    loadElections();
  }, []);

  async function lookupStudent() {
    const registration = registrationNumber.trim();
    const voterPassword = password.trim();

    if (!registration) {
      setError("Enter your registration number first.");
      return;
    }

    if (!voterPassword) {
      setError("Enter your voter password first.");
      return;
    }

    setLoadingStudent(true);
    setError("");
    setMessage("");

    try {
      const response = await fetch(`${API_BASE_URL}/students/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          registration_number: registration,
          password: voterPassword,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message || "Student could not be verified."
        );
      }

      if (data.requiresVerification) {
        throw new Error("Complete first-login verification on the voter portal before applying.");
      }

      const foundStudent = data.student;

      setStudent(foundStudent);
      setVoterToken(data.token);

      const applicationsResponse = await fetch(`${API_BASE_URL}/candidates/mine`, {
        headers: { Authorization: `Bearer ${data.token}` },
      });
      const applicationsData = await applicationsResponse.json();

      if (applicationsResponse.ok) {
        setApplications(applicationsData.applications || []);
      }

      if (foundStudent.name) {
        // Student details returned by the database are displayed below.
      }

      if (foundStudent.email) {
        // Email is read-only because it comes from the student record.
      }
    } catch (err) {
      setStudent(null);
      setApplications([]);
      setError(
        err instanceof Error
          ? err.message
          : "Unable to verify student."
      );
    } finally {
      setLoadingStudent(false);
    }
  }

  function handlePhotoChange(
    event: React.ChangeEvent<HTMLInputElement>
  ) {
    const file = event.target.files?.[0] || null;

    setPhoto(file);

    if (photoPreview) {
      URL.revokeObjectURL(photoPreview);
    }

    if (file) {
      setPhotoPreview(URL.createObjectURL(file));
    } else {
      setPhotoPreview("");
    }
  }

  function handleVideoChange(
    event: React.ChangeEvent<HTMLInputElement>
  ) {
    const file = event.target.files?.[0] || null;

    setVideo(file);

    if (videoPreview) {
      URL.revokeObjectURL(videoPreview);
    }

    if (file) {
      setVideoPreview(URL.createObjectURL(file));
    } else {
      setVideoPreview("");
    }
  }

  function getSelectedElection() {
    return elections.find(
      (election) => election.election_id === Number(electionId)
    );
  }

  function validateApplication() {
    if (!registrationNumber.trim()) {
      return "Registration number is required.";
    }

    if (!student) {
      return "Please verify your student record before applying.";
    }

    if (!electionId) {
      return "Please select the election and position.";
    }

    if (!phone.trim()) {
      return "Phone number is required.";
    }

    if (!course.trim()) {
      return "Course/programme is required.";
    }

    if (!yearOfStudy.trim()) {
      return "Year of study is required.";
    }

    if (!motivation.trim()) {
      return "Please explain your motivation for contesting.";
    }

    if (!leadershipExperience.trim()) {
      return "Please provide your leadership experience.";
    }

    if (!vision.trim()) {
      return "Please provide your vision.";
    }

    if (!priorities.trim()) {
      return "Please provide your priorities.";
    }

    if (!manifesto.trim()) {
      return "Your manifesto is required.";
    }

    if (!photo) {
      return "Candidate photograph is required.";
    }

    if (!video) {
      return "Motivation video is required.";
    }

    if (!feeStatement) {
      return "Fee statement is required.";
    }

    if (!resultSlip) {
      return "Previous semester result slip is required.";
    }

    return "";
  }

  async function submitApplication(
    event: React.FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    setError("");
    setMessage("");

    const validationError = validateApplication();

    if (validationError) {
      setError(validationError);
      return;
    }

    setLoading(true);

    try {
      const formData = new FormData();

      formData.append(
        "registration_number",
        registrationNumber.trim()
      );

      formData.append(
        "election_id",
        String(Number(electionId))
      );

      formData.append("phone", phone.trim());
      formData.append("course", course.trim());
      formData.append("year_of_study", yearOfStudy.trim());

      formData.append("motivation", motivation.trim());
      formData.append(
        "leadership_experience",
        leadershipExperience.trim()
      );
      formData.append("vision", vision.trim());
      formData.append("priorities", priorities.trim());
      formData.append("manifesto", manifesto.trim());

      formData.append("photo", photo!);
      formData.append("video", video!);
      formData.append("fee_statement", feeStatement!);
      formData.append("result_slip", resultSlip!);

      const response = await fetch(
        `${API_BASE_URL}/candidates/register`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${voterToken}`,
          },
          body: formData,
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message || "Unable to submit application."
        );
      }

      setMessage(
        "Your candidate application has been submitted successfully and is now awaiting administrative review."
      );

      setStudent(null);
      setRegistrationNumber("");
      setPassword("");
      setVoterToken("");
      setElectionId("");
      setPhone("");
      setCourse("");
      setYearOfStudy("");
      setMotivation("");
      setLeadershipExperience("");
      setVision("");
      setPriorities("");
      setManifesto("");
      setPhoto(null);
      setVideo(null);
      setFeeStatement(null);
      setResultSlip(null);
      setPhotoPreview("");
      setVideoPreview("");

      formRef.current?.reset();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to submit application."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="app application-page">
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

      <div className="application-overlay" />

      <header className="hero application-hero">
        <div className="hero-content">
          <p className="eyebrow">JOOUST ELECTIONS</p>

          <h1>Candidate Application</h1>

          <p className="subtitle">
            Complete your official candidature application for a
            university or school election.
          </p>

          <div className="application-notice">
            <strong>Important:</strong>
            <span>
              All information and supporting documents submitted
              through this application will be reviewed by the
              election administrators before your candidature is
              approved.
            </span>
          </div>
        </div>
      </header>

      <section className="container application-container">
        <form
          ref={formRef}
          className="candidate-application-form"
          onSubmit={submitApplication}
        >
          {/* SECTION 1 */}
          <section className="application-section">
            <div className="section-heading">
              <span className="section-number">01</span>

              <div>
                <p className="section-kicker">
                  Candidate identification
                </p>

                <h2>Personal & Academic Details</h2>

                <p>
                  Provide your official student information. Your
                  name, email and school will be verified against
                  the university student records.
                </p>
              </div>
            </div>

            <div className="form-grid">
              <label>
                Registration Number
                <span className="required"> </span>

                <div className="input-with-button">
                  <input
                    value={registrationNumber}
                    onChange={(event) =>
                      setRegistrationNumber(event.target.value)
                    }
                    placeholder="e.g. I132G......."
                    required
                  />

                  <button
                    type="button"
                    className="secondary-button"
                    onClick={lookupStudent}
                    disabled={loadingStudent}
                  >
                    {loadingStudent ? "Checking..." : "Verify"}
                  </button>
                </div>

                <span className="field-help">
                  Enter your official university registration
                  number and verify your student record.
                </span>
              </label>

              <label>
                Full Name

                <input
                  value={student?.name || ""}
                  placeholder="Verified student name"
                  readOnly
                />

                <span className="field-help">
                  Automatically obtained from the student record.
                </span>
              </label>

              <label>
                University Email

                <input
                  value={student?.email || ""}
                  placeholder="Verified university email"
                  readOnly
                />
              </label>

              <label>
                Phone Number
                <span className="required"> </span>

                <input
                  value={phone}
                  onChange={(event) =>
                    setPhone(event.target.value)
                  }
                  placeholder="e.g. 0712345678"
                  required
                />
              </label>

              <label>
                School

                <input
                  value={student?.school_name || ""}
                  placeholder="Verified school"
                  readOnly
                />

                <span className="field-help">
                  Your school is determined from the student
                  record.
                </span>
              </label>

              <label>
                Course / Programme
                <span className="required"> </span>

                <input
                  value={course}
                  onChange={(event) =>
                    setCourse(event.target.value)
                  }
                  placeholder="e.g. BSc Security and Forensics"
                  required
                />
              </label>

              <label>
                Year of Study
                <span className="required"> </span>

                <select
                  value={yearOfStudy}
                  onChange={(event) =>
                    setYearOfStudy(event.target.value)
                  }
                  required
                >
                  <option value="">
                    Select year of study
                  </option>
                  <option value="Year 1">Year 1</option>
                  <option value="Year 2">Year 2</option>
                  <option value="Year 3">Year 3</option>
                  <option value="Year 4">Year 4</option>
                  <option value="Year 5">Year 5</option>
                  <option value="Year 6">Year 6</option>
                </select>
              </label>
            </div>

            {student && (
              <div className="verification-box">
                <strong>✓ Student record verified</strong>

                <span>
                  {student.name} ·{" "}
                  {student.registration_number}
                </span>
              </div>
            )}

            {student && applications.length > 0 && (
              <div className="candidate-status-panel">
                <div>
                  <p className="section-kicker">Your applications</p>
                  <h3>Application status</h3>
                </div>

                <div className="candidate-status-list">
                  {applications.map((application) => (
                    <div className="candidate-status-row" key={application.candidate_id}>
                      <div>
                        <strong>{application.election_title}</strong>
                        <span>{application.position} · {application.election_scope}</span>
                        <small>{new Date(application.created_at).toLocaleDateString()}</small>
                      </div>
                      <span className={`status ${application.approval_status.toLowerCase()}`}>
                        {application.approval_status}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>

          {/* SECTION 2 */}
          <section className="application-section">
            <div className="section-heading">
              <span className="section-number">02</span>

              <div>
                <p className="section-kicker">
                  Election details
                </p>

                <h2>Position You Are Contesting</h2>

                <p>
                  Select the election and position for which you
                  are submitting this application.
                </p>
              </div>
            </div>

            <label>
              Election & Position
              <span className="required"> </span>

              <select
                value={electionId}
                onChange={(event) =>
                  setElectionId(event.target.value)
                }
                disabled={elections.length === 0}
                required
              >
                <option value="">
                  {elections.length === 0
                    ? "No open elections available"
                    : "Select an election and position"}
                </option>

                {elections.map((election) => (
                  <option
                    key={election.election_id}
                    value={election.election_id}
                  >
                    {election.title} · {election.position}
                    {election.school_name
                      ? ` · ${election.school_name}`
                      : " · University-wide"}
                  </option>
                ))}
              </select>

              {elections.length === 0 && (
                <span className="field-help empty-field-help">
                  No upcoming or active elections are currently available.
                  An administrator must create an election before applications
                  can be submitted.
                </span>
              )}
            </label>

            {getSelectedElection() && (
              <div className="election-summary">
                <div>
                  <span>Election</span>
                  <strong>
                    {getSelectedElection()?.title}
                  </strong>
                </div>

                <div>
                  <span>Position</span>
                  <strong>
                    {getSelectedElection()?.position}
                  </strong>
                </div>

                <div>
                  <span>Scope</span>
                  <strong>
                    {getSelectedElection()
                      ?.election_scope === "SCHOOL"
                      ? getSelectedElection()?.school_name
                      : "University-wide"}
                  </strong>
                </div>
              </div>
            )}
          </section>

          {/* SECTION 3 */}
          <section className="application-section">
            <div className="section-heading">
              <span className="section-number">03</span>

              <div>
                <p className="section-kicker">
                  Candidate statement
                </p>

                <h2>Your Motivation & Experience</h2>

                <p>
                  Tell the review committee who you are, what
                  motivates you and what experience you bring to
                  leadership.
                </p>
              </div>
            </div>

            <label>
              Why do you want to contest?
              <span className="required"> </span>

              <textarea
                value={motivation}
                onChange={(event) =>
                  setMotivation(event.target.value)
                }
                placeholder="Explain your motivation for contesting this position..."
                rows={6}
                required
              />
              <span className="field-help">
                Explain your personal motivation and what you hope
                to accomplish.
              </span>
            </label>

            <label>
              Leadership Experience
              <span className="required">*</span>

              <textarea
                value={leadershipExperience}
                onChange={(event) =>
                  setLeadershipExperience(event.target.value)
                }
                placeholder="Describe previous leadership roles, responsibilities, clubs, societies, projects or other relevant experience..."
                rows={6}
                required
              />
            </label>
          </section>

          {/* SECTION 4 */}
          <section className="application-section">
            <div className="section-heading">
              <span className="section-number">04</span>

              <div>
                <p className="section-kicker">
                  Leadership programme
                </p>

                <h2>Vision, Priorities & Manifesto</h2>

                <p>
                  Your written programme will form an important
                  part of the application reviewed by the
                  administrators.
                </p>
              </div>
            </div>

            <label>
              Your Vision
              <span className="required">*</span>

              <textarea
                value={vision}
                onChange={(event) =>
                  setVision(event.target.value)
                }
                placeholder="What do you want to achieve if elected?"
                rows={7}
                required
              />
            </label>

            <label>
              Key Priorities
              <span className="required">*</span>

              <textarea
                value={priorities}
                onChange={(event) =>
                  setPriorities(event.target.value)
                }
                placeholder="List and explain the main issues you intend to address..."
                rows={7}
                required
              />
            </label>

            <label>
              Full Manifesto
              <span className="required">*</span>

              <textarea
                className="manifesto-textarea"
                value={manifesto}
                onChange={(event) =>
                  setManifesto(event.target.value)
                }
                placeholder="Write your complete manifesto here. Explain your policies, plans, commitments and proposed programmes..."
                rows={12}
                required
              />

              <span className="field-help">
                Your manifesto should be clear, realistic and
                detailed. It will be available to administrators
                during application review.
              </span>
            </label>
          </section>

          {/* SECTION 5 */}
          <section className="application-section">
            <div className="section-heading">
              <span className="section-number">05</span>

              <div>
                <p className="section-kicker">
                  Candidate identity
                </p>

                <h2>Official Candidate Photograph</h2>

                <p>
                  Upload a clear photograph that can be used to
                  identify you as a candidate.
                </p>
              </div>
            </div>

            <div className="upload-layout">
              <label className="upload-box">
                <span className="upload-title">
                  Candidate Photograph
                  <span className="required">*</span>
                </span>

                <span className="field-help">
                  JPG, PNG or WEBP
                </span>

                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={handlePhotoChange}
                  required
                />

                {photo && (
                  <span className="selected-file">
                    ✓ {photo.name}
                  </span>
                )}
              </label>

              {photoPreview && (
                <div className="photo-preview">
                  <img
                    src={photoPreview}
                    alt="Candidate preview"
                  />
                </div>
              )}
            </div>
          </section>

          {/* SECTION 6 */}
          <section className="application-section">
            <div className="section-heading">
              <span className="section-number">06</span>

              <div>
                <p className="section-kicker">
                  Candidate introduction
                </p>

                <h2>Motivation Video</h2>

                <p>
                  Submit a short video introducing yourself and
                  explaining why you want to serve in the position.
                </p>
              </div>
            </div>

            <label className="upload-box">
              <span className="upload-title">
                Motivation Video
                <span className="required">*</span>
              </span>

              <span className="field-help">
                Accepted formats: MP4 or WEBM. Maximum upload size
                is 50 MB.
              </span>

              <input
                type="file"
                accept="video/mp4,video/webm"
                onChange={handleVideoChange}
                required
              />

              {video && (
                <span className="selected-file">
                  ✓ {video.name}
                </span>
              )}
            </label>

            {videoPreview && (
              <div className="video-preview">
                <video
                  src={videoPreview}
                  controls
                  playsInline
                />
              </div>
            )}
          </section>

          {/* SECTION 7 */}
          <section className="application-section">
            <div className="section-heading">
              <span className="section-number">07</span>

              <div>
                <p className="section-kicker">
                  Eligibility documents
                </p>

                <h2>Financial & Academic Clearance</h2>

                <p>
                  Upload the documents required to demonstrate
                  financial clearance and academic eligibility.
                </p>
              </div>
            </div>

            <div className="document-upload-grid">
              <label className="upload-box">
                <span className="upload-title">
                  Fee Statement
                  <span className="required">*</span>
                </span>

                <span className="field-help">
                  Upload an official statement showing that all
                  outstanding balances have been cleared.
                </span>

                <input
                  type="file"
                  accept=".pdf,image/jpeg,image/png,image/webp"
                  onChange={(event) =>
                    setFeeStatement(
                      event.target.files?.[0] || null
                    )
                  }
                  required
                />

                {feeStatement && (
                  <span className="selected-file">
                    ✓ {feeStatement.name}
                  </span>
                )}
              </label>

              <label className="upload-box">
                <span className="upload-title">
                  Previous Semester Result Slip
                  <span className="required">*</span>
                </span>

                <span className="field-help">
                  Upload your latest official result slip from
                  the previous semester.
                </span>

                <input
                  type="file"
                  accept=".pdf,image/jpeg,image/png,image/webp"
                  onChange={(event) =>
                    setResultSlip(
                      event.target.files?.[0] || null
                    )
                  }
                  required
                />

                {resultSlip && (
                  <span className="selected-file">
                    ✓ {resultSlip.name}
                  </span>
                )}
              </label>
            </div>
          </section>

          {/* SECTION 8 */}
          <section className="application-section review-section">
            <div className="section-heading">
              <span className="section-number">08</span>

              <div>
                <p className="section-kicker">
                  Final review
                </p>

                <h2>Review Your Application</h2>

                <p>
                  Confirm that all information and documents are
                  correct before submitting your candidature.
                </p>
              </div>
            </div>

            <div className="review-grid">
              <div className="review-item">
                <span>Applicant</span>
                <strong>
                  {student?.name || "Not verified"}
                </strong>
              </div>

              <div className="review-item">
                <span>Registration Number</span>
                <strong>
                  {registrationNumber || "Not provided"}
                </strong>
              </div>

              <div className="review-item">
                <span>Phone</span>
                <strong>
                  {phone || "Not provided"}
                </strong>
              </div>

              <div className="review-item">
                <span>Course</span>
                <strong>
                  {course || "Not provided"}
                </strong>
              </div>

              <div className="review-item">
                <span>Election</span>
                <strong>
                  {getSelectedElection()?.title ||
                    "Not selected"}
                </strong>
              </div>

              <div className="review-item">
                <span>Position</span>
                <strong>
                  {getSelectedElection()?.position ||
                    "Not selected"}
                </strong>
              </div>
            </div>

            <div className="document-status-list">
              <div>
                <span>Candidate photograph</span>
                <strong>
                  {photo ? "✓ Selected" : "✗ Missing"}
                </strong>
              </div>

              <div>
                <span>Motivation video</span>
                <strong>
                  {video ? "✓ Selected" : "✗ Missing"}
                </strong>
              </div>

              <div>
                <span>Fee statement</span>
                <strong>
                  {feeStatement
                    ? "✓ Selected"
                    : "✗ Missing"}
                </strong>
              </div>

              <div>
                <span>Previous semester result slip</span>
                <strong>
                  {resultSlip
                    ? "✓ Selected"
                    : "✗ Missing"}
                </strong>
              </div>
            </div>

            <div className="submission-notice">
              <strong>Declaration</strong>

              <p>
                I confirm that the information provided in this
                application is accurate and that the documents
                submitted belong to me. I understand that the
                application will be reviewed by the authorized
                election administrators and that submitting an
                application does not automatically mean that I am
                approved to contest.
              </p>
            </div>
          </section>

          {error && (
            <div className="message error" role="alert">
              <strong>Application error</strong>
              <span>{error}</span>
            </div>
          )}

          {message && (
            <div className="message success" role="status">
              <strong>Application submitted</strong>
              <span>{message}</span>
            </div>
          )}

          <div className="submit-area">
            <button
              className="primary-button submit-application-button"
              type="submit"
              disabled={loading}
            >
              {loading
                ? "Submitting Application..."
                : "Submit Candidate Application"}
            </button>

            <p>
              Your application will remain pending until reviewed
              and approved by an authorized election administrator.
            </p>
          </div>
        </form>
      </section>
    </main>
  );
}
