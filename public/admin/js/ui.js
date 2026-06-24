/* Tiện ích UI dùng chung: nhãn status, format thời gian, escape HTML, toast lỗi. */
(function (global) {
  'use strict';

  var STATUS = {
    queued:                 { cls: 'secondary', label: 'Trong hàng đợi' },
    processing:             { cls: 'primary',   label: 'Đang xử lý' },
    paused_for_confirmation:{ cls: 'secondary', label: 'Chờ xác nhận' },
    paused_for_plan_approval:{ cls: 'secondary',label: 'Chờ duyệt plan' },
    waiting_review:         { cls: 'info',      label: 'Chờ review' },
    completed:              { cls: 'success',   label: 'Hoàn thành' },
    failed:                 { cls: 'danger',    label: 'Lỗi' },
    halted:                 { cls: 'danger',    label: 'Bị dừng' },
    awaiting_clarification: { cls: 'warning',   label: 'Chờ làm rõ' },
    awaiting_plan_approval: { cls: 'info',      label: 'Chờ duyệt plan' },
    plan_approved:          { cls: 'info',      label: 'Đã duyệt plan' },
    developing:             { cls: 'primary',   label: 'Đang code' },
    dev_done:               { cls: 'info',      label: 'Code xong' },
    testing:                { cls: 'primary',   label: 'Đang review' },
    review_failed:          { cls: 'warning',   label: 'Review FAIL' },
  };

  function escapeHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function statusMeta(status) {
    return STATUS[status] || { cls: 'secondary', label: status || '—' };
  }

  function statusBadge(status) {
    var m = statusMeta(status);
    return '<span class="badge bg-' + m.cls + '">' + escapeHtml(m.label) + '</span>';
  }

  function formatDate(ms) {
    if (!ms) return '—';
    var d = new Date(Number(ms));
    if (isNaN(d.getTime())) return '—';
    var p = function (n) { return (n < 10 ? '0' : '') + n; };
    return p(d.getDate()) + '/' + p(d.getMonth() + 1) + '/' + d.getFullYear() + ' ' + p(d.getHours()) + ':' + p(d.getMinutes());
  }

  function timeAgo(ms) {
    if (!ms) return '';
    var diff = Date.now() - Number(ms);
    var mins = Math.floor(diff / 60000);
    if (mins < 1) return 'vừa xong';
    if (mins < 60) return mins + ' phút trước';
    var hrs = Math.floor(mins / 60);
    if (hrs < 24) return hrs + ' giờ trước';
    return Math.floor(hrs / 24) + ' ngày trước';
  }

  // Số nguyên có dấu phân nhóm (vi-VN: 1.234.567).
  function fmtNum(n) {
    var v = Number(n) || 0;
    return v.toLocaleString('vi-VN');
  }

  // Token gọn: 1234 → "1,2K" · 1234567 → "1,23M" (đỡ rối khi số lớn).
  function fmtTokens(n) {
    var v = Number(n) || 0;
    if (v >= 1e6) return (v / 1e6).toFixed(2).replace('.', ',') + 'M';
    if (v >= 1e3) return (v / 1e3).toFixed(1).replace('.', ',') + 'K';
    return String(v);
  }

  // USD: <$0,01 hiện "<$0,01"; còn lại 2–4 chữ số thập phân.
  function fmtUsd(n) {
    var v = Number(n) || 0;
    if (v === 0) return '$0';
    if (v < 0.01) return '<$0,01';
    return '$' + v.toFixed(v < 1 ? 4 : 2).replace('.', ',');
  }

  function toast(msg, type) {
    var el = document.createElement('div');
    el.className = 'alert alert-' + (type || 'danger') + ' shadow position-fixed top-0 end-0 m-3';
    el.style.zIndex = 2000;
    el.textContent = msg;
    document.body.appendChild(el);
    setTimeout(function () { el.remove(); }, 4000);
  }

  global.AdminUI = {
    escapeHtml: escapeHtml,
    statusMeta: statusMeta,
    statusBadge: statusBadge,
    formatDate: formatDate,
    timeAgo: timeAgo,
    fmtNum: fmtNum,
    fmtTokens: fmtTokens,
    fmtUsd: fmtUsd,
    toast: toast,
  };
})(window);
