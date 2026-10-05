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
      if (hint) hint.textContent = 'Repo mặc định (dùng khi chưa cấu hình board nào): ' + (data.defaultRepoPath || '—');
      var items = data.items || [];
      if (!items.length) {
        body.innerHTML = '<tr><td colspan="6" class="text-center text-secondary py-4">Chưa có cấu hình nào. Các board đang dùng repo mặc định trong .env.</td></tr>';
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
    var formatCtx = function (raw) {
      if (!raw) return '';
      try { var a = JSON.parse(raw); if (Array.isArray(a)) return a.join('\n'); } catch (e) { /* raw */ }
      return raw;
    };
    // Các ô name / repo_path / base_branch sửa trực tiếp được; bấm "Lưu" để cập nhật.
    return '' +
      '<tr data-id="' + it.id + '">' +
        '<td>' + inp('name', it.name) + '</td>' +
        '<td class="fs-12"><code>' + U.escapeHtml(it.board_id) + '</code></td>' +
        '<td>' + inp('repo_path', it.repo_path) +
          '<div class="mt-1">' + inp('docs_path', it.docs_path || '') + '<span class="text-secondary" style="font-size:11px">docs (trống = &lt;repo&gt;/docs)</span></div>' +
          '<div class="mt-1"><textarea class="form-control form-control-sm" data-f="context_repo_paths" rows="2" placeholder="Repo ngữ cảnh — mỗi dòng 1 path (chỉ đọc)">' + U.escapeHtml(formatCtx(it.context_repo_paths)) + '</textarea><span class="text-secondary" style="font-size:11px">repo ngữ cảnh (chỉ đọc)</span></div></td>' +
        '<td>' + inp('base_branch', it.base_branch, 'max-width:130px') + '</td>' +
        '<td>' + badge + '</td>' +
        '<td class="text-end" style="white-space:nowrap">' +
          '<button class="btn btn-sm btn-theme" data-act="save" data-id="' + it.id + '" title="Lưu cấu hình"><i class="bi bi-save"></i></button> ' +
          '<button class="btn btn-sm btn-outline-theme" data-act="provision" data-id="' + it.id + '" title="Tạo các list và nhãn còn thiếu trên board"><i class="bi bi-list-check"></i></button> ' +
          '<button class="btn btn-sm btn-outline-theme" data-act="gendocs" data-id="' + it.id + '" title="Tạo hoặc cập nhật tài liệu dự án"><i class="bi bi-file-earmark-text"></i></button> ' +
          '<button class="btn btn-sm btn-outline-theme" data-act="gendocs-continue" data-id="' + it.id + '" title="Bổ sung tài liệu cho chức năng chưa có tài liệu"><i class="bi bi-file-earmark-plus"></i></button> ' +
          '<button class="btn btn-sm btn-outline-theme" data-act="gendocs-deepen" data-id="' + it.id + '" title="Viết chi tiết hơn các tài liệu còn sơ sài"><i class="bi bi-arrow-down-up"></i></button> ' +
          '<button class="btn btn-sm btn-outline-theme" data-act="genrules" data-id="' + it.id + '" title="Tạo file quy tắc framework cho ReviewAgent"><i class="bi bi-rulers"></i></button> ' +
          '<button class="btn btn-sm ' + (it.auto_pilot ? 'btn-success' : 'btn-outline-secondary') + '" data-act="autopilot" data-id="' + it.id + '" data-ap="' + (it.auto_pilot ? 0 : 1) + '" title="' + (it.auto_pilot ? 'Full-auto đang bật: agent tự chuyển card qua các stage. Bấm để tắt.' : 'Bật full-auto: agent tự chuyển card qua các stage') + '"><i class="bi bi-robot"></i></button> ' +
          '<button class="btn btn-sm btn-outline-theme" data-act="toggle" data-id="' + it.id + '" data-en="' + (it.enabled ? 0 : 1) + '" title="' + (it.enabled ? 'Tắt dự án' : 'Bật dự án') + '"><i class="bi bi-' + (it.enabled ? 'pause-circle' : 'play-circle') + '"></i></button> ' +
          '<button class="btn btn-sm btn-outline-danger" data-act="del" data-id="' + it.id + '" title="Xoá cấu hình"><i class="bi bi-trash"></i></button>' +
        '</td>' +
      '</tr>';
  }

  async function createRepo() {
    var val = function (id) { return document.getElementById(id).value.trim(); };
    var body = { board_id: val('f_board'), name: val('f_name'), repo_path: val('f_path'), base_branch: val('f_base') || 'main', docs_path: val('f_docs'), context_repo_paths: val('f_ctx') };
    if (!body.board_id || !body.name || !body.repo_path) { U.toast('Cần nhập Board ID, tên dự án và đường dẫn repo.', 'warning'); return; }
    try {
      await AdminApi.post('/repos', body);
      U.toast('Đã lưu dự án.', 'success');
      ['f_board', 'f_name', 'f_path', 'f_docs', 'f_ctx'].forEach(function (id) { var el = document.getElementById(id); if (el) el.value = ''; });
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
        tr.querySelectorAll('[data-f]').forEach(function (inp) { body[inp.getAttribute('data-f')] = inp.value.trim(); });
        if (!body.base_branch) { U.toast('Base branch không được để trống.', 'warning'); return; }
        await AdminApi.put('/repos/' + id, body);
        U.toast('Đã lưu cấu hình.', 'success');
        load();
      } else if (act === 'provision') {
        var rp = await AdminApi.post('/repos/' + id + '/provision', {});
        var p = (rp && rp.provision) || {};
        var nl = (p.createdLists || []).length, nb = (p.createdLabels || []).length, nr = (p.renamedLabels || []).length;
        U.toast((nl + nb + nr) ? ('Đã tạo ' + nl + ' list, ' + nb + ' nhãn mới, đặt tên cho ' + nr + ' nhãn chưa có tên.') : 'Board đã có đủ list và nhãn.', 'success');
      } else if (act === 'gendocs') {
        if (!confirm('Tạo tài liệu dự án trong thư mục docs? Việc này chạy nền và có thể mất vài phút. Kiểm tra lại rồi commit sau khi xong.')) return;
        var r = await AdminApi.post('/repos/' + id + '/gen-docs', {});
        U.toast((r && r.message) || 'Đang sinh tài liệu nền…', 'success');
      } else if (act === 'gendocs-continue') {
        if (!confirm('Bổ sung tài liệu cho các chức năng chưa có tài liệu? Các file đã có được giữ nguyên. Việc này chạy nền.')) return;
        var rc = await AdminApi.post('/repos/' + id + '/gen-docs', { mode: 'continue' });
        U.toast((rc && rc.message) || 'Đang bổ sung tài liệu nền…', 'success');
      } else if (act === 'gendocs-deepen') {
        if (!confirm('Viết chi tiết hơn các tài liệu còn sơ sài? Các file đã đầy đủ được giữ nguyên. Việc này chạy nền.')) return;
        var rd = await AdminApi.post('/repos/' + id + '/gen-docs', { mode: 'deepen' });
        U.toast((rd && rd.message) || 'Đang viết lại các tài liệu còn sơ sài…', 'success');
      } else if (act === 'genrules') {
        if (!confirm('Tạo file 00_FRAMEWORK_RULES.md tổng hợp quy tắc của framework để ReviewAgent tham chiếu? Việc này chạy nền.\n\nMục "Ghi chú người duyệt" (nếu có) được giữ nguyên.')) return;
        var rr = await AdminApi.post('/repos/' + id + '/gen-rules', {});
        U.toast((rr && rr.message) || 'Đang tạo file quy tắc framework…', 'success');
      } else if (act === 'autopilot') {
        var on = btn.getAttribute('data-ap') === '1';
        if (on && !confirm('Bật full-auto cho board này?\n\nAgent sẽ tự chuyển card qua Refine → Dev → Test → Done. Card bị FAIL được sửa lại tối đa theo số lần cấu hình, sau đó dừng chờ người xử lý. Agent không tự merge nhánh.')) return;
        await AdminApi.put('/repos/' + id, { auto_pilot: on });
        U.toast(on ? 'Đã bật full-auto cho board.' : 'Đã tắt full-auto.', 'success');
        load();
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
