/* Trang Repos: cấu hình board → repo (CRUD). */
(function () {
  'use strict';
  AdminApi.requireAuth();

  var U = window.AdminUI;

  async function load() {
    var body = document.getElementById('reposBody');
    body.innerHTML = '<tr><td colspan="6" class="text-center text-secondary py-4">Đang tải…</td></tr>';
    try {
      var data = await AdminApi.get('/repos');
      var hint = document.getElementById('defaultHint');
      if (hint) hint.textContent = 'Repo mặc định (khi chưa map board nào): ' + (data.defaultRepoPath || '—');
      var items = data.items || [];
      if (!items.length) {
        body.innerHTML = '<tr><td colspan="6" class="text-center text-secondary py-4">Chưa có cấu hình nào — hệ đang dùng repo mặc định cho mọi board.</td></tr>';
        return;
      }
      body.innerHTML = items.map(rowHtml).join('');
    } catch (err) {
      body.innerHTML = '<tr><td colspan="6" class="text-center text-danger py-4">' + U.escapeHtml(err.message) + '</td></tr>';
    }
  }

  function rowHtml(it) {
    var badge = it.enabled
      ? '<span class="badge bg-success">Bật</span>'
      : '<span class="badge bg-secondary">Tắt</span>';
    var inp = function (f, val, style) {
      return '<input class="form-control form-control-sm" data-f="' + f + '"' + (style ? ' style="' + style + '"' : '') + ' value="' + U.escapeHtml(val) + '">';
    };
    // Các ô name / repo_path / base_branch sửa trực tiếp được; bấm "Lưu" để cập nhật.
    return '' +
      '<tr data-id="' + it.id + '">' +
        '<td>' + inp('name', it.name) + '</td>' +
        '<td class="fs-12"><code>' + U.escapeHtml(it.board_id) + '</code></td>' +
        '<td>' + inp('repo_path', it.repo_path) +
          '<div class="mt-1">' + inp('docs_path', it.docs_path || '') + '<span class="text-secondary" style="font-size:11px">docs (trống = &lt;repo&gt;/docs)</span></div></td>' +
        '<td>' + inp('base_branch', it.base_branch, 'max-width:130px') + '</td>' +
        '<td>' + badge + '</td>' +
        '<td class="text-end" style="white-space:nowrap">' +
          '<button class="btn btn-sm btn-theme" data-act="save" data-id="' + it.id + '">Lưu</button> ' +
          '<button class="btn btn-sm btn-outline-theme" data-act="provision" data-id="' + it.id + '" title="Tự tạo list stage + label điều khiển còn thiếu trên board"><i class="bi bi-list-check"></i> Tạo list/label</button> ' +
          '<button class="btn btn-sm btn-outline-theme" data-act="gendocs" data-id="' + it.id + '" title="Sinh tài liệu dự án vào docs/"><i class="bi bi-file-earmark-text"></i> Gen docs</button> ' +
          '<button class="btn btn-sm btn-outline-theme" data-act="toggle" data-id="' + it.id + '" data-en="' + (it.enabled ? 0 : 1) + '">' + (it.enabled ? 'Tắt' : 'Bật') + '</button> ' +
          '<button class="btn btn-sm btn-outline-danger" data-act="del" data-id="' + it.id + '">Xoá</button>' +
        '</td>' +
      '</tr>';
  }

  async function createRepo() {
    var val = function (id) { return document.getElementById(id).value.trim(); };
    var body = { board_id: val('f_board'), name: val('f_name'), repo_path: val('f_path'), base_branch: val('f_base') || 'dev', docs_path: val('f_docs') };
    if (!body.board_id || !body.name || !body.repo_path) { U.toast('Điền đủ Board ID, Tên, Repo path.', 'warning'); return; }
    try {
      await AdminApi.post('/repos', body);
      U.toast('Đã lưu dự án.', 'success');
      ['f_board', 'f_name', 'f_path', 'f_docs'].forEach(function (id) { var el = document.getElementById(id); if (el) el.value = ''; });
      load();
    } catch (err) { U.toast(err.message, 'danger'); }
  }

  async function onTableClick(e) {
    var btn = e.target.closest('button[data-act]');
    if (!btn) return;
    var id = btn.getAttribute('data-id');
    var act = btn.getAttribute('data-act');
    try {
      if (act === 'save') {
        var tr = btn.closest('tr');
        var body = {};
        tr.querySelectorAll('input[data-f]').forEach(function (inp) { body[inp.getAttribute('data-f')] = inp.value.trim(); });
        if (!body.base_branch) { U.toast('Base branch không được để trống.', 'warning'); return; }
        await AdminApi.put('/repos/' + id, body);
        U.toast('Đã lưu cấu hình.', 'success');
        load();
      } else if (act === 'provision') {
        var rp = await AdminApi.post('/repos/' + id + '/provision', {});
        var p = (rp && rp.provision) || {};
        var nl = (p.createdLists || []).length, nb = (p.createdLabels || []).length;
        U.toast((nl + nb) ? ('Đã tạo ' + nl + ' list + ' + nb + ' label còn thiếu.') : 'Board đã đủ list/label.', 'success');
      } else if (act === 'gendocs') {
        if (!confirm('Sinh tài liệu dự án vào docs/ (chạy nền, có thể vài phút)? Sau đó review + commit.')) return;
        var r = await AdminApi.post('/repos/' + id + '/gen-docs', {});
        U.toast((r && r.message) || 'Đang sinh tài liệu nền…', 'success');
      } else if (act === 'toggle') {
        await AdminApi.put('/repos/' + id, { enabled: btn.getAttribute('data-en') === '1' });
        load();
      } else if (act === 'del') {
        if (!confirm('Xoá cấu hình board này?')) return;
        await AdminApi.del('/repos/' + id);
        load();
      }
    } catch (err) { U.toast(err.message, 'danger'); }
  }

  document.addEventListener('DOMContentLoaded', function () {
    document.getElementById('createBtn').addEventListener('click', createRepo);
    document.getElementById('refreshBtn').addEventListener('click', load);
    document.getElementById('reposBody').addEventListener('click', onTableClick);
    load();
  });
})();
