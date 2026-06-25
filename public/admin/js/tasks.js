/* Dashboard: nạp KPI + danh sách task, lọc & tìm kiếm. */
(function () {
  'use strict';
  AdminApi.requireAuth();

  var U = window.AdminUI;
  var state = { filter: 'problems', q: '' };
  var defaultRepoPath = '';

  function baseName(p) {
    if (!p) return '';
    var parts = String(p).replace(/[\\/]+$/, '').split(/[\\/]/);
    return parts[parts.length - 1] || p;
  }

  // Thẻ KPI: nhãn + status gộp. bg dùng biến thể light của palette template, text dùng utility Bootstrap.
  var KPIS = [
    { key: 'problems', label: 'Có vấn đề', icon: 'bi-exclamation-triangle', bg: 'bg-light-red', text: 'text-danger' },
    { key: 'running', label: 'Đang chạy', icon: 'bi-cpu', bg: 'bg-light-blue', text: 'text-primary', statuses: ['processing', 'developing', 'testing'] },
    { key: 'plan', label: 'Chờ duyệt plan', icon: 'bi-clipboard-check', bg: 'bg-light-cyan', text: 'text-info', statuses: ['awaiting_plan_approval'] },
    { key: 'completed', label: 'Hoàn thành', icon: 'bi-check-circle', bg: 'bg-light-green', text: 'text-success', statuses: ['completed'] },
    { key: 'total', label: 'Tổng task', icon: 'bi-kanban', bg: 'bg-light-theme', text: 'text-theme' },
  ];

  function sum(byStatus, statuses) {
    return statuses.reduce(function (a, s) { return a + (byStatus[s] || 0); }, 0);
  }

  async function loadStats() {
    var row = document.getElementById('kpiRow');
    try {
      var stats = await AdminApi.get('/stats');
      row.innerHTML = KPIS.map(function (k) {
        var val = k.key === 'problems' ? stats.problems
          : k.key === 'total' ? stats.total
          : sum(stats.byStatus || {}, k.statuses);
        return '' +
          '<div class="col-6 col-md-4 col-xl">' +
            '<div class="card mb-3"><div class="card-body"><div class="row">' +
              '<div class="col-auto"><div class="avatar avatar-50 rounded ' + k.bg + '"><i class="bi ' + k.icon + ' fs-5 ' + k.text + '"></i></div></div>' +
              '<div class="col ps-0 align-self-center"><h4 class="mb-0">' + val + '</h4><p class="text-secondary small mb-0">' + k.label + '</p></div>' +
            '</div></div></div>' +
          '</div>';
      }).join('');
    } catch (err) {
      row.innerHTML = '<div class="col-12"><div class="alert alert-danger">Không tải được số liệu: ' + U.escapeHtml(err.message) + '</div></div>';
    }
  }

  // Nhãn + icon + màu (gradient) cho từng khâu. Khớp prefix label trong *Agent.ts.
  var STAGE_META = {
    triage: { label: 'Phân loại', icon: 'bi-filter-circle', c1: '#6366f1', c2: '#8b5cf6' },
    ba:     { label: 'Phân tích nghiệp vụ', icon: 'bi-clipboard-data', c1: '#0ea5e9', c2: '#22d3ee' },
    tech:   { label: 'Refine kỹ thuật', icon: 'bi-gear-wide-connected', c1: '#06b6d4', c2: '#14b8a6' },
    plan:   { label: 'Lập kế hoạch', icon: 'bi-diagram-3', c1: '#3b82f6', c2: '#6366f1' },
    dev:    { label: 'Lập trình (Dev)', icon: 'bi-code-slash', c1: '#2563eb', c2: '#0ea5e9' },
    review: { label: 'Kiểm thử (Review)', icon: 'bi-shield-check', c1: '#16a34a', c2: '#4ade80' },
    doc:    { label: 'Tài liệu', icon: 'bi-journal-text', c1: '#f59e0b', c2: '#fbbf24' },
  };
  function stageMeta(k) {
    return STAGE_META[k] || { label: k || '(khác)', icon: 'bi-dot', c1: '#64748b', c2: '#94a3b8' };
  }

  async function loadUsage() {
    var body = document.getElementById('usageBody');
    var hint = document.getElementById('usageHint');
    try {
      var u = await AdminApi.get('/usage');
      var s = u.session || {};
      hint.textContent = (s.calls || 0) + ' lượt gọi trong ' + (s.hours || 5) + 'h';

      body.innerHTML =
        '<div class="row g-3 align-items-stretch">' +
          '<div class="col-12 col-lg-4">' + sessionPanel(s) + '</div>' +
          '<div class="col-12 col-lg-8">' + stagePanel(u.byStage || [], u.stagesTotal || 0) + '</div>' +
        '</div>';
    } catch (err) {
      body.innerHTML = '<div class="text-danger">Không tải được usage: ' + U.escapeHtml(err.message) + '</div>';
    }
  }

  function fmtReset(min) {
    if (min == null) return '';
    var h = Math.floor(min / 60), mm = min % 60;
    return 'reset sau ' + (h > 0 ? h + 'h' : '') + mm + 'p';
  }

  // Panel khi có SỐ THẬT từ Anthropic (/api/oauth/usage) — đúng /usage, không cần token/trần.
  function officialPanel(s) {
    var pct = Math.round(s.pct || 0);
    var sev = s.severity;
    var col = (sev === 'critical' || pct >= 90) ? '#ef4444' : (sev === 'warning' || pct >= 70) ? '#f59e0b' : 'var(--ap-accent, #2563eb)';
    var wk = s.weekly || {};
    var wpct = Math.round(wk.pct || 0);
    var wcol = wpct >= 90 ? '#ef4444' : wpct >= 70 ? '#f59e0b' : '#06b6d4';
    return '<div class="ap-tile h-100 d-flex flex-column align-items-center justify-content-center text-center p-3">' +
      '<div class="text-secondary small fw-semibold mb-2"><i class="bi bi-hourglass-split me-1"></i>Session 5h · % giới hạn THẬT</div>' +
      '<div class="ap-gauge" style="background:conic-gradient(' + col + ' ' + (pct * 3.6) + 'deg,#e9edf5 0)">' +
        '<div class="ap-gauge-hole"><div class="ap-gauge-num">' + pct + '<span class="ap-gauge-pct">%</span></div></div>' +
      '</div>' +
      '<div class="small mt-2 fw-semibold"><i class="bi bi-clock-history me-1 text-theme"></i>' + U.escapeHtml(fmtReset(s.remainingMinutes)) + '</div>' +
      (s.tokens != null
        ? '<div class="text-secondary fs-12 mt-1">đã dùng <span class="fw-semibold text-dark">' + U.fmtTokens(s.tokens) + '</span> token thật (in ' + U.fmtTokens(s.input) + ' · out ' + U.fmtTokens(s.output) + ')' +
          (s.cacheRead ? '<br>cache đọc lại ' + U.fmtTokens(s.cacheRead) + ' (không tính giới hạn)' : '') + '</div>'
        : '') +
      '<div class="w-100 px-2 mt-3">' +
        '<div class="d-flex justify-content-between fs-12 mb-1"><span class="text-secondary">Tuần (7 ngày)</span><span class="fw-semibold">' + wpct + '%</span></div>' +
        '<div class="ap-bar"><div class="ap-bar-fill" style="width:' + Math.max(2, wpct) + '%;background:linear-gradient(90deg,#06b6d4,' + wcol + ')"></div></div>' +
        (wk.remainingMinutes != null ? '<div class="text-secondary fs-12 mt-1 text-start">' + U.escapeHtml(fmtReset(wk.remainingMinutes)) + '</div>' : '') +
      '</div>' +
      '<div class="mt-3"><span class="badge bg-light-green text-success fs-12"><i class="bi bi-patch-check me-1"></i>Anthropic /usage · số thật</span></div>' +
      '</div>';
  }

  // Vòng tròn % cửa sổ 5h (conic-gradient). Nguồn ccusage = block 5h thật; fallback = tự đo từ DB.
  function sessionPanel(s) {
    if (s.source === 'official') return officialPanel(s);
    var has = s.pct != null;
    var pct = has ? Math.round(s.pct) : 0;
    var ring = has ? pct : 100;
    var col = pct >= 90 ? '#ef4444' : pct >= 70 ? '#f59e0b' : 'var(--ap-accent, #2563eb)';
    var center = has
      ? '<div class="ap-gauge-num">' + pct + '<span class="ap-gauge-pct">%</span></div>'
      : '<div class="ap-gauge-num" style="font-size:1.05rem">' + U.fmtTokens(s.tokens) + '</div>';
    var sub = has
      ? U.fmtTokens(s.tokens) + ' / ' + U.fmtTokens(s.limitTokens) + ' token thật'
      : '<span class="text-warning fs-12">trần chưa có — đặt USAGE_SESSION_LIMIT_TOKENS</span>';

    // Dòng phụ: thời gian còn lại trong block (ccusage).
    var extra = '';
    if (s.remainingMinutes != null) {
      var h = Math.floor(s.remainingMinutes / 60), mm = s.remainingMinutes % 60;
      extra += '<div class="fs-12 mt-1"><i class="bi bi-clock-history me-1 text-theme"></i>còn ' +
        (h > 0 ? h + 'h' : '') + mm + 'p trong block</div>';
    }
    // Cache chỉ ghi chú nhỏ để biết — KHÔNG tính vào % (đọc lại, rất rẻ).
    var cacheNote = s.cacheRead
      ? '<div class="text-secondary fs-12">cache đọc lại ' + U.fmtTokens(s.cacheRead) + ' (không tính)</div>' : '';
    var srcBadge = s.source === 'ccusage'
      ? '<span class="badge bg-light-green text-success fs-12">ccusage · block 5h thật</span>'
      : '<span class="badge bg-light-theme text-theme fs-12">tự đo (DB)</span>';
    var limTag = (has && s.limitSource === 'auto-max')
      ? '<div class="text-secondary fs-12 mt-1">trần tự hiệu chỉnh theo block in+out cao nhất</div>' : '';

    return '<div class="ap-tile h-100 d-flex flex-column align-items-center justify-content-center text-center p-3">' +
      '<div class="text-secondary small fw-semibold mb-2"><i class="bi bi-hourglass-split me-1"></i>Cửa sổ session ' + (s.hours || 5) + 'h · token thật (in+out)</div>' +
      '<div class="ap-gauge" style="background:conic-gradient(' + col + ' ' + (ring * 3.6) + 'deg,#e9edf5 0)">' +
        '<div class="ap-gauge-hole">' + center + '</div>' +
      '</div>' +
      '<div class="small mt-2 fw-semibold">' + sub + '</div>' +
      '<div class="text-secondary fs-12 mt-1">in ' + U.fmtTokens(s.input) + ' · out ' + U.fmtTokens(s.output) + '</div>' +
      cacheNote + extra + limTag +
      '<div class="mt-2">' + srcBadge + '</div>' +
      '</div>';
  }

  // Thanh token theo khâu (gradient), sắp xếp nhiều → ít.
  function stagePanel(rows, total) {
    if (!rows.length) {
      return '<div class="ap-tile h-100 d-flex align-items-center justify-content-center text-secondary p-4">Chưa có dữ liệu token. Chạy vài card để bắt đầu đo.</div>';
    }
    var max = rows.reduce(function (m, r) { return Math.max(m, r.tokens); }, 0) || 1;
    var bars = rows.map(function (r) {
      var m = stageMeta(r.stage);
      var w = Math.max(3, Math.round(r.tokens / max * 100));
      var share = total > 0 ? Math.round(r.tokens / total * 100) : 0;
      return '<div class="ap-stage">' +
        '<div class="ap-stage-head">' +
          '<span class="ap-stage-name"><span class="ap-stage-ic" style="background:linear-gradient(135deg,' + m.c1 + ',' + m.c2 + ')"><i class="bi ' + m.icon + '"></i></span>' + U.escapeHtml(m.label) + '</span>' +
          '<span class="ap-stage-val">' + U.fmtTokens(r.tokens) + ' <span class="text-secondary fs-12">· ' + share + '%</span></span>' +
        '</div>' +
        '<div class="ap-bar"><div class="ap-bar-fill" style="width:' + w + '%;background:linear-gradient(90deg,' + m.c1 + ',' + m.c2 + ')"></div></div>' +
        '<div class="text-secondary fs-12 mt-1">in ' + U.fmtTokens(r.input) + ' · out ' + U.fmtTokens(r.output) + ' · ' + r.calls + ' lượt</div>' +
        '</div>';
    }).join('');
    return '<div class="ap-tile h-100 p-3">' +
      '<div class="text-secondary small fw-semibold mb-3"><i class="bi bi-bar-chart-steps me-1"></i>Token thật theo khâu (in+out, bỏ cache) · tổng ' + U.fmtTokens(total) + '</div>' +
      bars + '</div>';
  }

  async function loadTasks() {
    var body = document.getElementById('tasksBody');
    body.innerHTML = '<tr><td colspan="7" class="text-center text-secondary py-4">Đang tải…</td></tr>';
    try {
      var qs = '/tasks?status=' + encodeURIComponent(state.filter) + (state.q ? '&q=' + encodeURIComponent(state.q) : '') + '&limit=200';
      var data = await AdminApi.get(qs);
      if (data.defaultRepoPath) defaultRepoPath = data.defaultRepoPath;
      if (!data.items.length) {
        body.innerHTML = '<tr><td colspan="7" class="text-center text-secondary py-4">Không có task nào.</td></tr>';
        return;
      }
      body.innerHTML = data.items.map(rowHtml).join('');
    } catch (err) {
      body.innerHTML = '<tr><td colspan="7" class="text-center text-danger py-4">' + U.escapeHtml(err.message) + '</td></tr>';
    }
  }

  // Nhãn dự án/repo: tên thư mục cuối của repo_path; nếu task chưa gắn repo → dùng repo mặc định.
  function repoLabel(t) {
    return baseName(t.repo_path) || baseName(defaultRepoPath) || t.repo_key || '—';
  }

  function rowHtml(t) {
    var err = t.error_message ? '<i class="bi bi-exclamation-circle-fill text-danger" title="' + U.escapeHtml(t.error_message) + '"></i>' : '';
    var isDefault = !t.repo_path;
    var repo = '<span class="badge ' + (isDefault ? 'bg-light-secondary text-secondary' : 'bg-light-theme text-theme') + '">' +
      '<i class="bi bi-hdd-stack me-1"></i>' + U.escapeHtml(repoLabel(t)) + (isDefault ? ' (mặc định)' : '') + '</span>';
    return '' +
      '<tr style="cursor:pointer" data-id="' + U.escapeHtml(t.id) + '">' +
        '<td><div class="fw-bold text-truncate" style="max-width:300px">' + U.escapeHtml(t.card_name) + '</div>' +
          '<div class="text-secondary fs-12">' + U.escapeHtml(t.card_id) + '</div></td>' +
        '<td>' + repo + '</td>' +
        '<td><span class="badge bg-secondary">' + U.escapeHtml(t.task_type) + '</span></td>' +
        '<td>' + U.statusBadge(t.status) + '</td>' +
        '<td class="fs-12">' + (t.branch_name ? '<code>' + U.escapeHtml(t.branch_name) + '</code>' : '—') + '</td>' +
        '<td class="fs-12 text-secondary">' + U.timeAgo(t.updated_at) + '</td>' +
        '<td class="text-end">' + err + '</td>' +
      '</tr>';
  }

  function refresh() { loadStats(); loadUsage(); loadTasks(); }

  document.addEventListener('DOMContentLoaded', function () {
    // Bộ lọc
    document.getElementById('filterGroup').addEventListener('click', function (e) {
      var btn = e.target.closest('button[data-filter]');
      if (!btn) return;
      this.querySelectorAll('button').forEach(function (b) { b.classList.remove('active'); });
      btn.classList.add('active');
      state.filter = btn.getAttribute('data-filter');
      loadTasks();
    });
    // Tìm kiếm (debounce)
    var timer = null;
    document.getElementById('searchInput').addEventListener('input', function (e) {
      clearTimeout(timer);
      var v = e.target.value.trim();
      timer = setTimeout(function () { state.q = v; loadTasks(); }, 300);
    });
    document.getElementById('refreshBtn').addEventListener('click', refresh);
    // Click 1 hàng → mở chi tiết task (uỷ quyền, không phụ thuộc onclick inline).
    document.getElementById('tasksBody').addEventListener('click', function (e) {
      var tr = e.target.closest('tr[data-id]');
      if (tr) location.href = 'task.html?id=' + encodeURIComponent(tr.getAttribute('data-id'));
    });
    refresh();
  });
})();
