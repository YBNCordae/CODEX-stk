const STORAGE_KEY = "teaching-demo:v2";

const COURSE_TYPES = [
  { id: "required", label: "必修课", coef: 1, price: 120, desc: "专业主干课和基础课" },
  { id: "elective", label: "选修课", coef: 0.9, price: 105, desc: "面向选修模块的课程" },
  { id: "public", label: "公共课", coef: 1.05, price: 112, desc: "跨院系共享课程和公共课程" },
  { id: "lab", label: "实验课", coef: 1.2, price: 128, desc: "实验和上机类课程" },
  { id: "practice", label: "实践课", coef: 1.25, price: 135, desc: "实训和项目制课程" },
  { id: "thesis", label: "毕业设计", coef: 1.35, price: 150, desc: "毕业设计与论文指导" },
];

const COURSE_MAP = Object.fromEntries(COURSE_TYPES.map((item) => [item.id, item]));

const SIZE_RULES = [
  { min: 0, max: 39, coef: 1, label: "1-39人" },
  { min: 40, max: 79, coef: 1.1, label: "40-79人" },
  { min: 80, max: 119, coef: 1.2, label: "80-119人" },
  { min: 120, max: Number.POSITIVE_INFINITY, coef: 1.32, label: "120人及以上" },
];

const DEPARTMENTS = [
  "计算机学院",
  "人工智能学院",
  "信息工程学院",
  "数学与统计学院",
  "经济管理学院",
  "公共基础教学部",
];

