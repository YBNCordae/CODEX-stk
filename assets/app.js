const STORAGE_KEY = "teaching-demo:v2";

const COURSE_TYPES = [
  { id: "required", label: "Required", coef: 1, price: 120, desc: "Core and foundation courses" },
  { id: "elective", label: "Elective", coef: 0.9, price: 105, desc: "General elective courses" },
  { id: "public", label: "Public", coef: 1.05, price: 112, desc: "Shared public courses" },
  { id: "lab", label: "Lab", coef: 1.2, price: 128, desc: "Labs and computer sessions" },
  { id: "practice", label: "Practice", coef: 1.25, price: 135, desc: "Practice and project courses" },
  { id: "thesis", label: "Thesis", coef: 1.35, price: 150, desc: "Thesis and graduation supervision" },
];

const COURSE_MAP = Object.fromEntries(COURSE_TYPES.map((item) => [item.id, item]));

const SIZE_RULES = [
  { min: 0, max: 39, coef: 1, label: "1-39 students" },
  { min: 40, max: 79, coef: 1.1, label: "40-79 students" },
  { min: 80, max: 119, coef: 1.2, label: "80-119 students" },
  { min: 120, max: Number.POSITIVE_INFINITY, coef: 1.32, label: "120+ students" },
];

const DEPARTMENTS = [
  "Computer Science School",
  "AI School",
  "Information School",
  "Mathematics School",
  "Business School",
  "General Education Center",
];

const STATUS_LABELS = {
  pending: "Pending",
  approved: "Approved",
  returned: "Returned",
};

const STATUS_ORDER = {
  pending: 0,
  returned: 1,
  approved: 2,
};

const DEFAULT_FILTERS = {
  status: "all",
  semester: "all",
  keyword: "",
};

const SEMESTERS = buildSemesterOptions();

let store = loadStore();

const ui = {
  notice: null,
  noticeTimer: null,
  teacherEditId: null,
  adminFilters: { ...DEFAULT_FILTERS },
  selectedIds: new Set(),
  reviewId: null,
  reviewNote: "",
};

const app = document.getElementById("app");

boot();

function boot() {
  window.addEventListener("hashchange", renderApp);
  document.addEventListener("click", handleClick);
  document.addEventListener("submit", handleSubmit);
  document.addEventListener("input", handleInput);
  document.addEventListener("change", handleChange);

  if (!window.location.hash) {
    navigate("/");
    return;
  }

  renderApp();
}

function renderApp() {
  const route = getRoute();
  const user = getCurrentUser();

  if (route === "/teacher" && (!user || user.role !== "teacher")) {
    navigate("/teacher-login");
    return;
  }

  if (route === "/admin" && (!user || user.role !== "admin")) {
    navigate("/admin-login");
    return;
  }

  if ((route === "/teacher-login" || route === "/register/teacher") && user?.role === "teacher") {
    navigate("/teacher");
    return;
  }

  if ((route === "/admin-login" || route === "/register/admin") && user?.role === "admin") {
    navigate("/admin");
    return;
  }

  document.body.dataset.view = resolveViewName(route);

  let page = "";
  if (route === "/") page = renderHome();
  else if (route === "/teacher-login") page = renderLoginPage("teacher");
  else if (route === "/admin-login") page = renderLoginPage("admin");
  else if (route === "/register/teacher") page = renderRegisterPage("teacher");
  else if (route === "/register/admin") page = renderRegisterPage("admin");
  else if (route === "/teacher") page = renderTeacherDashboard(user);
  else if (route === "/admin") page = renderAdminDashboard(user);
  else page = renderNotFound();

  app.innerHTML = `
    <main class="app-shell fade-up">
      ${renderTopbar(user)}
      ${renderNotice()}
      ${page}
      <p class="footer-note">
        This demo stores users, claims and approvals in browser local storage. It is designed to be easy to replace with real SSO, database access and school-specific calculation rules later.
      </p>
    </main>
  `;

  syncClaimPreview();
}

function renderTopbar(user) {
  const dashboardLink = user ? (user.role === "teacher" ? "#/teacher" : "#/admin") : "#/";

  return `
    <header class="topbar">
      <a class="brand" href="#/">
        <span class="brand-mark">TH</span>
        <span class="brand-copy">
          <strong>Teaching Workload Demo</strong>
          <span>Teacher claim / Admin review / Batch export</span>
        </span>
      </a>

      <div class="topbar-actions">
        ${user
          ? `
            <a class="nav-link desktop-only" href="${dashboardLink}">${user.role === "teacher" ? "Teacher desk" : "Admin desk"}</a>
            <span class="segmented-link desktop-only">${escapeHtml(user.role)} | ${escapeHtml(user.name)}</span>
            <button class="button-secondary" type="button" data-action="logout">Log out</button>
          `
          : `
            <a class="nav-link" href="#/teacher-login">Teacher login</a>
            <a class="nav-link" href="#/admin-login">Admin login</a>
          `}
      </div>
    </header>
  `;
}

function renderNotice() {
  if (!ui.notice?.message) return "";
  return `<div class="notice ${ui.notice.type || "info"}">${escapeHtml(ui.notice.message)}</div>`;
}

function renderHome() {
  return `
    <section class="home-grid">
      <article class="hero-panel">
        <div class="hero-copy">
          <span class="eyebrow">Overview</span>
          <h1>A flexible demo for teaching hours and teaching fee review.</h1>
          <p>
            This version focuses on a generic school workflow: separate login pages for teachers and admins, a registration entry, teacher self-service workload claims, admin review, and bulk CSV export.
          </p>
        </div>

        <div class="hero-stats">
          ${renderSummaryCard("Roles", "2", "Teacher and admin with separate entry pages")}
          ${renderSummaryCard("Core flow", "5 steps", "Register, login, claim, review, export")}
          ${renderSummaryCard("Export", "CSV", "Export selected records or current filters")}
          ${renderSummaryCard("Deployment", "Static demo", "No backend required for the first client demo")}
        </div>

        <div class="inline-actions spaced">
          <a class="button" href="#/teacher-login">Open teacher side</a>
          <a class="button-secondary" href="#/admin-login">Open admin side</a>
        </div>
      </article>

      <aside class="stack">
        <article class="role-card teacher-card">
          <span class="panel-kicker">Teacher Side</span>
          <h3>Teacher workflow</h3>
          <p class="muted">Teachers log in, submit teaching claims, view live calculations, and track approval status.</p>
          <ul>
            <li>Separate teacher login page</li>
            <li>Registration entry for new accounts</li>
            <li>Claim form with real-time workload preview</li>
            <li>History list with review notes</li>
          </ul>
          <div class="inline-actions">
            <a class="button" href="#/teacher-login">Teacher login</a>
            <a class="button-ghost" href="#/register/teacher">Teacher register</a>
          </div>
        </article>

        <article class="role-card admin-card">
          <span class="panel-kicker">Admin Side</span>
          <h3>Admin workflow</h3>
          <p class="muted">Admins filter claims, inspect calculation logic, approve or return records, and export data in bulk.</p>
          <ul>
            <li>Separate admin login page</li>
            <li>Review panel with approval note</li>
            <li>Batch approval for selected pending records</li>
            <li>Selected export and filtered export</li>
          </ul>
          <div class="inline-actions">
            <a class="button" href="#/admin-login">Admin login</a>
            <a class="button-ghost" href="#/register/admin">Admin register</a>
          </div>
        </article>
      </aside>
    </section>

    <section class="panel spaced">
      <div class="section-head">
        <div>
          <span class="panel-kicker">Demo Logic</span>
          <h2>Current generic calculation rule</h2>
          <p>This rule is transparent on purpose so it can be replaced later with the school's real policy.</p>
        </div>
      </div>

      <div class="info-grid">
        <div class="story-card">
          <span class="panel-kicker">Formula</span>
          <h3>Workload formula</h3>
          <p class="muted">Settled hours = (weeks x weekly hours + extra hours) x course coefficient x class size coefficient x adjustment coefficient</p>
          <p class="muted">Teaching fee = settled hours x unit price</p>
        </div>

        <div class="story-card">
          <span class="panel-kicker">Course Types</span>
          <ul>
            ${COURSE_TYPES.map((item) => `<li>${escapeHtml(item.label)}: coef ${formatPlain(item.coef)}, price ${formatCurrency(item.price)}</li>`).join("")}
          </ul>
        </div>

        <div class="story-card">
          <span class="panel-kicker">Class Size</span>
          <ul>
            ${SIZE_RULES.map((item) => `<li>${escapeHtml(item.label)}: coef ${formatPlain(item.coef)}</li>`).join("")}
          </ul>
        </div>

        <div class="story-card">
          <span class="panel-kicker">Demo Accounts</span>
          <ul>
            <li>Teacher: `zhang.teacher` / `Demo123!`</li>
            <li>Admin: `admin` / `Demo123!`</li>
            <li>Both roles also support self-registration in demo mode</li>
          </ul>
        </div>
      </div>
    </section>
  `;
}

