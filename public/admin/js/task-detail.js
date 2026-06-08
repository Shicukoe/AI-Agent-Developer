/* Chi tiết task: hiển thị thông tin + timeline + comment, và các thao tác điều khiển. */
(function () {
  'use strict';
  AdminApi.requireAuth();

  var U = window.AdminUI;
  var taskId = new URLSearchParams(location.search).get('id');
  var modal = null;

  function field(label, value) {
    return '<div class="col-6 col-md-4 mb-3"><p class="text-secondary small mb-0">' + label + '</p><p class="mb-0">' + value + '</p></div>';
  }

  function render(data) {
    var t = data.task;
    document.getElementById('taskTitle').textContent = t.card_name;
    document.getElementById('taskSub').innerHTML = U.statusBadge(t.status) + ' <span class="text-secondary fs-12 ms-2">' + U.escapeHtml(t.card_id) + '</span>';

    var inFlight = (t.status === 'processing' || t.status === 'developing' || t.status === 'testing');

    var html = '';

    // Hộp lỗi
    if (t.error_message) {
      html += '<div class="alert alert-danger"><strong>Lỗi:</strong> ' + U.escapeHtml(t.error_message) + '</div>';
    }

    // Thao tác
    html += '<div class="card mb-3"><div class="card-body"><div class="d-flex flex-wrap gap-2">' +
      btn('actRerun', 'bi-arrow-clockwise', 'Chạy lại stage hiện tại', 'theme', inFlight) +
      btn('actComment', 'bi-chat-left-text', 'Bổ sung thông tin', 'light-theme', false) +
      btn('actModify', 'bi-pencil-square', 'Lập lại kế hoạch', 'light-theme', inFlight) +
      btn('actCancel', 'bi-x-circle', 'Hủy task', 'outline-danger', false) +
      '</div>' + (inFlight ? '<p class="text-secondary fs-12 mb-0 mt-2">Task đang chạy — một số thao tác tạm khóa.</p>' : '') +
      '</div></div>';

    // Thông tin
    html += '<div class="card mb-3"><div class="card-body"><h6 class="mb-3">Thông tin</h6><div class="row">' +
      field('Loại', U.escapeHtml(t.task_type)) +
      field('Trạng thái', U.statusBadge(t.status)) +
      field('Branch', t.branch_name ? '<code>' + U.escapeHtml(t.branch_name) + '</code>' : '—') +
      field('Số lần retry', t.retry_count) +
      field('Actions / Turns', t.actions_taken + ' / ' + t.turns_taken) +
      field('Tạo lúc', U.formatDate(t.created_at)) +
      field('Cập nhật', U.formatDate(t.updated_at)) +
      field('Heartbeat', U.formatDate(t.heartbeat_at)) +
      field('Worktree', t.worktree_path ? '<span class="fs-12">' + U.escapeHtml(t.worktree_path) + '</span>' : '—') +
      '</div></div></div>';

    // Review results
    if (data.reviews && data.reviews.length) {
      html += '<div class="card mb-3"><div class="card-body"><h6 class="mb-3">Kết quả review</h6>' +
        data.reviews.map(reviewHtml).join('') + '</div></div>';
    }

    // Timeline git
    html += '<div class="row"><div class="col-12 col-lg-6"><div class="card mb-3"><div class="card-body"><h6 class="mb-3">Git operations</h6>' +
      (data.gitOps && data.gitOps.length ? data.gitOps.map(gitHtml).join('') : '<p class="text-secondary small mb-0">Chưa có.</p>') +
      '</div></div></div>';

    // Comments
    html += '<div class="col-12 col-lg-6"><div class="card mb-3"><div class="card-body"><h6 class="mb-3">Comment Trello</h6>' +
      (data.comments && data.comments.length ? data.comments.map(commentHtml).join('') : '<p class="text-secondary small mb-0">Chưa có / không tải được.</p>') +
      '</div></div></div></div>';

    document.getElementById('taskContent').innerHTML = html;
    bindActions(t);
  }

  function btn(id, icon, label, cls, disabled) {
    return '<button class="btn btn-' + cls + '" id="' + id + '"' + (disabled ? ' disabled' : '') + '><i class="bi ' + icon + ' me-1"></i>' + label + '</button>';
  }

  function reviewHtml(r) {
    var v = r.verdict === 'PASS' ? '<span class="badge bg-success">PASS</span>' : '<span class="badge bg-danger">FAIL</span>';
    var issues = Array.isArray(r.issues) ? r.issues : [];
    var li = issues.map(function (i) {
      return '<li class="fs-12">' + (i.file ? '<code>' + U.escapeHtml(i.file) + (i.line ? ':' + i.line : '') + '</code> ' : '') + U.escapeHtml(i.description || '') + '</li>';
    }).join('');
    return '<div class="border-bottom pb-2 mb-2"><div class="d-flex justify-content-between">' + v +
      '<span class="text-secondary fs-12">Lần ' + r.attempt + ' · ' + U.formatDate(r.reviewed_at) + '</span></div>' +
      (r.summary ? '<p class="small mb-1 mt-1">' + U.escapeHtml(r.summary) + '</p>' : '') +
      (li ? '<ul class="mb-0">' + li + '</ul>' : '') + '</div>';
  }

  function gitHtml(g) {
    return '<div class="row g-0 mb-2"><div class="col-auto"><div class="avatar avatar-30 rounded bg-light-theme"><i class="bi bi-git fs-6"></i></div></div>' +
      '<div class="col ps-2"><p class="mb-0 fs-13"><strong>' + U.escapeHtml(g.operation) + '</strong>' + (g.branch ? ' · <code>' + U.escapeHtml(g.branch) + '</code>' : '') + '</p>' +
      '<p class="text-secondary fs-12 mb-0">' + U.formatDate(g.executed_at) + (g.commit_hash ? ' · ' + U.escapeHtml(g.commit_hash.slice(0, 8)) : '') + '</p></div></div>';
  }

  function commentHtml(c) {
    return '<div class="border-bottom pb-2 mb-2"><p class="mb-1 fs-13" style="white-space:pre-wrap">' + U.escapeHtml(c.text) + '</p>' +
      '<p class="text-secondary fs-12 mb-0">' + U.formatDate(Date.parse(c.date)) + '</p></div>';
  }

  function openInput(title, placeholder, onSubmit) {
    document.getElementById('inputModalTitle').textContent = title;
    var ta = document.getElementById('inputModalText');
    ta.value = '';
    ta.placeholder = placeholder;
    var submit = document.getElementById('inputModalSubmit');
    submit.onclick = function () { onSubmit(ta.value.trim()); };
    modal.show();
  }

  function bindActions(t) {
    var rerun = document.getElementById('actRerun');
    if (rerun) rerun.onclick = function () { doAction('/tasks/' + taskId + '/rerun', {}, 'Đã yêu cầu chạy lại.'); };

    document.getElementById('actComment').onclick = function () {
      openInput('Bổ sung thông tin', 'Nội dung gửi lên card Trello…', function (text) {
        if (!text) return;
        doAction('/tasks/' + taskId + '/comment', { text: text }, 'Đã gửi comment.');
      });
    };

    var mod = document.getElementById('actModify');
    if (mod) mod.onclick = function () {
      openInput('Lập lại kế hoạch', 'Hướng dẫn điều chỉnh (để trống = lập lại từ đầu)…', function (text) {
        doAction('/tasks/' + taskId + '/modify', { instruction: text }, 'Đã yêu cầu lập lại kế hoạch.');
      });
    };

    document.getElementById('actCancel').onclick = function () {
      if (!confirm('Hủy task này? Worktree sẽ bị dọn.')) return;
      doAction('/tasks/' + taskId + '/cancel', {}, 'Đã hủy task.');
    };
  }

  async function doAction(path, body, okMsg) {
    try {
      if (modal) modal.hide();
      await AdminApi.post(path, body);
      U.toast(okMsg, 'success');
      setTimeout(load, 800);
    } catch (err) {
      U.toast(err.message, 'danger');
    }
  }

  async function load() {
    try {
      var data = await AdminApi.get('/tasks/' + encodeURIComponent(taskId));
      render(data);
    } catch (err) {
      document.getElementById('taskContent').innerHTML = '<div class="alert alert-danger">' + U.escapeHtml(err.message) + '</div>';
    }
  }

  document.addEventListener('DOMContentLoaded', function () {
    if (!taskId) { location.href = 'index.html'; return; }
    modal = new bootstrap.Modal(document.getElementById('inputModal'));
    load();
  });
})();
