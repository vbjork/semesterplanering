const ADMIN_EMAIL = 'v.bjork@outlook.com';

const authContainer = document.getElementById('auth-container');
const appContainer = document.getElementById('app-container');
const adminContainer = document.getElementById('admin-container');
const loginForm = document.getElementById('login-form');
const signupForm = document.getElementById('signup-form');
const resetForm = document.getElementById('reset-form');
const loginTab = document.getElementById('login-tab');
const signupTab = document.getElementById('signup-tab');
const logoutBtn = document.getElementById('logout-btn');
const userEmail = document.getElementById('user-email');
const authError = document.getElementById('auth-error');
const forgotLink = document.getElementById('forgot-link');
const backToLogin = document.getElementById('back-to-login');

let currentSession = null;

function isAdmin() {
  return currentSession && currentSession.user.email === ADMIN_EMAIL;
}

function showAuth() {
  authContainer.classList.remove('hidden');
  appContainer.classList.add('hidden');
  adminContainer.classList.add('hidden');
}

function showApp(session) {
  currentSession = session;
  authContainer.classList.add('hidden');
  appContainer.classList.remove('hidden');
  userEmail.textContent = session.user.email;

  if (isAdmin()) {
    document.getElementById('admin-btn').classList.remove('hidden');
  } else {
    document.getElementById('admin-btn').classList.add('hidden');
  }
  adminContainer.classList.add('hidden');

  loadApp();
}

function showResetForm() {
  loginForm.classList.add('hidden');
  signupForm.classList.add('hidden');
  resetForm.classList.remove('hidden');
  loginTab.classList.remove('active');
  signupTab.classList.remove('active');
  authError.textContent = '';
}

function showLoginForm() {
  resetForm.classList.add('hidden');
  signupForm.classList.add('hidden');
  loginForm.classList.remove('hidden');
  loginTab.classList.add('active');
  signupTab.classList.remove('active');
  authError.textContent = '';
}

loginTab.addEventListener('click', () => {
  showLoginForm();
});

signupTab.addEventListener('click', () => {
  signupTab.classList.add('active');
  loginTab.classList.remove('active');
  signupForm.classList.remove('hidden');
  loginForm.classList.add('hidden');
  resetForm.classList.add('hidden');
  authError.textContent = '';
});

forgotLink.addEventListener('click', (e) => {
  e.preventDefault();
  showResetForm();
});

backToLogin.addEventListener('click', (e) => {
  e.preventDefault();
  showLoginForm();
});

loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  authError.textContent = '';
  const email = document.getElementById('login-email').value;
  const password = document.getElementById('login-password').value;

  const { error } = await db.auth.signInWithPassword({ email, password });
  if (error) {
    authError.textContent = error.message;
  }
});

signupForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  authError.textContent = '';
  const email = document.getElementById('signup-email').value;
  const password = document.getElementById('signup-password').value;

  const { error } = await db.auth.signUp({ email, password });
  if (error) {
    authError.textContent = error.message;
  } else {
    authError.style.color = '#27ae60';
    authError.textContent = 'Konto skapat! Kontrollera din e-post för verifiering.';
  }
});

resetForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  authError.textContent = '';
  const email = document.getElementById('reset-email').value;

  const { error } = await db.auth.resetPasswordForEmail(email, {
    redirectTo: window.location.origin + window.location.pathname
  });
  if (error) {
    authError.textContent = error.message;
  } else {
    authError.style.color = '#27ae60';
    authError.textContent = 'Återställningslänk skickad till din e-post!';
  }
});

logoutBtn.addEventListener('click', async () => {
  await db.auth.signOut();
});

document.getElementById('admin-btn').addEventListener('click', () => {
  if (!isAdmin()) return;
  appContainer.classList.add('hidden');
  adminContainer.classList.remove('hidden');
  loadAdminPanel();
});

document.getElementById('admin-back-btn').addEventListener('click', () => {
  adminContainer.classList.add('hidden');
  appContainer.classList.remove('hidden');
});

document.getElementById('logout-btn-admin').addEventListener('click', async () => {
  await db.auth.signOut();
});

db.auth.onAuthStateChange(async (event, session) => {
  if (event === 'PASSWORD_RECOVERY') {
    const newPassword = prompt('Ange ditt nya lösenord (minst 6 tecken):');
    if (newPassword && newPassword.length >= 6) {
      const { error } = await db.auth.updateUser({ password: newPassword });
      if (error) {
        alert('Kunde inte uppdatera lösenord: ' + error.message);
      } else {
        alert('Lösenord uppdaterat!');
      }
    }
  }
  if (session) {
    showApp(session);
  } else {
    showAuth();
  }
});

async function loadAdminPanel() {
  const userList = document.getElementById('admin-user-list');
  userList.innerHTML = '<p style="color:var(--text-light)">Laddar användare...</p>';

  const { data, error } = await db.rpc('get_all_users');
  if (error) {
    userList.innerHTML = '<p style="color:var(--danger)">Kunde inte ladda användare. Kör admin-schemat i Supabase.</p>';
    return;
  }

  userList.innerHTML = '';
  if (!data || data.length === 0) {
    userList.innerHTML = '<p style="color:var(--text-light)">Inga användare registrerade.</p>';
    return;
  }

  const table = document.createElement('table');
  table.className = 'admin-table';
  table.innerHTML = `
    <thead>
      <tr>
        <th>E-post</th>
        <th>Registrerad</th>
        <th>Senast inloggad</th>
        <th>Anställda</th>
        <th>Åtgärd</th>
      </tr>
    </thead>
  `;
  const tbody = document.createElement('tbody');

  for (const user of data) {
    const { count } = await db
      .from('employees')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id);

    const row = document.createElement('tr');
    const created = new Date(user.created_at).toLocaleDateString('sv-SE');
    const lastLogin = user.last_sign_in_at
      ? new Date(user.last_sign_in_at).toLocaleDateString('sv-SE')
      : 'Aldrig';

    row.innerHTML = `
      <td>${user.email}</td>
      <td>${created}</td>
      <td>${lastLogin}</td>
      <td>${count || 0}</td>
      <td><button class="btn-danger btn-sm" data-id="${user.id}" data-email="${user.email}">Ta bort</button></td>
    `;
    tbody.appendChild(row);
  }

  table.appendChild(tbody);
  userList.appendChild(table);

  userList.querySelectorAll('.btn-danger').forEach(btn => {
    btn.addEventListener('click', async () => {
      const email = btn.dataset.email;
      const id = btn.dataset.id;
      if (email === ADMIN_EMAIL) {
        alert('Du kan inte ta bort adminkontot.');
        return;
      }
      if (!confirm(`Ta bort användare ${email}? Alla deras data raderas.`)) return;

      const { error } = await db.rpc('delete_user', { target_user_id: id });
      if (error) {
        alert('Kunde inte ta bort: ' + error.message);
      } else {
        loadAdminPanel();
      }
    });
  });
}

async function checkSession() {
  const { data: { session } } = await db.auth.getSession();
  if (session) {
    showApp(session);
  } else {
    showAuth();
  }
}

checkSession();
