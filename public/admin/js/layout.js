/* Dựng shell chung (nền + loader + header + sidebar) cho mọi trang admin.
   Chạy ĐỒNG BỘ trước jQuery/main.js để các handler của template tìm thấy DOM. */
(function (global) {
  'use strict';

  var NAV = [
    { href: 'index.html', icon: 'bi-kanban', label: 'Tasks', enabled: true },
    { href: 'repos.html', icon: 'bi-hdd-stack', label: 'Repos / Dự án', enabled: true },
    { href: 'skills.html', icon: 'bi-stars', label: 'Skills / Prompts', enabled: false },
    { href: 'agents.html', icon: 'bi-robot', label: 'Agents', enabled: false },
    { href: 'mcp.html', icon: 'bi-plugin', label: 'MCP', enabled: false },
  ];

  function currentFile() {
    var f = location.pathname.split('/').slice(-1)[0];
    return f || 'index.html';
  }

  function navHtml() {
    var cur = currentFile();
    return NAV.map(function (n) {
      var active = n.href === cur ? ' active' : '';
      if (!n.enabled) {
        return '<li class="nav-item"><a class="nav-link disabled text-muted" tabindex="-1" aria-disabled="true">' +
          '<div class="avatar avatar-40 icon"><i class="bi ' + n.icon + '"></i></div>' +
          '<div class="col">' + n.label + '</div>' +
          '<div class="arrow"><span class="badge bg-secondary">Sắp có</span></div></a></li>';
      }
      return '<li class="nav-item"><a class="nav-link' + active + '" href="' + n.href + '">' +
        '<div class="avatar avatar-40 icon"><i class="bi ' + n.icon + '"></i></div>' +
        '<div class="col">' + n.label + '</div>' +
        '<div class="arrow"><i class="bi bi-chevron-right"></i></div></a></li>';
    }).join('');
  }

  function shellHtml(title) {
    return '' +
      '<div class="container-fluid h-100 position-fixed loader-wrap bg-blur"><div class="row justify-content-center h-100"><div class="col-auto align-self-center text-center"><div class="spinner-border text-primary" role="status"><span class="visually-hidden">Loading...</span></div></div></div></div>' +
      '<div class="coverimg h-100 w-100 top-0 start-0 main-bg"><div class="bg-blur main-bg-overlay"></div><img src="assets/img/bg-14.jpg" alt="" /></div>' +
      '<header class="header"><nav class="navbar fixed-top"><div class="container-fluid">' +
        '<div class="sidebar-width">' +
          '<button class="btn btn-link btn-square menu-btn" type="button"><i class="bi bi-list fs-4"></i></button>' +
          '<a class="navbar-brand ms-2" href="index.html"><div class="row"><div class="col-auto"><img src="assets/img/favicon48.png" class="mx-100" alt="" /></div>' +
          '<div class="col ps-0 align-self-center d-none d-sm-block"><h5 class="fw-normal text-dark mb-0">AutoPilot</h5><p class="small text-secondary">Admin</p></div></div></a>' +
        '</div>' +
        '<div class="ms-auto d-flex align-items-center">' +
          '<h6 class="mb-0 me-2 d-none d-md-block" id="pageTitle">' + (title || '') + '</h6>' +
          '<button type="button" class="btn btn-square btn-link p-0" id="adminLogout" title="Đăng xuất"><i class="bi bi-box-arrow-right fs-5"></i></button>' +
        '</div>' +
      '</div></nav></header>' +
      '<div class="sidebar-wrap"><div class="sidebar"><div class="container">' +
        '<div class="row mb-4"><div class="col align-self-center"><h6>Điều hướng</h6></div></div>' +
        '<div class="row mb-4"><div class="col-12 px-0"><ul class="nav nav-pills">' + navHtml() + '</ul></div></div>' +
      '</div></div></div>';
  }

  // CSS chỉnh tinh: căn giữa dọc thanh header + chừa khoảng đệm trên cho .main (tránh nút sát header).
  function injectFixes() {
    if (document.getElementById('ap-layout-fixes')) return;
    var st = document.createElement('style');
    st.id = 'ap-layout-fixes';
    st.textContent =
      '.header .navbar > .container-fluid{align-items:center;}' +
      '.header .navbar .ms-auto{min-height:40px;}' +
      'main.main{margin-top:.5rem;}';
    document.head.appendChild(st);
  }

  function mount() {
    injectFixes();
    var holder = document.getElementById('app-shell');
    var title = (holder && holder.getAttribute('data-title')) || document.title;
    var div = document.createElement('div');
    div.innerHTML = shellHtml(title);
    // Chèn shell GIỮ ĐÚNG THỨ TỰ (loader, coverimg, header, sidebar-wrap) ngay trước .main.
    // Phải chèn trước node cố định (holder), KHÔNG dùng body.firstChild (sẽ đảo ngược thứ tự →
    // sidebar-wrap không còn liền .main → CSS .sidebar-wrap + .main mất tác dụng → đè nội dung).
    var ref = holder || document.body.firstChild;
    while (div.firstChild) document.body.insertBefore(div.firstChild, ref);
    if (holder) holder.parentNode.removeChild(holder);
  }

  mount();

  // Gắn nút đăng xuất sau khi jQuery/main.js đã nạp (DOMContentLoaded).
  document.addEventListener('DOMContentLoaded', function () {
    var btn = document.getElementById('adminLogout');
    if (btn) btn.addEventListener('click', function () {
      if (global.AdminApi) global.AdminApi.clearToken();
      location.href = 'login.html';
    });
  });
})(window);
