/* Dashboard: nạp KPI + danh sách task, lọc & tìm kiếm. */
(function () {
  'use strict';
  AdminApi.requireAuth();

  var U = window.AdminUI;
  var state = { filter: 'problems', q: '' };

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

  async function loadTasks() {
    var body = document.getElementById('tasksBody');
    body.innerHTML = '<tr><td colspan="6" class="text-center text-secondary py-4">Đang tải…</td></tr>';
    try {
      var qs = '/tasks?status=' + encodeURIComponent(state.filter) + (state.q ? '&q=' + encodeURIComponent(state.q) : '') + '&limit=200';
      var data = await AdminApi.get(qs);
      if (!data.items.length) {
        body.innerHTML = '<tr><td colspan="6" class="text-center text-secondary py-4">Không có task nào.</td></tr>';
        return;
      }
      body.innerHTML = data.items.map(rowHtml).join('');
    } catch (err) {
      body.innerHTML = '<tr><td colspan="6" class="text-center text-danger py-4">' + U.escapeHtml(err.message) + '</td></tr>';
    }
  }

  function rowHtml(t) {
    var err = t.error_message ? '<i class="bi bi-exclamation-circle-fill text-danger" title="' + U.escapeHtml(t.error_message) + '"></i>' : '';
    return '' +
      '<tr style="cursor:pointer" onclick="location.href=\'task.html?id=' + encodeURIComponent(t.id) + '\'">' +
        '<td><div class="fw-bold text-truncate" style="max-width:320px">' + U.escapeHtml(t.card_name) + '</div>' +
          '<div class="text-secondary fs-12">' + U.escapeHtml(t.card_id) + '</div></td>' +
        '<td><span class="badge bg-secondary">' + U.escapeHtml(t.task_type) + '</span></td>' +
        '<td>' + U.statusBadge(t.status) + '</td>' +
        '<td class="fs-12">' + (t.branch_name ? '<code>' + U.escapeHtml(t.branch_name) + '</code>' : '—') + '</td>' +
        '<td class="fs-12 text-secondary">' + U.timeAgo(t.updated_at) + '</td>' +
        '<td class="text-end">' + err + '</td>' +
      '</tr>';
  }

  function refresh() { loadStats(); loadTasks(); }

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
    refresh();
  });
})();
