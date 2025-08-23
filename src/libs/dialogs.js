// src/libs/dialogs.js
import Swal from 'sweetalert2';

function escapeHtml(s = '') {
  return String(s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export async function confirmDelete(label) {
  const html = `You are about to remove <b>${escapeHtml(label || 'this record')}</b>.<br/>
                This is a <b>soft delete</b> and can be restored by an admin.`;

  const res = await Swal.fire({
    title: 'Delete record?',
    html,
    icon: 'warning',
    showCancelButton: true,
    confirmButtonText: 'Yes, delete',
    cancelButtonText: 'Cancel',
    reverseButtons: true,
    focusCancel: true,
    confirmButtonColor: '#991B1B',  // danger
    cancelButtonColor: '#334155',   // slate
    backdrop: 'rgba(15,23,42,0.55)',
  });

  return res.isConfirmed;
}