function renderLoginPage(role) {
  const isTeacher = role === "teacher";

  return `
    <section class="auth-shell">
      <div class="auth-layout">
        <article class="auth-copy">
          <span class="eyebrow">${isTeacher ? "Teacher Login" : "Admin Login"}</span>
          <h1>${isTeacher ? "Teachers can submit workload claims here." : "Admins can review all claims here."}</h1>
          <p>
            ${isTeacher
              ? "Use the teacher portal to report course workload, view fee estimates and track approval results."
              : "Use the admin console to filter records, inspect calculation details, write review notes and export data."}
          </p>
          <div class="panel-grid">
            ${renderStoryCard("Separate entry", "The two roles use different login pages as requested.")}
            ${renderStoryCard("Registration entry", "This demo keeps role-specific registration enabled for easy client review.")}
          </div>
        </article>

        <article class="auth-card">
          <div>
            <span class="panel-kicker">${isTeacher ? "Teacher Portal" : "Admin Console"}</span>
            <h2>${isTeacher ? "Sign in as teacher" : "Sign in as admin"}</h2>
            <p class="panel-subtitle">You can also auto-fill the seeded demo account.</p>
          </div>

          <form id="${role}-login-form" class="stack">
            <label class="field-stack">
              <span class="field-label">Username</span>
              <input name="username" placeholder="${isTeacher ? "zhang.teacher" : "admin"}" autocomplete="username" />
            </label>

            <label class="field-stack">
              <span class="field-label">Password</span>
              <input name="password" type="password" placeholder="Enter password" autocomplete="current-password" />
            </label>

            <div class="inline-actions">
              <button class="button" type="submit">${isTeacher ? "Login teacher side" : "Login admin side"}</button>
              <button class="button-secondary" type="button" data-action="fill-demo" data-role="${role}">Fill demo account</button>
            </div>
          </form>

          <div class="auth-links">
            <a class="ghost-button" href="${isTeacher ? "#/register/teacher" : "#/register/admin"}">Create account</a>
            <a class="ghost-button" href="#/">Back home</a>
          </div>
        </article>
      </div>
    </section>
  `;
}

function renderRegisterPage(role) {
  const isTeacher = role === "teacher";

  return `
    <section class="auth-shell">
      <div class="auth-layout">
        <article class="auth-copy">
          <span class="eyebrow">${isTeacher ? "Teacher Register" : "Admin Register"}</span>
          <h1>${isTeacher ? "Create a teacher account and start claiming." : "Create an admin account for demo review."}</h1>
          <p>
            ${isTeacher
              ? "Teachers are taken directly to the teacher desk after successful registration."
              : "Admin self-registration is only for demo convenience; a real project would often create admin users in the backend."}
          </p>
          <div class="panel-grid">
            ${renderStoryCard("Flexible fields", "Employee number, department and role logic can be replaced later with real organization data.")}
            ${renderStoryCard("Stored locally", "The new account is saved in browser storage so the demo survives page refreshes.")}
          </div>
        </article>

        <article class="auth-card">
          <div>
            <span class="panel-kicker">${isTeacher ? "Teacher Register" : "Admin Register"}</span>
            <h2>${isTeacher ? "Create teacher account" : "Create admin account"}</h2>
            <p class="panel-subtitle">The new account signs in automatically after creation.</p>
          </div>

          <form id="register-form" class="stack" data-role="${role}">
            <div class="field-grid">
              <label class="field-stack">
                <span class="field-label">Name</span>
                <input name="name" placeholder="${isTeacher ? "Teacher name" : "Admin name"}" />
              </label>

              <label class="field-stack">
                <span class="field-label">Username</span>
                <input name="username" placeholder="${isTeacher ? "teacher.username" : "admin.username"}" autocomplete="username" />
              </label>

              <label class="field-stack">
                <span class="field-label">Email</span>
                <input name="email" type="email" placeholder="name@example.edu" autocomplete="email" />
              </label>

              <label class="field-stack">
                <span class="field-label">Password</span>
                <input name="password" type="password" placeholder="At least 6 characters" autocomplete="new-password" />
              </label>

              <label class="field-stack">
                <span class="field-label">${isTeacher ? "Department" : "Office"}</span>
                <select name="department">
                  ${renderSelectOptions(DEPARTMENTS, DEPARTMENTS[0])}
                </select>
              </label>

              <label class="field-stack">
                <span class="field-label">${isTeacher ? "Employee No." : "Admin No."}</span>
                <input name="employeeNo" placeholder="${isTeacher ? "T2026008" : "A2026003"}" />
              </label>
            </div>

            <div class="inline-actions">
              <button class="button" type="submit">${isTeacher ? "Register teacher" : "Register admin"}</button>
              <a class="button-secondary" href="${isTeacher ? "#/teacher-login" : "#/admin-login"}">Back to login</a>
            </div>
          </form>
        </article>
      </div>
    </section>
  `;
}

