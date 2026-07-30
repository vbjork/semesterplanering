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
const userEmailEl = document.getElementById('user-email');
const authMsg = document.getElementById('auth-msg');
const forgotLink = document.getElementById('forgot-link');
const backToLogin = document.getElementById('back-to-login');

let currentSession = null;

function isAdmin() {
  return currentSession && currentSession.user.email === ADMIN_EMAIL;
}

function showAuthMsg(text, type) {
  authMsg.textContent = text;
  authMsg.className = 'auth-msg ' + type;
}

function clearAuthMsg() {
  authMsg.textContent = '';
  authMsg.className = 'auth-msg';
}

function showAuth() {
  authContainer.classList.remove('hidden');
  appContainer.classList.add('hidden');
  adminContainer.classList.add('hidden');
  appLoaded = false;
}

function showApp(session) {
  currentSession = session;
  authContainer.classList.add('hidden');
  appContainer.classList.remove('hidden');
  adminContainer.classList.add('hidden');
  userEmailEl.textContent = session.user.email;

  const adminBtn = document.getElementById('admin-btn');
  if (isAdmin()) {
    adminBtn.classList.remove('hidden');
  } else {
    adminBtn.classList.add('hidden');
  }

  if (typeof loadApp === 'function') {
    loadApp();
  } else {
    window.addEventListener('load', () => loadApp());
  }
}

function showResetForm() {
  loginForm.classList.add('hidden');
  signupForm.classList.add('hidden');
  resetForm.classList.remove('hidden');
  loginTab.classList.remove('active');
  signupTab.classList.remove('active');
  clearAuthMsg();
}

function showLoginForm() {
  resetForm.classList.add('hidden');
  signupForm.classList.add('hidden');
  loginForm.classList.remove('hidden');
  loginTab.classList.add('active');
  signupTab.classList.remove('active');
  clearAuthMsg();
}

loginTab.addEventListener('click', showLoginForm);

signupTab.addEventListener('click', () => {
  signupTab.classList.add('active');
  loginTab.classList.remove('active');
  signupForm.classList.remove('hidden');
  loginForm.classList.add('hidden');
  resetForm.classList.add('hidden');
  clearAuthMsg();
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
  clearAuthMsg();
  const email = document.getElementById('login-email').value;
  const password = document.getElementById('login-password').value;

  const { error } = await db.auth.signInWithPassword({ email, password });
  if (error) {
    showAuthMsg(error.message, 'error');
  }
});

signupForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  clearAuthMsg();
  const email = document.getElementById('signup-email').value;
  const password = document.getElementById('signup-password').value;

  const { error } = await db.auth.signUp({ email, password });
  if (error) {
    showAuthMsg(error.message, 'error');
  } else {
    showAuthMsg('Konto skapat! Kontrollera din e-post för verifiering.', 'success');
  }
});

resetForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  clearAuthMsg();
  const email = document.getElementById('reset-email').value;

  const { error } = await db.auth.resetPasswordForEmail(email, {
    redirectTo: window.location.origin + window.location.pathname
  });
  if (error) {
    showAuthMsg(error.message, 'error');
  } else {
    showAuthMsg('Återställningslänk skickad till din e-post!', 'success');
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
  userList.innerHTML = '<p style="color:var(--color-text-muted)">Laddar användare...</p>';

  const { data, error } = await db.rpc('get_all_users');
  if (error) {
    userList.innerHTML = '<p style="color:var(--color-error)">Kunde inte ladda användare.</p>';
    return;
  }

  userList.innerHTML = '';
  if (!data || data.length === 0) {
    userList.innerHTML = '<p style="color:var(--color-text-muted)">Inga användare registrerade.</p>';
    return;
  }

  const table = document.createElement('table');
  table.className = 'admin-table';
  const thead = document.createElement('thead');
  thead.innerHTML = '<tr><th>E-post</th><th>Registrerad</th><th>Senast inloggad</th><th>Anställda</th><th>Åtgärd</th></tr>';
  table.appendChild(thead);

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

    const emailCell = document.createElement('td');
    emailCell.textContent = user.email;
    row.appendChild(emailCell);

    const createdCell = document.createElement('td');
    createdCell.textContent = created;
    row.appendChild(createdCell);

    const loginCell = document.createElement('td');
    loginCell.textContent = lastLogin;
    row.appendChild(loginCell);

    const countCell = document.createElement('td');
    countCell.textContent = count || 0;
    row.appendChild(countCell);

    const actionCell = document.createElement('td');
    const delBtn = document.createElement('button');
    delBtn.className = 'ds-btn ds-btn-danger ds-btn-sm';
    delBtn.textContent = 'Ta bort';
    delBtn.addEventListener('click', async () => {
      if (user.email === ADMIN_EMAIL) {
        alert('Du kan inte ta bort adminkontot.');
        return;
      }
      if (!confirm('Ta bort användare ' + user.email + '? Alla deras data raderas.')) return;
      const { error } = await db.rpc('delete_user', { target_user_id: user.id });
      if (error) {
        alert('Kunde inte ta bort: ' + error.message);
      } else {
        loadAdminPanel();
      }
    });
    actionCell.appendChild(delBtn);
    row.appendChild(actionCell);

    tbody.appendChild(row);
  }

  table.appendChild(tbody);
  userList.appendChild(table);
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