const STATUS_LABELS = {
  pending: "待审批",
  approved: "已通过",
  returned: "已退回",
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
          <strong>课时申报与审批演示系统</strong>
          <span>教师申报 / 管理员审批 / 批量导出</span>
        </span>
      </a>

      <div class="topbar-actions">
        ${user
          ? `
            <a class="nav-link desktop-only" href="${dashboardLink}">${user.role === "teacher" ? "教师工作台" : "管理员工作台"}</a>
            <span class="segmented-link desktop-only">${escapeHtml(user.role === "teacher" ? "教师" : "管理员")} | ${escapeHtml(user.name)}</span>
            <button class="button-secondary" type="button" data-action="logout">退出登录</button>
          `
          : `
            <a class="nav-link" href="#/teacher-login">教师登录</a>
            <a class="nav-link" href="#/admin-login">管理员登录</a>
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
          <span class="eyebrow">系统概览</span>
          <h1>一套适合学校内部使用的课时申报与课时费审批演示系统。</h1>
          <p>
            当前版本先围绕通用学校场景搭建：教师与管理员分开登录，支持注册入口、教师自主申报课时、管理员审批，以及批量导出数据。
          </p>
        </div>

        <div class="hero-stats">
          ${renderSummaryCard("角色数量", "2个", "教师与管理员拥有独立入口")}
          ${renderSummaryCard("核心流程", "5步", "注册、登录、申报、审批、导出")}
          ${renderSummaryCard("导出格式", "CSV", "支持导出选中记录或筛选结果")}
          ${renderSummaryCard("部署形态", "静态演示版", "无需后端即可先做客户演示")}
        </div>

        <div class="inline-actions spaced">
          <a class="button" href="#/teacher-login">进入教师端</a>
          <a class="button-secondary" href="#/admin-login">进入管理员端</a>
        </div>
      </article>

      <aside class="stack">
        <article class="role-card teacher-card">
          <span class="panel-kicker">教师端</span>
          <h3>教师申报流程</h3>
          <p class="muted">教师登录后可填写课时申报，查看实时测算结果，并持续跟踪审批状态。</p>
          <ul>
            <li>独立教师登录页</li>
            <li>支持教师注册</li>
            <li>申报表单带实时测算</li>
            <li>可查看历史记录和审批意见</li>
          </ul>
          <div class="inline-actions">
            <a class="button" href="#/teacher-login">教师登录</a>
            <a class="button-ghost" href="#/register/teacher">教师注册</a>
          </div>
        </article>

        <article class="role-card admin-card">
          <span class="panel-kicker">管理员端</span>
          <h3>管理员审批流程</h3>
          <p class="muted">管理员可筛选申报记录、查看计算依据、审批或退回，并按批量导出数据。</p>
          <ul>
            <li>独立管理员登录页</li>
            <li>审批侧栏支持填写意见</li>
            <li>支持批量通过待审批记录</li>
            <li>支持按选中或筛选结果导出</li>
          </ul>
          <div class="inline-actions">
            <a class="button" href="#/admin-login">管理员登录</a>
            <a class="button-ghost" href="#/register/admin">管理员注册</a>
          </div>
        </article>
      </aside>
    </section>

    <section class="panel spaced">
      <div class="section-head">
        <div>
          <span class="panel-kicker">演示逻辑</span>
          <h2>当前采用的通用计算规则</h2>
          <p>这套规则故意做得透明易懂，方便后续直接替换为学校正式制度。</p>
        </div>
      </div>

      <div class="info-grid">
        <div class="story-card">
          <span class="panel-kicker">公式</span>
          <h3>课时计算方式</h3>
          <p class="muted">折算课时 = (周数 × 周学时 + 额外课时) × 课程系数 × 人数系数 × 调节系数</p>
          <p class="muted">课时费 = 折算课时 x 课时单价</p>
        </div>

        <div class="story-card">
          <span class="panel-kicker">课程类型</span>
          <ul>
            ${COURSE_TYPES.map((item) => `<li>${escapeHtml(item.label)}：系数 ${formatPlain(item.coef)}，单价 ${formatCurrency(item.price)}</li>`).join("")}
          </ul>
        </div>

        <div class="story-card">
          <span class="panel-kicker">人数规则</span>
          <ul>
            ${SIZE_RULES.map((item) => `<li>${escapeHtml(item.label)}：系数 ${formatPlain(item.coef)}</li>`).join("")}
          </ul>
        </div>

        <div class="story-card">
          <span class="panel-kicker">演示账号</span>
          <ul>
            <li>教师：<code>zhang.teacher</code> / <code>Demo123!</code></li>
            <li>管理员：<code>admin</code> / <code>Demo123!</code></li>
            <li>当前也支持教师和管理员自行注册账号</li>
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
          <span class="eyebrow">${isTeacher ? "教师登录" : "管理员登录"}</span>
          <h1>${isTeacher ? "教师在这里提交课时申报。" : "管理员在这里完成审批操作。"}</h1>
          <p>
            ${isTeacher
              ? "教师端用于填写课时量、查看课时费测算结果，并跟踪审批状态。"
              : "管理员端用于筛选申报记录、查看计算细节、填写审批意见并导出数据。"}
          </p>
          <div class="panel-grid">
            ${renderStoryCard("入口独立", "教师和管理员使用不同登录页，符合当前需求。")}
            ${renderStoryCard("注册可用", "为方便演示，当前版本保留了角色对应的注册入口。")}
          </div>
        </article>

        <article class="auth-card">
          <div>
            <span class="panel-kicker">${isTeacher ? "教师入口" : "管理员入口"}</span>
            <h2>${isTeacher ? "登录教师端" : "登录管理员端"}</h2>
            <p class="panel-subtitle">也可以一键填入内置演示账号。</p>
          </div>

          <form id="${role}-login-form" class="stack">
            <label class="field-stack">
              <span class="field-label">用户名</span>
              <input name="username" placeholder="${isTeacher ? "zhang.teacher" : "admin"}" autocomplete="username" />
            </label>

            <label class="field-stack">
              <span class="field-label">密码</span>
              <input name="password" type="password" placeholder="请输入密码" autocomplete="current-password" />
            </label>

            <div class="inline-actions">
              <button class="button" type="submit">${isTeacher ? "登录教师端" : "登录管理员端"}</button>
              <button class="button-secondary" type="button" data-action="fill-demo" data-role="${role}">填入演示账号</button>
            </div>
          </form>

          <div class="auth-links">
            <a class="ghost-button" href="${isTeacher ? "#/register/teacher" : "#/register/admin"}">创建账号</a>
            <a class="ghost-button" href="#/">返回首页</a>
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
          <span class="eyebrow">${isTeacher ? "教师注册" : "管理员注册"}</span>
          <h1>${isTeacher ? "创建教师账号后即可开始申报。" : "创建管理员账号后即可开始审批演示。"}</h1>
          <p>
            ${isTeacher
              ? "教师注册成功后会自动进入教师工作台。"
              : "管理员自助注册仅用于当前演示版体验，正式项目通常由后台统一创建管理员账号。"}
          </p>
          <div class="panel-grid">
            ${renderStoryCard("字段可扩展", "工号、院系和角色逻辑后续都可以替换成真实组织数据。")}
            ${renderStoryCard("本地保存", "新账号保存在当前浏览器中，刷新页面后仍然有效。")}
          </div>
        </article>

        <article class="auth-card">
          <div>
            <span class="panel-kicker">${isTeacher ? "教师注册" : "管理员注册"}</span>
            <h2>${isTeacher ? "创建教师账号" : "创建管理员账号"}</h2>
            <p class="panel-subtitle">创建成功后会自动登录。</p>
          </div>

          <form id="register-form" class="stack" data-role="${role}">
            <div class="field-grid">
              <label class="field-stack">
                <span class="field-label">姓名</span>
                <input name="name" placeholder="${isTeacher ? "请输入教师姓名" : "请输入管理员姓名"}" />
              </label>

              <label class="field-stack">
                <span class="field-label">用户名</span>
                <input name="username" placeholder="${isTeacher ? "teacher.username" : "admin.username"}" autocomplete="username" />
              </label>

              <label class="field-stack">
                <span class="field-label">邮箱</span>
                <input name="email" type="email" placeholder="name@example.edu" autocomplete="email" />
              </label>

              <label class="field-stack">
                <span class="field-label">密码</span>
                <input name="password" type="password" placeholder="至少6位字符" autocomplete="new-password" />
              </label>

              <label class="field-stack">
                <span class="field-label">${isTeacher ? "所属院系" : "所属部门"}</span>
                <select name="department">
                  ${renderSelectOptions(DEPARTMENTS, DEPARTMENTS[0])}
                </select>
              </label>

              <label class="field-stack">
                <span class="field-label">${isTeacher ? "教师工号" : "管理员编号"}</span>
                <input name="employeeNo" placeholder="${isTeacher ? "T2026008" : "A2026003"}" />
              </label>
            </div>

            <div class="inline-actions">
              <button class="button" type="submit">${isTeacher ? "注册教师账号" : "注册管理员账号"}</button>
              <a class="button-secondary" href="${isTeacher ? "#/teacher-login" : "#/admin-login"}">返回登录</a>
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
        <span class="eyebrow">教师工作台</span>
        <h1>${escapeHtml(user.name)}，在这里管理你的课时申报。</h1>
        <p class="muted">当前页面包含课时申报、实时测算预览和个人审批跟踪。</p>
      </div>

      <div class="chip-row">
        <span class="pill">${escapeHtml(user.department)}</span>
        <span class="pill">${escapeHtml(user.employeeNo)}</span>
        <span class="pill">${escapeHtml(guessCurrentSemester())}</span>
      </div>
    </section>

    <section class="summary-grid">
      ${renderSummaryCard("待审批", `${stats.pendingCount} 条`, "等待管理员处理的申报记录")}
      ${renderSummaryCard("已通过课时", `${formatNumber(stats.approvedHours)} 课时`, "仅统计审批通过的折算课时")}
      ${renderSummaryCard("已通过课时费", formatCurrency(stats.approvedAmount), "仅统计审批通过的课时费")}
      ${renderSummaryCard("已退回", `${stats.returnedCount} 条`, "被退回后可重新编辑并提交")}
    </section>

    <section class="dashboard-grid">
      <article class="panel">
        <div class="panel-head">
          <div>
            <span class="panel-kicker">${editing ? "编辑申报" : "新增申报"}</span>
            <h2>${editing ? "修改并重新提交课时申报" : "提交新的课时申报"}</h2>
            <p class="panel-subtitle">教师填写表单时，右侧会同步显示实时测算结果。</p>
          </div>
        </div>

        <form id="teacher-claim-form" class="stack">
          <div class="field-grid">
            <label class="field-stack">
              <span class="field-label">学期</span>
              <select name="semester">
                ${renderSelectOptions(SEMESTERS, defaults.semester)}
              </select>
            </label>

            <label class="field-stack">
              <span class="field-label">课程类型</span>
              <select name="courseType">
                ${renderCourseTypeOptions(defaults.courseType)}
              </select>
            </label>

            <label class="field-stack">
              <span class="field-label">课程名称</span>
              <input name="courseName" value="${escapeHtml(defaults.courseName)}" placeholder="例如：数据结构" />
            </label>

            <label class="field-stack">
              <span class="field-label">课程代码</span>
              <input name="courseCode" value="${escapeHtml(defaults.courseCode)}" placeholder="CS201" />
            </label>

            <label class="field-stack">
              <span class="field-label">教学班名称</span>
              <input name="className" value="${escapeHtml(defaults.className)}" placeholder="例如：2024级软件工程1班" />
            </label>

            <label class="field-stack">
              <span class="field-label">学生人数</span>
              <input name="studentCount" type="number" min="1" value="${escapeHtml(String(defaults.studentCount))}" />
            </label>

            <label class="field-stack">
              <span class="field-label">授课周数</span>
              <input name="weeks" type="number" min="1" max="30" value="${escapeHtml(String(defaults.weeks))}" />
            </label>

            <label class="field-stack">
              <span class="field-label">周学时</span>
              <input name="weeklyHours" type="number" min="0.5" step="0.5" value="${escapeHtml(String(defaults.weeklyHours))}" />
            </label>

            <label class="field-stack">
              <span class="field-label">额外课时</span>
              <input name="extraHours" type="number" min="0" step="0.5" value="${escapeHtml(String(defaults.extraHours))}" />
            </label>

            <label class="field-stack">
              <span class="field-label">调节系数</span>
              <input name="adjustmentCoef" type="number" min="0.5" max="2" step="0.05" value="${escapeHtml(String(defaults.adjustmentCoef))}" />
            </label>
          </div>

          <label class="field-stack">
            <span class="field-label">备注说明</span>
            <textarea name="remarks" placeholder="可填写授课形式、分组情况或特殊工作量说明。">${escapeHtml(defaults.remarks)}</textarea>
          </label>

          <div class="inline-actions">
            <button class="button" type="submit">${editing ? "更新并重新提交" : "提交申报"}</button>
            <button class="button-secondary" type="button" data-action="reset-claim">重置表单</button>
            ${editing ? `<button class="button-ghost" type="button" data-action="cancel-edit">取消编辑</button>` : ""}
          </div>
        </form>
      </article>

      <aside class="stack">
        <div id="claim-preview">${renderClaimPreview(defaults)}</div>

        <article class="panel">
          <div class="panel-head">
            <div>
              <span class="panel-kicker">规则说明</span>
              <h2>当前通用规则</h2>
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
          <span class="panel-kicker">我的申报</span>
          <h2>申报记录</h2>
          <p class="panel-subtitle">待审批和已退回的记录都可以再次编辑并重新提交。</p>
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
        <span class="eyebrow">管理员工作台</span>
        <h1>${escapeHtml(user.name)}，在这里审核教师提交的课时申报。</h1>
        <p class="muted">当前页面包含记录筛选、审批动作、侧栏详情查看以及 CSV 导出。</p>
      </div>

      <div class="chip-row">
        <span class="pill">${escapeHtml(user.department)}</span>
        <span class="pill">${claims.length} visible</span>
        <span class="pill">${selectedCount} selected</span>
      </div>
    </section>

    <section class="summary-grid">
      ${renderSummaryCard("待审批", `${stats.pendingCount} 条`, "当前仍需审核的申报记录")}
      ${renderSummaryCard("已通过课时", `${formatNumber(stats.approvedHours)} 课时`, "所有审批通过记录的折算课时总和")}
      ${renderSummaryCard("已通过课时费", formatCurrency(stats.approvedAmount), "所有审批通过记录的课时费总和")}
      ${renderSummaryCard("涉及教师", `${stats.teacherCount} 人`, "当前数据中提交过申报的教师人数")}
    </section>

    <section class="review-grid">
      <article class="panel">
        <div class="panel-head">
          <div>
            <span class="panel-kicker">审批列表</span>
            <h2>申报记录</h2>
            <p class="panel-subtitle">可在这里筛选、勾选、审批、退回和导出记录。</p>
          </div>

          <div class="inline-actions">
            <button class="button-secondary" type="button" data-action="export-filtered" ${claims.length ? "" : "disabled"}>导出筛选结果</button>
            <button class="button" type="button" data-action="approve-selected" ${selectedCount ? "" : "disabled"}>批量通过选中项</button>
          </div>
        </div>

        <form id="admin-filter-form">
          <div class="filter-grid">
            <label>
              <span class="field-label">状态</span>
              <select name="status">
                ${renderStatusOptions(ui.adminFilters.status)}
              </select>
            </label>

            <label>
              <span class="field-label">学期</span>
              <select name="semester">
                ${renderSelectOptions(["all", ...SEMESTERS], ui.adminFilters.semester, { all: "All semesters" })}
              </select>
            </label>

            <label>
              <span class="field-label">关键词</span>
              <input name="keyword" value="${escapeHtml(ui.adminFilters.keyword)}" placeholder="教师、课程、教学班" />
            </label>

            <label>
              <span class="field-label">已选记录</span>
              <select disabled>
                <option>${selectedCount ? `已选中 ${selectedCount} 条` : "未选择任何记录"}</option>
              </select>
            </label>
          </div>

          <div class="filter-actions">
            <button class="button-secondary" type="submit">应用筛选</button>
            <button class="button-ghost" type="button" data-action="clear-filters">清空筛选</button>
            <button class="button-secondary" type="button" data-action="export-selected" ${selectedCount ? "" : "disabled"}>导出选中记录</button>
            <button class="button-danger" type="button" data-action="reset-demo">重置演示数据</button>
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
              <span class="panel-kicker">审批详情</span>
              <h2>单条记录审核</h2>
              <p class="panel-subtitle">查看计算公式和教师说明，并填写审批意见。</p>
            </div>
          </div>
          ${renderReviewPanel(reviewItem)}
        </article>

        <article class="panel">
          <div class="panel-head">
            <div>
              <span class="panel-kicker">导出说明</span>
              <h2>导出内容</h2>
            </div>
          </div>

          <div class="meta-list">
            <div class="meta-row"><span>导出选中记录</span><strong>适合导出指定批次</strong></div>
            <div class="meta-row"><span>导出筛选结果</span><strong>适合按学期或状态汇总</strong></div>
            <div class="meta-row"><span>主要字段</span><strong>教师、课程、课时、金额、状态、审批意见</strong></div>
          </div>
        </article>
      </aside>
    </section>
  `;
}

function renderTeacherTable(claims) {
  if (!claims.length) {
    return `<div class="empty-state"><p>当前还没有申报记录。你提交后会立即显示在这里。</p></div>`;
  }

  return `
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>课程信息</th>
            <th>学期</th>
            <th>折算课时</th>
            <th>课时费</th>
            <th>状态</th>
            <th>审批意见</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          ${claims
            .map(
              (item) => `
                <tr>
                  <td data-label="课程信息">
                    <div class="table-title">
                      <strong>${escapeHtml(item.courseName)}</strong>
                      <span>${escapeHtml(item.className)} | ${escapeHtml(item.courseCode || "未填写课程代码")}</span>
                      <span>${escapeHtml(formatDateTime(item.submittedAt))}</span>
                    </div>
                  </td>
                  <td data-label="学期">
                    <div class="table-title">
                      <strong>${escapeHtml(item.semester)}</strong>
                      <span>${escapeHtml(courseLabel(item.courseType))}</span>
                    </div>
                  </td>
                  <td data-label="折算课时">
                    <div class="table-title">
                      <strong>${formatNumber(item.settledHours)} 课时</strong>
                      <span>基础 ${formatNumber(item.baseHours)} | 人数系数 ${formatPlain(item.sizeCoef)}</span>
                    </div>
                  </td>
                  <td data-label="课时费">${formatCurrency(item.amount)}</td>
                  <td data-label="状态"><span class="status-badge ${escapeHtml(item.status)}">${escapeHtml(statusLabel(item.status))}</span></td>
                  <td data-label="审批意见"><span class="table-note">${escapeHtml(item.approvalNote || "暂无审批意见")}</span></td>
                  <td data-label="操作">
                    <div class="inline-actions">
                      ${canEditClaim(item) ? `<button class="mini-button" type="button" data-action="edit-claim" data-id="${item.id}">编辑</button>` : `<button class="mini-button" type="button" disabled>已锁定</button>`}
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
    return `<div class="empty-state"><p>当前筛选条件下没有匹配的记录。</p></div>`;
  }

  return `
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th class="checkbox-cell"><input type="checkbox" data-role="select-all" ${allVisibleSelected ? "checked" : ""} /></th>
            <th>教师</th>
            <th>课程</th>
            <th>课时</th>
            <th>金额</th>
            <th>状态</th>
            <th>提交时间</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          ${claims
            .map(
              (item) => `
                <tr>
                  <td data-label="选择" class="checkbox-cell">
                    <input type="checkbox" data-role="select-one" data-id="${item.id}" ${ui.selectedIds.has(item.id) ? "checked" : ""} />
                  </td>
                  <td data-label="教师">
                    <div class="table-title">
                      <strong>${escapeHtml(item.teacherName)}</strong>
                      <span>${escapeHtml(item.department)} | ${escapeHtml(item.employeeNo)}</span>
                    </div>
                  </td>
                  <td data-label="课程">
                    <div class="table-title">
                      <strong>${escapeHtml(item.courseName)}</strong>
                      <span>${escapeHtml(item.semester)} | ${escapeHtml(item.className)}</span>
                    </div>
                  </td>
                  <td data-label="课时">
                    <div class="table-title">
                      <strong>${formatNumber(item.settledHours)} 课时</strong>
                      <span>基础 ${formatNumber(item.baseHours)} | 调节系数 ${formatPlain(item.adjustmentCoef)}</span>
                    </div>
                  </td>
                  <td data-label="金额">${formatCurrency(item.amount)}</td>
                  <td data-label="状态"><span class="status-badge ${escapeHtml(item.status)}">${escapeHtml(statusLabel(item.status))}</span></td>
                  <td data-label="提交时间">${escapeHtml(formatDateTime(item.submittedAt))}</td>
                  <td data-label="操作">
                    <div class="inline-actions">
                      <button class="mini-button" type="button" data-action="open-review" data-id="${item.id}">审核</button>
                      <button class="mini-button" type="button" data-action="quick-approve" data-id="${item.id}" ${item.status === "approved" ? "disabled" : ""}>通过</button>
                      <button class="mini-button" type="button" data-action="quick-return" data-id="${item.id}" ${item.status === "returned" ? "disabled" : ""}>退回</button>
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
    return `<div class="empty-state"><p>请先从左侧表格中选择一条记录查看详细信息并填写审批意见。</p></div>`;
  }

  return `
    <div class="stack">
      <div class="detail-box">
        <div class="meta-list">
          <div class="meta-row"><span>教师</span><strong>${escapeHtml(item.teacherName)} / ${escapeHtml(item.employeeNo)}</strong></div>
          <div class="meta-row"><span>课程</span><strong>${escapeHtml(item.courseName)}</strong></div>
          <div class="meta-row"><span>学期</span><strong>${escapeHtml(item.semester)}</strong></div>
          <div class="meta-row"><span>教学班</span><strong>${escapeHtml(item.className)}</strong></div>
          <div class="meta-row"><span>折算课时</span><strong>${formatNumber(item.settledHours)} 课时</strong></div>
          <div class="meta-row"><span>课时费</span><strong>${formatCurrency(item.amount)}</strong></div>
        </div>

        <div class="chip-row spaced">
          <span class="formula-chip">课程系数 ${formatPlain(item.typeCoef)}</span>
          <span class="formula-chip">人数系数 ${formatPlain(item.sizeCoef)}</span>
          <span class="formula-chip">调节系数 ${formatPlain(item.adjustmentCoef)}</span>
          <span class="formula-chip">${escapeHtml(statusLabel(item.status))}</span>
        </div>

        <div class="aside-note spaced">
          <strong>教师备注</strong>
          <p class="muted">${escapeHtml(item.remarks || "教师未填写备注。")}</p>
        </div>
      </div>

      <form id="review-form" class="stack" data-id="${item.id}">
        <label class="field-stack">
          <span class="field-label">审批意见</span>
          <textarea name="reviewNote" placeholder="例如：按当前通用规则审批通过。">${escapeHtml(ui.reviewNote || item.approvalNote || "")}</textarea>
        </label>

        <div class="helper-row">
          <span>最近审批时间：${escapeHtml(item.reviewedAt ? formatDateTime(item.reviewedAt) : "暂无")}</span>
          <span>审批人：${escapeHtml(item.reviewerName || "暂无")}</span>
        </div>

        <div class="inline-actions">
          <button class="button" type="submit" name="decision" value="approved" ${item.status === "approved" ? "disabled" : ""}>审批通过</button>
          <button class="button-secondary" type="submit" name="decision" value="returned" ${item.status === "returned" ? "disabled" : ""}>退回修改</button>
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
          <span class="panel-kicker">实时测算</span>
          <h2>课时与课时费预估</h2>
          <p class="panel-subtitle">教师修改表单后，这里的结果会实时更新。</p>
        </div>
      </div>

      <div class="formula-box">
        <div class="chip-row">
          <span class="formula-chip">${escapeHtml(courseType.label)}</span>
          <span class="formula-chip">课程系数 ${formatPlain(calc.typeCoef)}</span>
          <span class="formula-chip">人数系数 ${formatPlain(calc.sizeCoef)}</span>
          <span class="formula-chip">调节系数 ${formatPlain(calc.adjustmentCoef)}</span>
        </div>

        <div class="formula-value">
          <div>
            <span class="tiny-label">折算课时</span>
            <strong class="mono">${formatNumber(calc.settledHours)}</strong>
          </div>
          <div class="text-right">
            <span class="tiny-label">课时费</span>
            <strong class="mono">${formatCurrency(calc.amount)}</strong>
          </div>
        </div>

        <div class="formula-breakdown">
          <div class="formula-row"><span>基础课时</span><strong>${formatNumber(calc.baseHours)}</strong></div>
          <div class="formula-row"><span>额外课时</span><strong>${formatNumber(calc.extraHours)}</strong></div>
          <div class="formula-row"><span>人数区间</span><strong>${escapeHtml(calc.sizeBand)}</strong></div>
          <div class="formula-row"><span>计算公式</span><strong>(${formatNumber(calc.baseHours)} + ${formatNumber(calc.extraHours)}) x ${formatPlain(calc.typeCoef)} x ${formatPlain(calc.sizeCoef)} x ${formatPlain(calc.adjustmentCoef)}</strong></div>
          <div class="formula-row"><span>课时单价</span><strong>${formatCurrency(calc.unitPrice)}</strong></div>
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
        <p>页面不存在，请返回首页或重新进入教师端、管理员端入口。</p>
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
    setNotice("已成功退出登录。", "success");
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
    const confirmed = window.confirm("是否重置当前浏览器中的演示数据，并恢复内置演示账号？");
    if (!confirmed) return;

    store = createInitialStore();
    persistStore();
    ui.teacherEditId = null;
    ui.reviewId = null;
    ui.reviewNote = "";
    ui.selectedIds.clear();
    setNotice("演示数据已重置。", "success");
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
    setNotice("请输入用户名和密码。", "error");
    return;
  }

  const user = store.users.find(
    (item) => item.role === role && item.username.toLowerCase() === username && item.password === password
  );

  if (!user) {
    setNotice("用户名或密码不正确。", "error");
    return;
  }

  store.session = {
    userId: user.id,
    role: user.role,
    loginAt: new Date().toISOString(),
  };

  persistStore();
  setNotice(`已成功登录${role === "teacher" ? "教师端" : "管理员端"}。`, "success");
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
    setNotice("请完整填写注册信息。", "error");
    return;
  }

  if (!email.includes("@")) {
    setNotice("请输入有效的邮箱地址。", "error");
    return;
  }

  if (password.length < 6) {
    setNotice("密码至少需要6位字符。", "error");
    return;
  }

  if (store.users.some((item) => item.username.toLowerCase() === username.toLowerCase())) {
    setNotice("该用户名已存在，请更换一个。", "error");
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
  setNotice(`已创建并登录${role === "teacher" ? "教师账号" : "管理员账号"}。`, "success");
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
  setNotice(existing ? "申报已更新并重新提交。" : "课时申报提交成功。", "success");
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

  if (!raw.courseName || !raw.className) return { error: "课程名称和教学班名称不能为空。" };
  if (!COURSE_MAP[raw.courseType]) return { error: "课程类型无效，请重新选择。" };
  if (!Number.isFinite(raw.studentCount) || raw.studentCount < 1) return { error: "学生人数必须大于0。" };
  if (!Number.isFinite(raw.weeks) || raw.weeks < 1 || raw.weeks > 30) return { error: "授课周数必须在1到30之间。" };
  if (!Number.isFinite(raw.weeklyHours) || raw.weeklyHours <= 0) return { error: "周学时必须大于0。" };
  if (!Number.isFinite(raw.extraHours) || raw.extraHours < 0) return { error: "额外课时不能为负数。" };
  if (!Number.isFinite(raw.adjustmentCoef) || raw.adjustmentCoef < 0.5 || raw.adjustmentCoef > 2) {
    return { error: "调节系数必须在0.5到2之间。" };
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
  setNotice(nextStatus === "approved" ? "已审批通过该记录。" : "该记录已退回给教师修改。", "success");
  renderApp();
}

function approveSelected() {
  const admin = getCurrentUser();
  if (!admin || admin.role !== "admin") return;

  const claims = getClaims();
  const pendingSelected = claims.filter((item) => ui.selectedIds.has(item.id) && item.status === "pending");
  if (!pendingSelected.length) {
    setNotice("请先选择至少一条待审批记录。", "error");
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
            approvalNote: item.approvalNote || "批量审批通过。",
            reviewedAt: now,
            reviewerId: admin.id,
            reviewerName: admin.name,
          }
        : item
    )
  );

  setNotice(`已批量通过 ${pendingSelected.length} 条记录。`, "success");
  renderApp();
}

function exportSelected() {
  const items = getClaims().filter((item) => ui.selectedIds.has(item.id));
  if (!items.length) {
    setNotice("请先选择至少一条记录再导出。", "error");
    return;
  }

  exportCsv(items, "selected");
  setNotice(`已导出 ${items.length} 条选中记录。`, "success");
}

function exportFiltered() {
  const items = filterClaims(sortClaims(getClaims()));
  if (!items.length) {
    setNotice("当前筛选条件下没有可导出的数据。", "error");
    return;
  }

  exportCsv(items, "filtered");
  setNotice(`已导出 ${items.length} 条筛选结果。`, "success");
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
    "申报编号",
    "状态",
    "学期",
    "教师姓名",
    "教师工号",
    "所属院系",
    "课程名称",
    "课程代码",
    "课程类型",
    "教学班名称",
    "学生人数",
    "授课周数",
    "周学时",
    "额外课时",
    "调节系数",
    "基础课时",
    "课程系数",
    "人数系数",
    "折算课时",
    "课时单价",
    "课时费",
    "提交时间",
    "审批时间",
    "审批意见",
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

  downloadBlob(new Blob([csv], { type: "text/csv;charset=utf-8" }), `课时申报导出-${scope === "selected" ? "选中记录" : "筛选结果"}-${formatDateForFile(new Date())}.csv`);
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
      name: "教务管理员",
      username: "admin",
      email: "admin@demo.edu",
      password: "Demo123!",
      department: "教务处",
      employeeNo: "A2026001",
      createdAt: "2026-03-27T08:00:00.000Z",
    },
    {
      id: "teacher-001",
      role: "teacher",
      name: "张晨",
      username: "zhang.teacher",
      email: "zhang@demo.edu",
      password: "Demo123!",
      department: "计算机学院",
      employeeNo: "T2026001",
      createdAt: "2026-03-27T08:03:00.000Z",
    },
    {
      id: "teacher-002",
      role: "teacher",
      name: "李敏",
      username: "li.teacher",
      email: "li@demo.edu",
      password: "Demo123!",
      department: "人工智能学院",
      employeeNo: "T2026002",
      createdAt: "2026-03-27T08:06:00.000Z",
    },
  ];

  const claims = [
    seedClaim({
      id: "claim-1001",
      teacherId: "teacher-001",
      teacherName: "张晨",
      employeeNo: "T2026001",
      department: "计算机学院",
      semester: "2025-2026-2",
      courseType: "required",
      courseName: "数据结构",
      courseCode: "CS201",
      className: "2024级软件工程1班",
      studentCount: 68,
      weeks: 16,
      weeklyHours: 4,
      extraHours: 2,
      adjustmentCoef: 1,
      remarks: "包含答疑和实验辅导课时。",
      submittedAt: "2026-03-10T01:30:00.000Z",
      status: "approved",
      approvalNote: "按当前通用规则审批通过。",
      reviewedAt: "2026-03-11T02:10:00.000Z",
      reviewerId: "admin-001",
      reviewerName: "教务管理员",
    }),
    seedClaim({
      id: "claim-1002",
      teacherId: "teacher-001",
      teacherName: "张晨",
      employeeNo: "T2026001",
      department: "计算机学院",
      semester: "2025-2026-2",
      courseType: "lab",
      courseName: "程序设计实验",
      courseCode: "CS210L",
      className: "2024级计算机科学2班",
      studentCount: 42,
      weeks: 12,
      weeklyHours: 2,
      extraHours: 4,
      adjustmentCoef: 1.05,
      remarks: "包含实验准备和分组辅导等额外工作量。",
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
      teacherName: "李敏",
      employeeNo: "T2026002",
      department: "人工智能学院",
      semester: "2025-2026-2",
      courseType: "practice",
      courseName: "机器学习课程设计",
      courseCode: "AI309P",
      className: "2023级人工智能1班",
      studentCount: 84,
      weeks: 8,
      weeklyHours: 4,
      extraHours: 6,
      adjustmentCoef: 1.1,
      remarks: "包含项目评审和阶段答辩。",
      submittedAt: "2026-03-18T03:45:00.000Z",
      status: "returned",
      approvalNote: "请补充分组说明和额外课时依据后重新提交。",
      reviewedAt: "2026-03-19T05:00:00.000Z",
      reviewerId: "admin-001",
      reviewerName: "教务管理员",
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
  return STATUS_LABELS[status] || "未知状态";
}

function courseLabel(type) {
  return COURSE_MAP[type]?.label || "未知类型";
}

function defaultReviewNote(status) {
  return status === "approved" ? "已按当前演示规则审批通过。" : "请根据退回意见修改后重新提交。";
}

function renderSelectOptions(values, selected, labelMap = {}) {
  return values
    .map((value) => `<option value="${escapeHtml(value)}" ${value === selected ? "selected" : ""}>${escapeHtml(labelMap[value] || value)}</option>`)
    .join("");
}

function renderCourseTypeOptions(selected) {
  return COURSE_TYPES.map(
    (item) => `<option value="${item.id}" ${item.id === selected ? "selected" : ""}>${escapeHtml(item.label)} | 系数 ${formatPlain(item.coef)}</option>`
  ).join("");
}

function renderStatusOptions(selected) {
  return [
    { value: "all", label: "全部状态" },
    { value: "pending", label: "待审批" },
    { value: "approved", label: "已通过" },
    { value: "returned", label: "已退回" },
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
  return `人民币 ${Number(value || 0).toLocaleString("zh-CN", {
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