function renderTeacherDashboard(user) {
  const claims = getTeacherClaims(user.id);
  const stats = getTeacherStats(claims);
  const editing = ui.teacherEditId ? claims.find((item) => item.id === ui.teacherEditId) : null;
  const defaults = getClaimDefaults(editing);

  return `
    <section class="dashboard-intro">
      <div>
        <span class="eyebrow">Teacher Desk</span>
        <h1>${escapeHtml(user.name)}, manage your teaching claims here.</h1>
        <p class="muted">This page covers claim submission, live calculation preview and personal review tracking.</p>
      </div>

      <div class="chip-row">
        <span class="pill">${escapeHtml(user.department)}</span>
        <span class="pill">${escapeHtml(user.employeeNo)}</span>
        <span class="pill">${escapeHtml(guessCurrentSemester())}</span>
      </div>
    </section>

    <section class="summary-grid">
      ${renderSummaryCard("Pending", `${stats.pendingCount} claims`, "Claims waiting for admin review")}
      ${renderSummaryCard("Approved hours", `${formatNumber(stats.approvedHours)} h`, "Approved settled workload only")}
      ${renderSummaryCard("Approved fee", formatCurrency(stats.approvedAmount), "Approved fee total")}
      ${renderSummaryCard("Returned", `${stats.returnedCount} claims`, "Claims sent back for update")}
    </section>

    <section class="dashboard-grid">
      <article class="panel">
        <div class="panel-head">
          <div>
            <span class="panel-kicker">${editing ? "Edit Claim" : "New Claim"}</span>
            <h2>${editing ? "Update and resubmit a claim" : "Submit a new claim"}</h2>
            <p class="panel-subtitle">The right panel updates in real time as the teacher fills the form.</p>
          </div>
        </div>

        <form id="teacher-claim-form" class="stack">
          <div class="field-grid">
            <label class="field-stack">
              <span class="field-label">Semester</span>
              <select name="semester">
                ${renderSelectOptions(SEMESTERS, defaults.semester)}
              </select>
            </label>

            <label class="field-stack">
              <span class="field-label">Course type</span>
              <select name="courseType">
                ${renderCourseTypeOptions(defaults.courseType)}
              </select>
            </label>

            <label class="field-stack">
              <span class="field-label">Course name</span>
              <input name="courseName" value="${escapeHtml(defaults.courseName)}" placeholder="Data Structure" />
            </label>

            <label class="field-stack">
              <span class="field-label">Course code</span>
              <input name="courseCode" value="${escapeHtml(defaults.courseCode)}" placeholder="CS201" />
            </label>

            <label class="field-stack">
              <span class="field-label">Class name</span>
              <input name="className" value="${escapeHtml(defaults.className)}" placeholder="2024 SE Class 1" />
            </label>

            <label class="field-stack">
              <span class="field-label">Students</span>
              <input name="studentCount" type="number" min="1" value="${escapeHtml(String(defaults.studentCount))}" />
            </label>

            <label class="field-stack">
              <span class="field-label">Weeks</span>
              <input name="weeks" type="number" min="1" max="30" value="${escapeHtml(String(defaults.weeks))}" />
            </label>

            <label class="field-stack">
              <span class="field-label">Weekly hours</span>
              <input name="weeklyHours" type="number" min="0.5" step="0.5" value="${escapeHtml(String(defaults.weeklyHours))}" />
            </label>

            <label class="field-stack">
              <span class="field-label">Extra hours</span>
              <input name="extraHours" type="number" min="0" step="0.5" value="${escapeHtml(String(defaults.extraHours))}" />
            </label>

            <label class="field-stack">
              <span class="field-label">Adjustment coef</span>
              <input name="adjustmentCoef" type="number" min="0.5" max="2" step="0.05" value="${escapeHtml(String(defaults.adjustmentCoef))}" />
            </label>
          </div>

          <label class="field-stack">
            <span class="field-label">Remarks</span>
            <textarea name="remarks" placeholder="Add teaching notes, grouping details or special workload context.">${escapeHtml(defaults.remarks)}</textarea>
          </label>

          <div class="inline-actions">
            <button class="button" type="submit">${editing ? "Update and resubmit" : "Submit claim"}</button>
            <button class="button-secondary" type="button" data-action="reset-claim">Reset form</button>
            ${editing ? `<button class="button-ghost" type="button" data-action="cancel-edit">Cancel edit</button>` : ""}
          </div>
        </form>
      </article>

      <aside class="stack">
        <div id="claim-preview">${renderClaimPreview(defaults)}</div>

        <article class="panel">
          <div class="panel-head">
            <div>
              <span class="panel-kicker">Rule Table</span>
              <h2>Current generic rule</h2>
            </div>
          </div>

          <div class="legend-list">
            ${COURSE_TYPES.map(
              (item) => `
                <div class="legend-row">
                  <div>
                    <strong>${escapeHtml(item.label)}</strong>
                    <div class="table-note">${escapeHtml(item.desc)}</div>
                  </div>
                  <div class="text-right">
                    <strong>${formatPlain(item.coef)}</strong>
                    <div class="table-note">${formatCurrency(item.price)}</div>
                  </div>
                </div>
              `
            ).join("")}
          </div>
        </article>
      </aside>
    </section>

    <section class="panel spaced">
      <div class="panel-head">
        <div>
          <span class="panel-kicker">My Claims</span>
          <h2>Claim history</h2>
          <p class="panel-subtitle">Teachers can reopen pending or returned claims and resubmit them.</p>
        </div>
      </div>
      ${renderTeacherTable(claims)}
    </section>
  `;
}

function renderAdminDashboard(user) {
  const allClaims = sortClaims(getClaims());
  const claims = filterClaims(allClaims);
  const stats = getAdminStats(allClaims);
  const reviewItem = getReviewItem(allClaims, claims);
  const selectedCount = claims.filter((item) => ui.selectedIds.has(item.id)).length;
  const allVisibleSelected = claims.length > 0 && claims.every((item) => ui.selectedIds.has(item.id));

  return `
    <section class="dashboard-intro">
      <div>
        <span class="eyebrow">Admin Desk</span>
        <h1>${escapeHtml(user.name)}, review teacher claims here.</h1>
        <p class="muted">This page covers claim filters, approval actions, side-panel review, and CSV export.</p>
      </div>

      <div class="chip-row">
        <span class="pill">${escapeHtml(user.department)}</span>
        <span class="pill">${claims.length} visible</span>
        <span class="pill">${selectedCount} selected</span>
      </div>
    </section>

    <section class="summary-grid">
      ${renderSummaryCard("Pending", `${stats.pendingCount} claims`, "Claims that still need review")}
      ${renderSummaryCard("Approved hours", `${formatNumber(stats.approvedHours)} h`, "Approved settled workload total")}
      ${renderSummaryCard("Approved fee", formatCurrency(stats.approvedAmount), "Approved fee total")}
      ${renderSummaryCard("Teachers", `${stats.teacherCount}`, "Unique teachers with claims in current data")}
    </section>

    <section class="review-grid">
      <article class="panel">
        <div class="panel-head">
          <div>
            <span class="panel-kicker">Review List</span>
            <h2>Claims</h2>
            <p class="panel-subtitle">Filter, select, approve, return and export records from here.</p>
          </div>

          <div class="inline-actions">
            <button class="button-secondary" type="button" data-action="export-filtered" ${claims.length ? "" : "disabled"}>Export filtered</button>
            <button class="button" type="button" data-action="approve-selected" ${selectedCount ? "" : "disabled"}>Approve selected</button>
          </div>
        </div>

        <form id="admin-filter-form">
          <div class="filter-grid">
            <label>
              <span class="field-label">Status</span>
              <select name="status">
                ${renderStatusOptions(ui.adminFilters.status)}
              </select>
            </label>

            <label>
              <span class="field-label">Semester</span>
              <select name="semester">
                ${renderSelectOptions(["all", ...SEMESTERS], ui.adminFilters.semester, { all: "All semesters" })}
              </select>
            </label>

            <label>
              <span class="field-label">Keyword</span>
              <input name="keyword" value="${escapeHtml(ui.adminFilters.keyword)}" placeholder="Teacher, course, class" />
            </label>

            <label>
              <span class="field-label">Selection</span>
              <select disabled>
                <option>${selectedCount ? `${selectedCount} selected` : "No selection"}</option>
              </select>
            </label>
          </div>

          <div class="filter-actions">
            <button class="button-secondary" type="submit">Apply filters</button>
            <button class="button-ghost" type="button" data-action="clear-filters">Clear filters</button>
            <button class="button-secondary" type="button" data-action="export-selected" ${selectedCount ? "" : "disabled"}>Export selected</button>
            <button class="button-danger" type="button" data-action="reset-demo">Reset demo data</button>
          </div>
        </form>

        <div class="spaced">
          ${renderAdminTable(claims, allVisibleSelected)}
        </div>
      </article>

      <aside class="stack">
        <article class="panel">
          <div class="panel-head">
            <div>
              <span class="panel-kicker">Review Panel</span>
              <h2>Approval detail</h2>
              <p class="panel-subtitle">Inspect the formula and write a review note for a single claim.</p>
            </div>
          </div>
          ${renderReviewPanel(reviewItem)}
        </article>

        <article class="panel">
          <div class="panel-head">
            <div>
              <span class="panel-kicker">Export Notes</span>
              <h2>What gets exported</h2>
            </div>
          </div>

          <div class="meta-list">
            <div class="meta-row"><span>Selected export</span><strong>Good for hand-picked batches</strong></div>
            <div class="meta-row"><span>Filtered export</span><strong>Good for semester or status snapshots</strong></div>
            <div class="meta-row"><span>Fields</span><strong>Teacher, course, hours, amount, status, note</strong></div>
          </div>
        </article>
      </aside>
    </section>
  `;
}

