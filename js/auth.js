const authContainer = document.getElementById('auth-container');
const appContainer = document.getElementById('app-container');
const loginForm = document.getElementById('login-form');
const signupForm = document.getElementById('signup-form');
const loginTab = document.getElementById('login-tab');
const signupTab = document.getElementById('signup-tab');
const logoutBtn = document.getElementById('logout-btn');
const userEmail = document.getElementById('user-email');
const authError = document.getElementById('auth-error');

function showAuth() {
  authContainer.classList.remove('hidden');
  appContainer.classList.add('hidden');
}

function showApp(session) {
  authContainer.classList.add('hidden');
  appContainer.classList.remove('hidden');
  userEmail.textContent = session.user.email;
  loadApp();
}

loginTab.addEventListener('click', () => {
  loginTab.classList.add('active');
  signupTab.classList.remove('active');
  loginForm.classList.remove('hidden');
  signupForm.classList.add('hidden');
  authError.textContent = '';
});

signupTab.addEventListener('click', () => {
  signupTab.classList.add('active');
  loginTab.classList.remove('active');
  signupForm.classList.remove('hidden');
  loginForm.classList.add('hidden');
  authError.textContent = '';
});

loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  authError.textContent = '';
  const email = document.getElementById('login-email').value;
  const password = document.getElementById('login-password').value;

  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    authError.textContent = error.message;
  }
});

signupForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  authError.textContent = '';
  const email = document.getElementById('signup-email').value;
  const password = document.getElementById('signup-password').value;

  const { error } = await supabase.auth.signUp({ email, password });
  if (error) {
    authError.textContent = error.message;
  } else {
    authError.style.color = '#27ae60';
    authError.textContent = 'Konto skapat! Kontrollera din e-post för verifiering.';
  }
});

logoutBtn.addEventListener('click', async () => {
  await supabase.auth.signOut();
});

supabase.auth.onAuthStateChange((event, session) => {
  if (session) {
    showApp(session);
  } else {
    showAuth();
  }
});

async function checkSession() {
  const { data: { session } } = await supabase.auth.getSession();
  if (session) {
    showApp(session);
  } else {
    showAuth();
  }
}

checkSession();