function renderTeacherTable(claims) {
  if (!claims.length) {
    return `<div class="empty-state"><p>No claims yet. Submit one above and it will appear here immediately.</p></div>`;
  }

  return `
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Course</th>
            <th>Semester</th>
            <th>Settled hours</th>
            <th>Fee</th>
            <th>Status</th>
            <th>Review note</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          ${claims
            .map(
              (item) => `
                <tr>
                  <td data-label="Course">
                    <div class="table-title">
                      <strong>${escapeHtml(item.courseName)}</strong>
                      <span>${escapeHtml(item.className)} | ${escapeHtml(item.courseCode || "No code")}</span>
                      <span>${escapeHtml(formatDateTime(item.submittedAt))}</span>
                    </div>
                  </td>
                  <td data-label="Semester">
                    <div class="table-title">
                      <strong>${escapeHtml(item.semester)}</strong>
                      <span>${escapeHtml(courseLabel(item.courseType))}</span>
                    </div>
                  </td>
                  <td data-label="Settled hours">
                    <div class="table-title">
                      <strong>${formatNumber(item.settledHours)} h</strong>
                      <span>Base ${formatNumber(item.baseHours)} | Size ${formatPlain(item.sizeCoef)}</span>
                    </div>
                  </td>
                  <td data-label="Fee">${formatCurrency(item.amount)}</td>
                  <td data-label="Status"><span class="status-badge ${escapeHtml(item.status)}">${escapeHtml(statusLabel(item.status))}</span></td>
                  <td data-label="Review note"><span class="table-note">${escapeHtml(item.approvalNote || "No note yet")}</span></td>
                  <td data-label="Action">
                    <div class="inline-actions">
                      ${canEditClaim(item) ? `<button class="mini-button" type="button" data-action="edit-claim" data-id="${item.id}">Edit</button>` : `<button class="mini-button" type="button" disabled>Locked</button>`}
                    </div>
                  </td>
                </tr>
              `
            )
            .join("")}
        </tbody>
      </table>
    </div>
  `;
}

function renderAdminTable(claims, allVisibleSelected) {
  if (!claims.length) {
    return `<div class="empty-state"><p>No records match the current filter.</p></div>`;
  }

  return `
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th class="checkbox-cell"><input type="checkbox" data-role="select-all" ${allVisibleSelected ? "checked" : ""} /></th>
            <th>Teacher</th>
            <th>Course</th>
            <th>Hours</th>
            <th>Amount</th>
            <th>Status</th>
            <th>Submitted</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          ${claims
            .map(
              (item) => `
                <tr>
                  <td data-label="Select" class="checkbox-cell">
                    <input type="checkbox" data-role="select-one" data-id="${item.id}" ${ui.selectedIds.has(item.id) ? "checked" : ""} />
                  </td>
                  <td data-label="Teacher">
                    <div class="table-title">
                      <strong>${escapeHtml(item.teacherName)}</strong>
                      <span>${escapeHtml(item.department)} | ${escapeHtml(item.employeeNo)}</span>
                    </div>
                  </td>
                  <td data-label="Course">
                    <div class="table-title">
                      <strong>${escapeHtml(item.courseName)}</strong>
                      <span>${escapeHtml(item.semester)} | ${escapeHtml(item.className)}</span>
                    </div>
                  </td>
                  <td data-label="Hours">
                    <div class="table-title">
                      <strong>${formatNumber(item.settledHours)} h</strong>
                      <span>Base ${formatNumber(item.baseHours)} | Adj ${formatPlain(item.adjustmentCoef)}</span>
                    </div>
                  </td>
                  <td data-label="Amount">${formatCurrency(item.amount)}</td>
                  <td data-label="Status"><span class="status-badge ${escapeHtml(item.status)}">${escapeHtml(statusLabel(item.status))}</span></td>
                  <td data-label="Submitted">${escapeHtml(formatDateTime(item.submittedAt))}</td>
                  <td data-label="Action">
                    <div class="inline-actions">
                      <button class="mini-button" type="button" data-action="open-review" data-id="${item.id}">Review</button>
                      <button class="mini-button" type="button" data-action="quick-approve" data-id="${item.id}" ${item.status === "approved" ? "disabled" : ""}>Approve</button>
                      <button class="mini-button" type="button" data-action="quick-return" data-id="${item.id}" ${item.status === "returned" ? "disabled" : ""}>Return</button>
                    </div>
                  </td>
                </tr>
              `
            )
            .join("")}
        </tbody>
      </table>
    </div>
  `;
}

function renderReviewPanel(item) {
  if (!item) {
    return `<div class="empty-state"><p>Select a claim from the table to inspect details and submit an approval note.</p></div>`;
  }

  return `
    <div class="stack">
      <div class="detail-box">
        <div class="meta-list">
          <div class="meta-row"><span>Teacher</span><strong>${escapeHtml(item.teacherName)} / ${escapeHtml(item.employeeNo)}</strong></div>
          <div class="meta-row"><span>Course</span><strong>${escapeHtml(item.courseName)}</strong></div>
          <div class="meta-row"><span>Semester</span><strong>${escapeHtml(item.semester)}</strong></div>
          <div class="meta-row"><span>Class</span><strong>${escapeHtml(item.className)}</strong></div>
          <div class="meta-row"><span>Hours</span><strong>${formatNumber(item.settledHours)} h</strong></div>
          <div class="meta-row"><span>Fee</span><strong>${formatCurrency(item.amount)}</strong></div>
        </div>

        <div class="chip-row spaced">
          <span class="formula-chip">Course coef ${formatPlain(item.typeCoef)}</span>
          <span class="formula-chip">Size coef ${formatPlain(item.sizeCoef)}</span>
          <span class="formula-chip">Adj coef ${formatPlain(item.adjustmentCoef)}</span>
          <span class="formula-chip">${escapeHtml(statusLabel(item.status))}</span>
        </div>

        <div class="aside-note spaced">
          <strong>Teacher remarks</strong>
          <p class="muted">${escapeHtml(item.remarks || "No remarks provided.")}</p>
        </div>
      </div>

      <form id="review-form" class="stack" data-id="${item.id}">
        <label class="field-stack">
          <span class="field-label">Approval note</span>
          <textarea name="reviewNote" placeholder="For example: approved under the generic demo rule.">${escapeHtml(ui.reviewNote || item.approvalNote || "")}</textarea>
        </label>

        <div class="helper-row">
          <span>Last reviewed: ${escapeHtml(item.reviewedAt ? formatDateTime(item.reviewedAt) : "Never")}</span>
          <span>Reviewer: ${escapeHtml(item.reviewerName || "None")}</span>
        </div>

        <div class="inline-actions">
          <button class="button" type="submit" name="decision" value="approved" ${item.status === "approved" ? "disabled" : ""}>Approve</button>
          <button class="button-secondary" type="submit" name="decision" value="returned" ${item.status === "returned" ? "disabled" : ""}>Return</button>
        </div>
      </form>
    </div>
  `;
}

function renderClaimPreview(values) {
  const calc = calculateClaim(values);
  const courseType = COURSE_MAP[calc.courseType] || COURSE_TYPES[0];

  return `
    <article class="panel">
      <div class="panel-head">
        <div>
          <span class="panel-kicker">Live Calculator</span>
          <h2>Real-time estimate</h2>
          <p class="panel-subtitle">This preview updates as the teacher edits the form.</p>
        </div>
      </div>

      <div class="formula-box">
        <div class="chip-row">
          <span class="formula-chip">${escapeHtml(courseType.label)}</span>
          <span class="formula-chip">Course ${formatPlain(calc.typeCoef)}</span>
          <span class="formula-chip">Class ${formatPlain(calc.sizeCoef)}</span>
          <span class="formula-chip">Adj ${formatPlain(calc.adjustmentCoef)}</span>
        </div>

        <div class="formula-value">
          <div>
            <span class="tiny-label">Settled hours</span>
            <strong class="mono">${formatNumber(calc.settledHours)}</strong>
          </div>
          <div class="text-right">
            <span class="tiny-label">Teaching fee</span>
            <strong class="mono">${formatCurrency(calc.amount)}</strong>
          </div>
        </div>

        <div class="formula-breakdown">
          <div class="formula-row"><span>Base hours</span><strong>${formatNumber(calc.baseHours)}</strong></div>
          <div class="formula-row"><span>Extra hours</span><strong>${formatNumber(calc.extraHours)}</strong></div>
          <div class="formula-row"><span>Class size band</span><strong>${escapeHtml(calc.sizeBand)}</strong></div>
          <div class="formula-row"><span>Formula</span><strong>(${formatNumber(calc.baseHours)} + ${formatNumber(calc.extraHours)}) x ${formatPlain(calc.typeCoef)} x ${formatPlain(calc.sizeCoef)} x ${formatPlain(calc.adjustmentCoef)}</strong></div>
          <div class="formula-row"><span>Unit price</span><strong>${formatCurrency(calc.unitPrice)}</strong></div>
        </div>
      </div>
    </article>
  `;
}

function renderSummaryCard(label, value, note) {
  return `
    <article class="metric-card">
      <span class="metric-label">${escapeHtml(label)}</span>
      <strong>${escapeHtml(value)}</strong>
      <span>${escapeHtml(note)}</span>
    </article>
  `;
}

function renderStoryCard(title, description) {
  return `
    <article class="story-card">
      <h3>${escapeHtml(title)}</h3>
      <p class="muted">${escapeHtml(description)}</p>
    </article>
  `;
}

function renderNotFound() {
  return `
    <section class="panel spaced">
      <div class="empty-state">
        <p>The requested page does not exist. Please return home or open the teacher/admin entry pages.</p>
      </div>
    </section>
  `;
}

function handleClick(event) {
  const button = event.target.closest("[data-action]");
  if (!button) return;

  const action = button.dataset.action;

  if (action === "logout") {
    store.session = null;
    persistStore();
    ui.teacherEditId = null;
    ui.reviewId = null;
    ui.reviewNote = "";
    ui.selectedIds.clear();
    setNotice("Logged out successfully.", "success");
    navigate("/");
    return;
  }

  if (action === "fill-demo") {
    fillDemoLogin(button.dataset.role);
    return;
  }

  if (action === "reset-claim") {
    ui.teacherEditId = null;
    renderApp();
    return;
  }

  if (action === "cancel-edit") {
    ui.teacherEditId = null;
    renderApp();
    return;
  }

  if (action === "edit-claim") {
    ui.teacherEditId = button.dataset.id;
    window.scrollTo({ top: 0, behavior: "smooth" });
    renderApp();
    return;
  }

  if (action === "open-review") {
    const item = findClaim(button.dataset.id);
    if (!item) return;
    ui.reviewId = item.id;
    ui.reviewNote = item.approvalNote || "";
    renderApp();
    return;
  }

  if (action === "quick-approve") {
    applyReview(button.dataset.id, "approved", ui.reviewId === button.dataset.id ? ui.reviewNote : "");
    return;
  }

  if (action === "quick-return") {
    applyReview(button.dataset.id, "returned", ui.reviewId === button.dataset.id ? ui.reviewNote : "");
    return;
  }

  if (action === "approve-selected") {
    approveSelected();
    return;
  }

  if (action === "export-selected") {
    exportSelected();
    return;
  }

  if (action === "export-filtered") {
    exportFiltered();
    return;
  }

  if (action === "clear-filters") {
    ui.adminFilters = { ...DEFAULT_FILTERS };
    ui.selectedIds.clear();
    renderApp();
    return;
  }

  if (action === "reset-demo") {
    const confirmed = window.confirm("Reset all local demo data and restore the seeded accounts?");
    if (!confirmed) return;

    store = createInitialStore();
    persistStore();
    ui.teacherEditId = null;
    ui.reviewId = null;
    ui.reviewNote = "";
    ui.selectedIds.clear();
    setNotice("Demo data has been reset.", "success");
    navigate("/");
  }
}

function handleSubmit(event) {
  const form = event.target;

  if (form.id === "teacher-login-form") {
    event.preventDefault();
    login(form, "teacher");
    return;
  }

  if (form.id === "admin-login-form") {
    event.preventDefault();
    login(form, "admin");
    return;
  }

  if (form.id === "register-form") {
    event.preventDefault();
    register(form);
    return;
  }

  if (form.id === "teacher-claim-form") {
    event.preventDefault();
    submitClaim(form);
    return;
  }

  if (form.id === "admin-filter-form") {
    event.preventDefault();
    const data = new FormData(form);
    ui.adminFilters = {
      status: String(data.get("status") || "all"),
      semester: String(data.get("semester") || "all"),
      keyword: cleanText(data.get("keyword")),
    };
    renderApp();
    return;
  }

  if (form.id === "review-form") {
    event.preventDefault();
    const decision = event.submitter?.value;
    if (!decision) return;
    const data = new FormData(form);
    applyReview(form.dataset.id, decision, cleanText(data.get("reviewNote")));
  }
}

function handleInput(event) {
  if (event.target.closest("#teacher-claim-form")) {
    syncClaimPreview();
    return;
  }

  if (event.target.name === "reviewNote") {
    ui.reviewNote = event.target.value;
  }
}

function handleChange(event) {
  const target = event.target;

  if (target.dataset.role === "select-one") {
    const id = target.dataset.id;
    if (!id) return;
    if (target.checked) ui.selectedIds.add(id);
    else ui.selectedIds.delete(id);
    renderApp();
    return;
  }

  if (target.dataset.role === "select-all") {
    const ids = filterClaims(sortClaims(getClaims())).map((item) => item.id);
    if (target.checked) ids.forEach((id) => ui.selectedIds.add(id));
    else ids.forEach((id) => ui.selectedIds.delete(id));
    renderApp();
  }
}

function login(form, role) {
  const data = new FormData(form);
  const username = cleanText(data.get("username")).toLowerCase();
  const password = String(data.get("password") || "");

  if (!username || !password) {
    setNotice("Please enter both username and password.", "error");
    return;
  }

  const user = store.users.find(
    (item) => item.role === role && item.username.toLowerCase() === username && item.password === password
  );

  if (!user) {
    setNotice("Incorrect username or password.", "error");
    return;
  }

  store.session = {
    userId: user.id,
    role: user.role,
    loginAt: new Date().toISOString(),
  };

  persistStore();
  setNotice(`Signed in as ${role}.`, "success");
  navigate(role === "teacher" ? "/teacher" : "/admin");
}

function register(form) {
  const role = form.dataset.role;
  const data = new FormData(form);
  const name = cleanText(data.get("name"));
  const username = cleanText(data.get("username"));
  const email = cleanText(data.get("email"));
  const password = String(data.get("password") || "");
  const department = cleanText(data.get("department"));
  const employeeNo = cleanText(data.get("employeeNo"));

  if (!name || !username || !email || !password || !department || !employeeNo) {
    setNotice("Please complete all registration fields.", "error");
    return;
  }

  if (!email.includes("@")) {
    setNotice("Please enter a valid email address.", "error");
    return;
  }

  if (password.length < 6) {
    setNotice("Password must be at least 6 characters.", "error");
    return;
  }

  if (store.users.some((item) => item.username.toLowerCase() === username.toLowerCase())) {
    setNotice("This username already exists.", "error");
    return;
  }

  const user = {
    id: createId(role),
    role,
    name,
    username,
    email,
    password,
    department,
    employeeNo,
    createdAt: new Date().toISOString(),
  };

  store.users.push(user);
  store.session = {
    userId: user.id,
    role: user.role,
    loginAt: new Date().toISOString(),
  };

  persistStore();
  setNotice(`Created and signed in as ${role}.`, "success");
  navigate(role === "teacher" ? "/teacher" : "/admin");
}

function submitClaim(form) {
  const user = getCurrentUser();
  if (!user || user.role !== "teacher") return;

  const existing = ui.teacherEditId ? findClaim(ui.teacherEditId) : null;
  const built = buildClaim(new FormData(form), user, existing);
  if (built.error) {
    setNotice(built.error, "error");
    return;
  }

  const claims = getClaims();
  const nextClaims = existing
    ? claims.map((item) => (item.id === existing.id ? built.record : item))
    : [...claims, built.record];

  setClaims(nextClaims);
  ui.teacherEditId = null;
  setNotice(existing ? "Claim updated and resubmitted." : "Claim submitted successfully.", "success");
  renderApp();
}

function buildClaim(formData, user, existing) {
  const raw = {
    semester: cleanText(formData.get("semester")) || guessCurrentSemester(),
    courseType: cleanText(formData.get("courseType")) || COURSE_TYPES[0].id,
    courseName: cleanText(formData.get("courseName")),
    courseCode: cleanText(formData.get("courseCode")),
    className: cleanText(formData.get("className")),
    studentCount: Number(formData.get("studentCount") || 0),
    weeks: Number(formData.get("weeks") || 0),
    weeklyHours: Number(formData.get("weeklyHours") || 0),
    extraHours: Number(formData.get("extraHours") || 0),
    adjustmentCoef: Number(formData.get("adjustmentCoef") || 1),
    remarks: cleanText(formData.get("remarks")),
  };

  if (!raw.courseName || !raw.className) return { error: "Course name and class name are required." };
  if (!COURSE_MAP[raw.courseType]) return { error: "Invalid course type." };
  if (!Number.isFinite(raw.studentCount) || raw.studentCount < 1) return { error: "Student count must be greater than 0." };
  if (!Number.isFinite(raw.weeks) || raw.weeks < 1 || raw.weeks > 30) return { error: "Weeks must be between 1 and 30." };
  if (!Number.isFinite(raw.weeklyHours) || raw.weeklyHours <= 0) return { error: "Weekly hours must be greater than 0." };
  if (!Number.isFinite(raw.extraHours) || raw.extraHours < 0) return { error: "Extra hours cannot be negative." };
  if (!Number.isFinite(raw.adjustmentCoef) || raw.adjustmentCoef < 0.5 || raw.adjustmentCoef > 2) {
    return { error: "Adjustment coefficient must be between 0.5 and 2." };
  }

  const calc = calculateClaim(raw);
  const now = new Date().toISOString();

  return {
    record: {
      id: existing?.id || createId("claim"),
      teacherId: user.id,
      teacherName: user.name,
      employeeNo: user.employeeNo,
      department: user.department,
      semester: raw.semester,
      courseType: raw.courseType,
      courseName: raw.courseName,
      courseCode: raw.courseCode,
      className: raw.className,
      studentCount: calc.studentCount,
      weeks: calc.weeks,
      weeklyHours: calc.weeklyHours,
      extraHours: calc.extraHours,
      adjustmentCoef: calc.adjustmentCoef,
      baseHours: calc.baseHours,
      typeCoef: calc.typeCoef,
      sizeCoef: calc.sizeCoef,
      sizeBand: calc.sizeBand,
      settledHours: calc.settledHours,
      unitPrice: calc.unitPrice,
      amount: calc.amount,
      remarks: raw.remarks,
      submittedAt: now,
      status: "pending",
      approvalNote: existing?.approvalNote || "",
      reviewedAt: existing?.reviewedAt || "",
      reviewerId: existing?.reviewerId || "",
      reviewerName: existing?.reviewerName || "",
    },
  };
}

function applyReview(id, decision, note) {
  const admin = getCurrentUser();
  if (!admin || admin.role !== "admin") return;

  const claims = getClaims();
  const item = claims.find((entry) => entry.id === id);
  if (!item) return;

  const nextStatus = decision === "approved" ? "approved" : "returned";
  const reviewNote = note || defaultReviewNote(nextStatus);

  setClaims(
    claims.map((entry) =>
      entry.id === id
        ? {
            ...entry,
            status: nextStatus,
            approvalNote: reviewNote,
            reviewedAt: new Date().toISOString(),
            reviewerId: admin.id,
            reviewerName: admin.name,
          }
        : entry
    )
  );

  ui.reviewId = id;
  ui.reviewNote = reviewNote;
  setNotice(nextStatus === "approved" ? "Claim approved." : "Claim returned to teacher.", "success");
  renderApp();
}

function approveSelected() {
  const admin = getCurrentUser();
  if (!admin || admin.role !== "admin") return;

  const claims = getClaims();
  const pendingSelected = claims.filter((item) => ui.selectedIds.has(item.id) && item.status === "pending");
  if (!pendingSelected.length) {
    setNotice("Select at least one pending claim first.", "error");
    return;
  }

  const now = new Date().toISOString();
  const idSet = new Set(pendingSelected.map((item) => item.id));

  setClaims(
    claims.map((item) =>
      idSet.has(item.id)
        ? {
            ...item,
            status: "approved",
            approvalNote: item.approvalNote || "Batch approved.",
            reviewedAt: now,
            reviewerId: admin.id,
            reviewerName: admin.name,
          }
        : item
    )
  );

  setNotice(`Approved ${pendingSelected.length} selected claims.`, "success");
  renderApp();
}

function exportSelected() {
  const items = getClaims().filter((item) => ui.selectedIds.has(item.id));
  if (!items.length) {
    setNotice("Select at least one claim before export.", "error");
    return;
  }

  exportCsv(items, "selected");
  setNotice(`Exported ${items.length} selected claims.`, "success");
}

function exportFiltered() {
  const items = filterClaims(sortClaims(getClaims()));
  if (!items.length) {
    setNotice("There is no data under the current filter.", "error");
    return;
  }

  exportCsv(items, "filtered");
  setNotice(`Exported ${items.length} filtered claims.`, "success");
}

function fillDemoLogin(role) {
  const form = document.getElementById(`${role}-login-form`);
  if (!form) return;

  const userField = form.querySelector("input[name=username]");
  const passField = form.querySelector("input[name=password]");
  if (!userField || !passField) return;

  userField.value = role === "teacher" ? "zhang.teacher" : "admin";
  passField.value = "Demo123!";
}

function syncClaimPreview() {
  const form = document.getElementById("teacher-claim-form");
  const box = document.getElementById("claim-preview");
  if (!form || !box) return;

  box.innerHTML = renderClaimPreview(readClaimDraft(new FormData(form)));
}

function readClaimDraft(formData) {
  return {
    semester: cleanText(formData.get("semester")) || guessCurrentSemester(),
    courseType: cleanText(formData.get("courseType")) || COURSE_TYPES[0].id,
    courseName: cleanText(formData.get("courseName")),
    courseCode: cleanText(formData.get("courseCode")),
    className: cleanText(formData.get("className")),
    studentCount: Number(formData.get("studentCount") || 0),
    weeks: Number(formData.get("weeks") || 16),
    weeklyHours: Number(formData.get("weeklyHours") || 2),
    extraHours: Number(formData.get("extraHours") || 0),
    adjustmentCoef: Number(formData.get("adjustmentCoef") || 1),
    remarks: cleanText(formData.get("remarks")),
  };
}

function calculateClaim(values) {
  const course = COURSE_MAP[values.courseType] || COURSE_TYPES[0];
  const studentCount = toPositiveNumber(values.studentCount);
  const weeks = toPositiveNumber(values.weeks);
  const weeklyHours = toPositiveNumber(values.weeklyHours);
  const extraHours = toNonNegativeNumber(values.extraHours);
  const adjustmentCoef = toPositiveNumber(values.adjustmentCoef) || 1;
  const sizeRule = resolveSizeRule(studentCount);
  const baseHours = round2(weeks * weeklyHours);
  const settledHours = round2((baseHours + extraHours) * course.coef * sizeRule.coef * adjustmentCoef);
  const amount = round2(settledHours * course.price);

  return {
    courseType: course.id,
    studentCount,
    weeks,
    weeklyHours,
    extraHours,
    adjustmentCoef: round2(adjustmentCoef),
    baseHours,
    typeCoef: course.coef,
    sizeCoef: sizeRule.coef,
    sizeBand: sizeRule.label,
    settledHours,
    unitPrice: course.price,
    amount,
  };
}

function filterClaims(claims) {
  const keyword = ui.adminFilters.keyword.trim().toLowerCase();

  return claims.filter((item) => {
    const statusOk = ui.adminFilters.status === "all" || item.status === ui.adminFilters.status;
    const semesterOk = ui.adminFilters.semester === "all" || item.semester === ui.adminFilters.semester;
    const keywordOk =
      !keyword ||
      [item.teacherName, item.courseName, item.className, item.department]
        .join(" ")
        .toLowerCase()
        .includes(keyword);

    return statusOk && semesterOk && keywordOk;
  });
}

function getTeacherClaims(userId) {
  return sortClaims(getClaims().filter((item) => item.teacherId === userId));
}

function getTeacherStats(claims) {
  const approved = claims.filter((item) => item.status === "approved");
  return {
    pendingCount: claims.filter((item) => item.status === "pending").length,
    returnedCount: claims.filter((item) => item.status === "returned").length,
    approvedHours: approved.reduce((sum, item) => sum + item.settledHours, 0),
    approvedAmount: approved.reduce((sum, item) => sum + item.amount, 0),
  };
}

function getAdminStats(claims) {
  const approved = claims.filter((item) => item.status === "approved");
  return {
    pendingCount: claims.filter((item) => item.status === "pending").length,
    approvedHours: approved.reduce((sum, item) => sum + item.settledHours, 0),
    approvedAmount: approved.reduce((sum, item) => sum + item.amount, 0),
    teacherCount: new Set(claims.map((item) => item.teacherId)).size,
  };
}

function getReviewItem(allClaims, filteredClaims) {
  const item = ui.reviewId ? allClaims.find((entry) => entry.id === ui.reviewId) : filteredClaims[0] || null;
  if (item && ui.reviewId !== item.id) {
    ui.reviewId = item.id;
    ui.reviewNote = item.approvalNote || "";
  }
  return item;
}

function sortClaims(claims) {
  return claims
    .slice()
    .sort((a, b) => {
      const order = (STATUS_ORDER[a.status] ?? 99) - (STATUS_ORDER[b.status] ?? 99);
      if (order !== 0) return order;
      return String(b.submittedAt).localeCompare(String(a.submittedAt));
    });
}

function exportCsv(items, scope) {
  const header = [
    "Claim ID",
    "Status",
    "Semester",
    "Teacher",
    "Employee No",
    "Department",
    "Course Name",
    "Course Code",
    "Course Type",
    "Class Name",
    "Students",
    "Weeks",
    "Weekly Hours",
    "Extra Hours",
    "Adjustment Coef",
    "Base Hours",
    "Course Coef",
    "Class Size Coef",
    "Settled Hours",
    "Unit Price",
    "Teaching Fee",
    "Submitted At",
    "Reviewed At",
    "Approval Note",
  ];

  const rows = items.map((item) => [
    item.id,
    statusLabel(item.status),
    item.semester,
    item.teacherName,
    item.employeeNo,
    item.department,
    item.courseName,
    item.courseCode,
    courseLabel(item.courseType),
    item.className,
    item.studentCount,
    item.weeks,
    item.weeklyHours,
    item.extraHours,
    item.adjustmentCoef,
    item.baseHours,
    item.typeCoef,
    item.sizeCoef,
    item.settledHours,
    item.unitPrice,
    item.amount,
    formatDateTime(item.submittedAt),
    formatDateTime(item.reviewedAt),
    item.approvalNote,
  ]);

  const csv = ["\ufeff" + header.map(csvEscape).join(",")]
    .concat(rows.map((row) => row.map(csvEscape).join(",")))
    .join("\n");

  downloadBlob(new Blob([csv], { type: "text/csv;charset=utf-8" }), `teaching-demo-${scope}-${formatDateForFile(new Date())}.csv`);
}

function loadStore() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      const initial = createInitialStore();
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(initial));
      return initial;
    }

    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.users)) throw new Error("Invalid storage");
    if (!Array.isArray(parsed.claims) && Array.isArray(parsed.submissions)) parsed.claims = parsed.submissions;
    if (!Array.isArray(parsed.claims)) throw new Error("Invalid claims");
    return parsed;
  } catch (_) {
    const initial = createInitialStore();
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(initial));
    } catch (_) {}
    return initial;
  }
}

function persistStore() {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch (_) {}
}

function createInitialStore() {
  const users = [
    {
      id: "admin-001",
      role: "admin",
      name: "Academic Admin",
      username: "admin",
      email: "admin@demo.edu",
      password: "Demo123!",
      department: "Academic Affairs Office",
      employeeNo: "A2026001",
      createdAt: "2026-03-27T08:00:00.000Z",
    },
    {
      id: "teacher-001",
      role: "teacher",
      name: "Zhang Chen",
      username: "zhang.teacher",
      email: "zhang@demo.edu",
      password: "Demo123!",
      department: "Computer Science School",
      employeeNo: "T2026001",
      createdAt: "2026-03-27T08:03:00.000Z",
    },
    {
      id: "teacher-002",
      role: "teacher",
      name: "Li Min",
      username: "li.teacher",
      email: "li@demo.edu",
      password: "Demo123!",
      department: "AI School",
      employeeNo: "T2026002",
      createdAt: "2026-03-27T08:06:00.000Z",
    },
  ];

  const claims = [
    seedClaim({
      id: "claim-1001",
      teacherId: "teacher-001",
      teacherName: "Zhang Chen",
      employeeNo: "T2026001",
      department: "Computer Science School",
      semester: "2025-2026-2",
      courseType: "required",
      courseName: "Data Structure",
      courseCode: "CS201",
      className: "2024 Software Engineering Class 1",
      studentCount: 68,
      weeks: 16,
      weeklyHours: 4,
      extraHours: 2,
      adjustmentCoef: 1,
      remarks: "Includes Q and A and lab support hours.",
      submittedAt: "2026-03-10T01:30:00.000Z",
      status: "approved",
      approvalNote: "Approved under the generic demo rule.",
      reviewedAt: "2026-03-11T02:10:00.000Z",
      reviewerId: "admin-001",
      reviewerName: "Academic Admin",
    }),
    seedClaim({
      id: "claim-1002",
      teacherId: "teacher-001",
      teacherName: "Zhang Chen",
      employeeNo: "T2026001",
      department: "Computer Science School",
      semester: "2025-2026-2",
      courseType: "lab",
      courseName: "Programming Lab",
      courseCode: "CS210L",
      className: "2024 Computer Science Class 2",
      studentCount: 42,
      weeks: 12,
      weeklyHours: 2,
      extraHours: 4,
      adjustmentCoef: 1.05,
      remarks: "Extra setup and grouped lab support.",
      submittedAt: "2026-03-16T08:20:00.000Z",
      status: "pending",
      approvalNote: "",
      reviewedAt: "",
      reviewerId: "",
      reviewerName: "",
    }),
    seedClaim({
      id: "claim-1003",
      teacherId: "teacher-002",
      teacherName: "Li Min",
      employeeNo: "T2026002",
      department: "AI School",
      semester: "2025-2026-2",
      courseType: "practice",
      courseName: "Machine Learning Project",
      courseCode: "AI309P",
      className: "2023 AI Class 1",
      studentCount: 84,
      weeks: 8,
      weeklyHours: 4,
      extraHours: 6,
      adjustmentCoef: 1.1,
      remarks: "Project review and staged defense included.",
      submittedAt: "2026-03-18T03:45:00.000Z",
      status: "returned",
      approvalNote: "Please add project grouping details before resubmitting.",
      reviewedAt: "2026-03-19T05:00:00.000Z",
      reviewerId: "admin-001",
      reviewerName: "Academic Admin",
    }),
  ];

  return {
    version: 2,
    users,
    claims,
    session: null,
  };
}

function seedClaim(values) {
  const calc = calculateClaim(values);
  return {
    id: values.id,
    teacherId: values.teacherId,
    teacherName: values.teacherName,
    employeeNo: values.employeeNo,
    department: values.department,
    semester: values.semester,
    courseType: values.courseType,
    courseName: values.courseName,
    courseCode: values.courseCode,
    className: values.className,
    studentCount: calc.studentCount,
    weeks: calc.weeks,
    weeklyHours: calc.weeklyHours,
    extraHours: calc.extraHours,
    adjustmentCoef: calc.adjustmentCoef,
    baseHours: calc.baseHours,
    typeCoef: calc.typeCoef,
    sizeCoef: calc.sizeCoef,
    sizeBand: calc.sizeBand,
    settledHours: calc.settledHours,
    unitPrice: calc.unitPrice,
    amount: calc.amount,
    remarks: values.remarks || "",
    submittedAt: values.submittedAt,
    status: values.status,
    approvalNote: values.approvalNote || "",
    reviewedAt: values.reviewedAt || "",
    reviewerId: values.reviewerId || "",
    reviewerName: values.reviewerName || "",
  };
}

function getClaims() {
  if (!Array.isArray(store.claims) && Array.isArray(store.submissions)) store.claims = store.submissions;
  if (!Array.isArray(store.claims)) store.claims = [];
  return store.claims;
}

function setClaims(nextClaims) {
  store.claims = nextClaims;
  delete store.submissions;
  persistStore();
}

function findClaim(id) {
  return getClaims().find((item) => item.id === id) || null;
}

function getCurrentUser() {
  if (!store.session?.userId) return null;
  return store.users.find((item) => item.id === store.session.userId) || null;
}

function getClaimDefaults(item) {
  if (item) {
    return {
      semester: item.semester,
      courseType: item.courseType,
      courseName: item.courseName,
      courseCode: item.courseCode,
      className: item.className,
      studentCount: item.studentCount,
      weeks: item.weeks,
      weeklyHours: item.weeklyHours,
      extraHours: item.extraHours,
      adjustmentCoef: item.adjustmentCoef,
      remarks: item.remarks,
    };
  }

  return {
    semester: guessCurrentSemester(),
    courseType: "required",
    courseName: "",
    courseCode: "",
    className: "",
    studentCount: 40,
    weeks: 16,
    weeklyHours: 2,
    extraHours: 0,
    adjustmentCoef: 1,
    remarks: "",
  };
}

function canEditClaim(item) {
  return item.status === "pending" || item.status === "returned";
}

function resolveSizeRule(studentCount) {
  return SIZE_RULES.find((rule) => studentCount >= rule.min && studentCount <= rule.max) || SIZE_RULES[0];
}

function buildSemesterOptions() {
  const year = new Date().getFullYear();
  return [`${year - 1}-${year}-1`, `${year - 1}-${year}-2`, `${year}-${year + 1}-1`, `${year}-${year + 1}-2`];
}

function guessCurrentSemester() {
  const now = new Date();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();
  return month >= 8 ? `${year}-${year + 1}-1` : `${year - 1}-${year}-2`;
}

function resolveViewName(route) {
  if (route === "/teacher") return "teacher-dashboard";
  if (route === "/admin") return "admin-dashboard";
  if (route === "/teacher-login" || route === "/register/teacher") return "teacher-auth";
  if (route === "/admin-login" || route === "/register/admin") return "admin-auth";
  return "home";
}

function getRoute() {
  const raw = window.location.hash.replace(/^#/, "").trim();
  return raw || "/";
}

function navigate(route) {
  window.location.hash = route;
}

function setNotice(message, type = "info") {
  ui.notice = { message, type };
  if (ui.noticeTimer) window.clearTimeout(ui.noticeTimer);
  ui.noticeTimer = window.setTimeout(() => {
    ui.notice = null;
    renderApp();
  }, 3200);
}

function statusLabel(status) {
  return STATUS_LABELS[status] || "Unknown";
}

function courseLabel(type) {
  return COURSE_MAP[type]?.label || "Unknown";
}

function defaultReviewNote(status) {
  return status === "approved" ? "Approved under the generic demo rule." : "Please update the claim and resubmit.";
}

function renderSelectOptions(values, selected, labelMap = {}) {
  return values
    .map((value) => `<option value="${escapeHtml(value)}" ${value === selected ? "selected" : ""}>${escapeHtml(labelMap[value] || value)}</option>`)
    .join("");
}

function renderCourseTypeOptions(selected) {
  return COURSE_TYPES.map(
    (item) => `<option value="${item.id}" ${item.id === selected ? "selected" : ""}>${escapeHtml(item.label)} | coef ${formatPlain(item.coef)}</option>`
  ).join("");
}

function renderStatusOptions(selected) {
  return [
    { value: "all", label: "All statuses" },
    { value: "pending", label: "Pending" },
    { value: "approved", label: "Approved" },
    { value: "returned", label: "Returned" },
  ]
    .map((item) => `<option value="${item.value}" ${item.value === selected ? "selected" : ""}>${escapeHtml(item.label)}</option>`)
    .join("");
}

function createId(prefix) {
  return `${prefix}-${Math.random().toString(36).slice(2, 8)}${Date.now().toString(36).slice(-6)}`;
}

function cleanText(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function toPositiveNumber(value) {
  const num = Number(value);
  return Number.isFinite(num) && num > 0 ? num : 0;
}

function toNonNegativeNumber(value) {
  const num = Number(value);
  return Number.isFinite(num) && num >= 0 ? num : 0;
}

function round2(value) {
  return Math.round(Number(value || 0) * 100) / 100;
}

function formatPlain(value) {
  return Number.isFinite(value) ? Number(value).toFixed(2) : "0.00";
}

function formatNumber(value) {
  return Number.isFinite(value) ? Number(value).toFixed(2) : "0.00";
}

function formatCurrency(value) {
  return `RMB ${Number(value || 0).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatDateTime(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  const hh = String(date.getHours()).padStart(2, "0");
  const mi = String(date.getMinutes()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd} ${hh}:${mi}`;
}

function formatDateForFile(date) {
  return `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, "0")}${String(date.getDate()).padStart(2, "0")}`;
}

function csvEscape(value) {
  const text = String(value ?? "");
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, "\"\"")}"` : text;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
