import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.14.0/firebase-app.js';
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  runTransaction,
  onSnapshot
} from 'https://www.gstatic.com/firebasejs/10.14.0/firebase-firestore.js';
import { firebaseConfig } from './firebase-config.js';

function createUser({ username, password, role, displayName }) {
  return {
    username,
    password,
    role,
    displayName,
    wallet: {
      balance: 0,
      incomes: [],
      expenses: []
    }
  };
}

const defaultState = {
  users: {
    admin: createUser({
      username: 'admin',
      password: 'admin123',
      role: 'admin',
      displayName: 'Administrador'
    }),
    carlota: createUser({
      username: 'carlota',
      password: 'carlota123',
      role: 'basic',
      displayName: 'Carlota'
    })
  },
  categories: ['Exámenes', 'Tareas del hogar', 'Gastos fijos', 'Gastos extras'],
  tasks: [],
  nextTaskId: 1
};

const LOCAL_STORAGE_KEY = 'familia-app-state';

const state = {
  users: {},
  categories: [],
  tasks: [],
  nextTaskId: 1,
  loggedUser: null,
  selectedKidCategory: null,
  ready: false
};

let persistenceMode = 'firestore';
let firebaseApp = null;
let db = null;
let appStateRef = null;
let unsubscribeFirestore = null;

const loginSection = document.getElementById('login-section');
const adminSection = document.getElementById('admin-section');
const basicSection = document.getElementById('basic-section');
const loginForm = document.getElementById('login-form');
const loginError = document.getElementById('login-error');
const logoutAdminBtn = document.getElementById('logout-admin');
const logoutBasicBtn = document.getElementById('logout-basic');

const taskForm = document.getElementById('task-form');
const taskCategorySelect = document.getElementById('task-category');
const taskUserSelect = document.getElementById('task-user');
const adminTaskList = document.getElementById('admin-task-list');

const categoryList = document.getElementById('category-list');
const categoryForm = document.getElementById('category-form');
const newCategoryInput = document.getElementById('new-category');

const tabButtons = Array.from(document.querySelectorAll('.tab-button'));
const tabPanels = Array.from(document.querySelectorAll('.tab-panel'));

const incomeForm = document.getElementById('income-form');
const incomeUserSelect = document.getElementById('income-user');
const incomeAmountInput = document.getElementById('income-amount');
const incomeDescriptionInput = document.getElementById('income-description');

const fixedExpenseForm = document.getElementById('fixed-expense-form');
const fixedUserSelect = document.getElementById('fixed-user');
const fixedAmountInput = document.getElementById('fixed-amount');
const fixedDescriptionInput = document.getElementById('fixed-description');

const extraExpenseForm = document.getElementById('extra-expense-form');
const extraUserSelect = document.getElementById('extra-user');
const extraAmountInput = document.getElementById('extra-amount');
const extraDescriptionInput = document.getElementById('extra-description');

const walletOverview = document.getElementById('wallet-overview');

const kidName = document.getElementById('kid-name');
const kidBalance = document.getElementById('kid-balance');
const kidIncomeHistory = document.getElementById('kid-income-history');
const kidExpenseHistory = document.getElementById('kid-expense-history');
const kidCategoryTabs = document.getElementById('kid-category-tabs');
const kidTaskPanel = document.getElementById('kid-task-panel');

let resolveInitialData;
const initialDataPromise = new Promise(resolve => {
  resolveInitialData = resolve;
});

determinePersistenceMode();

init().catch(error => {
  console.error('Error al iniciar la aplicación:', error);
  if (loginError) {
    loginError.textContent = 'No se pudo iniciar la aplicación. Revisa la consola para más detalles.';
  }
});

async function init() {
  if (persistenceMode === 'firestore') {
    try {
      await ensureAppStateDocument();
    } catch (error) {
      handlePersistenceFailure(error, 'No se pudo sincronizar con Firestore. Se usará almacenamiento local.');
    }
  }

  if (persistenceMode === 'local' && !state.ready) {
    applyAppState(loadLocalAppState());
    finishInitialDataLoad();
  }

  if (persistenceMode === 'firestore') {
    setupRealtimeSync();
  }

  await initialDataPromise;
  setupLogin();
  setupTabs();
  setupForms();
  refreshUI();
}

function determinePersistenceMode() {
  const requiredKeys = ['apiKey', 'authDomain', 'projectId', 'appId'];
  const missingKeys = requiredKeys.filter(
    key => !firebaseConfig[key] || firebaseConfig[key].includes('REEMPLAZA')
  );

  if (missingKeys.length > 0) {
    const message =
      'Configura firebase-config.js con las credenciales de tu proyecto de Firebase para activar la sincronización.';
    console.warn(message);
    if (loginError) {
      loginError.textContent = `${message} Se usará almacenamiento local temporal.`;
    }
    activateLocalPersistence();
    return;
  }

  try {
    firebaseApp = initializeApp(firebaseConfig);
    db = getFirestore(firebaseApp);
    appStateRef = doc(db, 'appState', 'global');
  } catch (error) {
    handlePersistenceFailure(error, 'No se pudo inicializar Firebase. Se usará almacenamiento local.');
  }
}

async function ensureAppStateDocument() {
  if (persistenceMode !== 'firestore') {
    return;
  }
  const snapshot = await getDoc(appStateRef);
  if (!snapshot.exists()) {
    await setDoc(appStateRef, JSON.parse(JSON.stringify(defaultState)));
  }
}

function setupRealtimeSync() {
  if (persistenceMode !== 'firestore') {
    return;
  }
  if (typeof unsubscribeFirestore === 'function') {
    unsubscribeFirestore();
  }

  unsubscribeFirestore = onSnapshot(
    appStateRef,
    snapshot => {
      if (!snapshot.exists()) {
        return;
      }
      const data = snapshot.data();
      saveLocalAppState(data);
      applyAppState(data);
      finishInitialDataLoad();
      refreshUI();
    },
    error => {
      console.error('Error al sincronizar con Firestore:', error);
      handlePersistenceFailure(error, 'Se perdió la conexión con Firestore. Se usará almacenamiento local.');
    }
  );
}

function finishInitialDataLoad() {
  if (!state.ready) {
    state.ready = true;
    if (typeof resolveInitialData === 'function') {
      resolveInitialData();
    }
  }
}

function activateLocalPersistence() {
  persistenceMode = 'local';
  if (typeof unsubscribeFirestore === 'function') {
    unsubscribeFirestore();
    unsubscribeFirestore = null;
  }
}

function handlePersistenceFailure(error, message) {
  console.error(message || 'Error de persistencia', error);
  if (persistenceMode === 'firestore') {
    if (loginError && !loginError.textContent) {
      loginError.textContent =
        'No se pudo conectar con la nube. Trabajarás con datos locales en este navegador.';
    }
    activateLocalPersistence();
    const localState = loadLocalAppState();
    applyAppState(localState);
    finishInitialDataLoad();
    refreshUI();
  }
}

function shouldFallbackToLocal(error) {
  if (!error) {
    return false;
  }
  if (typeof error.code === 'string') {
    const fallbackCodes = new Set([
      'permission-denied',
      'unauthenticated',
      'unavailable',
      'failed-precondition',
      'deadline-exceeded',
      'internal'
    ]);
    if (fallbackCodes.has(error.code)) {
      return true;
    }
  }
  const message = String(error.message || '').toLowerCase();
  if (message.includes('permission') || message.includes('firestore') || message.includes('network')) {
    return true;
  }
  return false;
}

function loadLocalAppState() {
  if (typeof localStorage === 'undefined') {
    return deepClone(defaultState);
  }
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (!raw) {
      const initial = deepClone(defaultState);
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(initial));
      return initial;
    }
    const parsed = JSON.parse(raw);
    return normalizeAppState(parsed);
  } catch (error) {
    console.warn('No se pudo leer el estado local. Se reiniciará con los valores por defecto.', error);
    return deepClone(defaultState);
  }
}

function saveLocalAppState(data) {
  if (typeof localStorage === 'undefined') {
    return;
  }
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(normalizeAppState(data)));
  } catch (error) {
    console.warn('No se pudo guardar el estado local.', error);
  }
}

function normalizeAppState(data) {
  const safeData = deepClone(data || {});
  const normalized = {
    ...safeData,
    users: safeData.users && typeof safeData.users === 'object'
      ? safeData.users
      : deepClone(defaultState.users),
    categories: Array.isArray(safeData.categories)
      ? safeData.categories
      : [...defaultState.categories],
    tasks: Array.isArray(safeData.tasks) ? safeData.tasks : [],
    nextTaskId: typeof safeData.nextTaskId === 'number' ? safeData.nextTaskId : 1
  };
  return normalized;
}

function applyAppState(data) {
  const normalized = normalizeAppState(data);
  state.users = normalized.users;
  state.categories = normalized.categories;
  state.tasks = normalized.tasks;
  state.nextTaskId = normalized.nextTaskId;
}

function deepClone(value) {
  if (typeof value === 'undefined') {
    return undefined;
  }
  return JSON.parse(JSON.stringify(value));
}

function setupLogin() {
  loginForm.addEventListener('submit', event => {
    event.preventDefault();
    const username = document.getElementById('username').value.trim().toLowerCase();
    const password = document.getElementById('password').value;

    const user = state.users[username];

    if (!user || user.password !== password) {
      loginError.textContent = 'Usuario o contraseña incorrectos.';
      return;
    }

    loginError.textContent = '';
    state.loggedUser = user;

    if (user.role === 'admin') {
      showAdminPanel();
    } else {
      showBasicPanel(user);
    }

    loginForm.reset();
  });

  logoutAdminBtn.addEventListener('click', handleLogout);
  logoutBasicBtn.addEventListener('click', handleLogout);
}

function handleLogout() {
  state.loggedUser = null;
  state.selectedKidCategory = null;
  adminSection.classList.add('hidden');
  basicSection.classList.add('hidden');
  loginSection.classList.remove('hidden');
}

function setupTabs() {
  tabButtons.forEach(button => {
    button.addEventListener('click', () => {
      const target = button.dataset.tab;
      tabButtons.forEach(btn => btn.classList.toggle('active', btn === button));
      tabPanels.forEach(panel => panel.classList.toggle('active', panel.id === target));
    });
  });
}

function setupForms() {
  taskForm.addEventListener('submit', async event => {
    event.preventDefault();
    const title = document.getElementById('task-title').value.trim();
    const description = document.getElementById('task-description').value.trim();
    const category = taskCategorySelect.value;
    const username = taskUserSelect.value;

    if (!title || !description || !category || !username) {
      return;
    }

    try {
      await addTask({ title, description, category, username });
      taskForm.reset();
    } catch (error) {
      console.error('Error al crear la tarea:', error);
      alert('No se pudo crear la tarea. Revisa la consola para más detalles.');
    }
  });

  categoryForm.addEventListener('submit', async event => {
    event.preventDefault();
    const newCategory = newCategoryInput.value.trim();
    if (!newCategory) return;

    try {
      await addCategory(newCategory);
      newCategoryInput.value = '';
    } catch (error) {
      console.error('Error al crear el apartado:', error);
      alert('No se pudo crear el apartado. Revisa la consola para más detalles.');
    }
  });

  incomeForm.addEventListener('submit', async event => {
    event.preventDefault();
    const username = incomeUserSelect.value;
    const amount = Number(incomeAmountInput.value);
    const description = incomeDescriptionInput.value.trim();
    if (!username || isNaN(amount) || amount <= 0 || !description) return;

    try {
      await registerWalletMovement(username, amount, description, 'income');
      incomeForm.reset();
    } catch (error) {
      console.error('Error al registrar el ingreso:', error);
      alert('No se pudo registrar el ingreso. Revisa la consola para más detalles.');
    }
  });

  fixedExpenseForm.addEventListener('submit', async event => {
    event.preventDefault();
    const username = fixedUserSelect.value;
    const amount = Number(fixedAmountInput.value);
    const description = fixedDescriptionInput.value.trim();
    if (!username || isNaN(amount) || amount <= 0 || !description) return;

    try {
      await registerWalletMovement(username, amount, description, 'fixed-expense');
      fixedExpenseForm.reset();
    } catch (error) {
      console.error('Error al registrar el gasto fijo:', error);
      alert('No se pudo registrar el gasto fijo. Revisa la consola para más detalles.');
    }
  });

  extraExpenseForm.addEventListener('submit', async event => {
    event.preventDefault();
    const username = extraUserSelect.value;
    const amount = Number(extraAmountInput.value);
    const description = extraDescriptionInput.value.trim();
    if (!username || isNaN(amount) || amount <= 0 || !description) return;

    try {
      await registerWalletMovement(username, amount, description, 'extra-expense');
      extraExpenseForm.reset();
    } catch (error) {
      console.error('Error al registrar el gasto extra:', error);
      alert('No se pudo registrar el gasto extra. Revisa la consola para más detalles.');
    }
  });
}

async function addTask({ title, description, category, username }) {
  await updateAppState(current => {
    const users = current.users || {};
    if (!users[username]) {
      throw new Error('El usuario seleccionado no existe.');
    }

    const nextTaskId = current.nextTaskId || 1;
    const tasks = Array.isArray(current.tasks) ? [...current.tasks] : [];
    tasks.push({
      id: nextTaskId,
      title,
      description,
      category,
      assignedTo: username,
      completed: false,
      type: category === 'Exámenes' ? 'exam' : 'general',
      score: null,
      rewardGranted: false
    });

    return {
      ...current,
      tasks,
      nextTaskId: nextTaskId + 1
    };
  });
}

async function addCategory(newCategory) {
  await updateAppState(current => {
    const categories = Array.isArray(current.categories) ? [...current.categories] : [];
    if (categories.includes(newCategory)) {
      return current;
    }
    categories.push(newCategory);
    return {
      ...current,
      categories
    };
  });
}

async function registerWalletMovement(username, amount, description, type) {
  await updateAppState(current => {
    const users = { ...(current.users || {}) };
    const user = users[username];
    if (!user) {
      throw new Error('El usuario no existe.');
    }

    const wallet = {
      balance: Number(user.wallet?.balance || 0),
      incomes: Array.isArray(user.wallet?.incomes) ? [...user.wallet.incomes] : [],
      expenses: Array.isArray(user.wallet?.expenses) ? [...user.wallet.expenses] : []
    };

    const entry = {
      amount,
      description,
      date: new Date().toLocaleDateString()
    };

    if (type === 'income') {
      wallet.balance += amount;
      wallet.incomes.push(entry);
    } else {
      wallet.balance -= amount;
      wallet.expenses.push(entry);
    }

    users[username] = {
      ...user,
      wallet
    };

    return {
      ...current,
      users
    };
  });
}

async function updateTaskCompletion(taskId, completed) {
  await updateAppState(current => {
    const tasks = Array.isArray(current.tasks)
      ? current.tasks.map(task => (task.id !== taskId ? task : { ...task, completed }))
      : [];
    return {
      ...current,
      tasks
    };
  });
}

async function saveExamResult({ taskId, username, score, reward }) {
  await updateAppState(current => {
    const existingTasks = Array.isArray(current.tasks) ? [...current.tasks] : [];
    const targetTask = existingTasks.find(task => task.id === taskId);
    if (!targetTask) {
      throw new Error('La tarea seleccionada no existe.');
    }
    if (targetTask.rewardGranted) {
      return current;
    }

    const users = { ...(current.users || {}) };
    const user = users[username];
    if (!user) {
      throw new Error('El usuario no existe.');
    }

    const updatedTasks = existingTasks.map(task => {
      if (task.id !== taskId) return task;
      return {
        ...task,
        score,
        rewardGranted: true,
        rewardAmount: reward
      };
    });

    const wallet = {
      balance: Number(user.wallet?.balance || 0),
      incomes: Array.isArray(user.wallet?.incomes) ? [...user.wallet.incomes] : [],
      expenses: Array.isArray(user.wallet?.expenses) ? [...user.wallet.expenses] : []
    };

    const description = `Recompensa examen "${targetTask.title}"`;
    const baseEntry = {
      description,
      date: new Date().toLocaleDateString()
    };

    if (reward > 0) {
      wallet.balance += reward;
      wallet.incomes.push({ ...baseEntry, amount: reward });
    } else if (reward < 0) {
      wallet.balance += reward;
      wallet.expenses.push({ ...baseEntry, amount: Math.abs(reward) });
    } else {
      wallet.incomes.push({ ...baseEntry, amount: 0 });
    }

    users[username] = {
      ...user,
      wallet
    };

    return {
      ...current,
      users,
      tasks: updatedTasks
    };
  });
}

function showAdminPanel() {
  loginSection.classList.add('hidden');
  adminSection.classList.remove('hidden');
  populateUserSelects();
  renderCategoryOptions();
  renderAdminTaskList();
  renderCategoryList();
  renderWalletOverview();
}

function populateUserSelects() {
  const basicUsers = Object.values(state.users).filter(user => user.role === 'basic');
  const selects = [taskUserSelect, incomeUserSelect, fixedUserSelect, extraUserSelect];
  selects.forEach(select => {
    if (!select) return;
    select.innerHTML = '';
    basicUsers.forEach(user => {
      const option = document.createElement('option');
      option.value = user.username;
      option.textContent = user.displayName;
      select.appendChild(option);
    });
  });
}

function renderCategoryOptions() {
  if (!taskCategorySelect) return;
  taskCategorySelect.innerHTML = '';
  state.categories.forEach(category => {
    const option = document.createElement('option');
    option.value = category;
    option.textContent = category;
    taskCategorySelect.appendChild(option);
  });
}

function renderAdminTaskList() {
  if (!adminTaskList) return;
  adminTaskList.innerHTML = '';
  if (state.tasks.length === 0) {
    adminTaskList.innerHTML = '<p>No has creado ninguna tarea todavía.</p>';
    return;
  }

  state.tasks.forEach(task => {
    const template = document.getElementById('task-template');
    const node = template.content.cloneNode(true);
    node.querySelector('.task-title').textContent = task.title;
    node.querySelector('.task-description').textContent = task.description;
    const assignedUser = state.users[task.assignedTo];
    const assignedName = assignedUser ? assignedUser.displayName : task.assignedTo;
    node.querySelector('.task-meta').textContent = `${task.category} · Asignada a ${assignedName}`;

    const status = document.createElement('span');
    status.classList.add('status-badge', task.completed ? 'status-done' : 'status-open');
    status.textContent = task.completed ? 'Terminada' : 'Pendiente';
    node.querySelector('.task-actions').appendChild(status);

    adminTaskList.appendChild(node);
  });
}

function renderCategoryList() {
  if (!categoryList) return;
  categoryList.innerHTML = '';
  state.categories.forEach(category => {
    const li = document.createElement('li');
    li.textContent = category;
    categoryList.appendChild(li);
  });
}

function renderWalletOverview() {
  if (!walletOverview) return;
  walletOverview.innerHTML = '';
  const basicUsers = Object.values(state.users).filter(user => user.role === 'basic');
  if (basicUsers.length === 0) {
    walletOverview.innerHTML = '<p>No hay usuarios básicos registrados.</p>';
    return;
  }

  basicUsers.forEach(user => {
    const card = document.createElement('div');
    card.classList.add('wallet-card');
    card.innerHTML = `
      <h3>${user.displayName}</h3>
      <p class="wallet-amount">${formatCurrency(Number(user.wallet?.balance || 0))}</p>
      <div class="wallet-history">
        <div>
          <h4>Ingresos</h4>
          <ul>${
            (user.wallet?.incomes || []).map(item => `<li>${item.date}: +${formatCurrency(item.amount)} · ${item.description}</li>`).join('') ||
            '<li>Aún no hay ingresos</li>'
          }</ul>
        </div>
        <div>
          <h4>Gastos</h4>
          <ul>${
            (user.wallet?.expenses || []).map(item => `<li>${item.date}: -${formatCurrency(item.amount)} · ${item.description}</li>`).join('') ||
            '<li>Aún no hay gastos</li>'
          }</ul>
        </div>
      </div>
    `;
    walletOverview.appendChild(card);
  });
}

function showBasicPanel(user) {
  loginSection.classList.add('hidden');
  adminSection.classList.add('hidden');
  basicSection.classList.remove('hidden');
  state.selectedKidCategory = null;
  renderKidDashboard(user);
}

function renderKidDashboard(user) {
  if (!user) {
    kidName.textContent = '¡Hola!';
    kidBalance.textContent = '0.00';
    kidIncomeHistory.innerHTML = '';
    kidExpenseHistory.innerHTML = '';
    kidCategoryTabs.innerHTML = '<p>No hay usuario seleccionado.</p>';
    kidTaskPanel.innerHTML = '';
    return;
  }
  kidName.textContent = `Hola, ${user.displayName} 👋`;
  renderKidWallet(user);
  if (!state.selectedKidCategory || !state.categories.includes(state.selectedKidCategory)) {
    state.selectedKidCategory = state.categories[0] || null;
  }
  renderKidCategories(user);
  if (state.selectedKidCategory) {
    renderKidTasks(user, state.selectedKidCategory);
  } else {
    kidTaskPanel.innerHTML = '<p>Aún no hay apartados disponibles.</p>';
  }
}

function renderKidWallet(user) {
  const balance = Number(user.wallet?.balance || 0);
  kidBalance.textContent = formatNumber(balance);
  kidIncomeHistory.innerHTML = '';
  kidExpenseHistory.innerHTML = '';

  const incomes = Array.isArray(user.wallet?.incomes) ? [...user.wallet.incomes].reverse() : [];
  const expenses = Array.isArray(user.wallet?.expenses) ? [...user.wallet.expenses].reverse() : [];

  if (incomes.length === 0) {
    const li = document.createElement('li');
    li.textContent = 'Sin ingresos todavía';
    kidIncomeHistory.appendChild(li);
  } else {
    incomes.forEach(entry => {
      const li = document.createElement('li');
      li.textContent = `${entry.date}: +${formatCurrency(entry.amount)} · ${entry.description}`;
      kidIncomeHistory.appendChild(li);
    });
  }

  if (expenses.length === 0) {
    const li = document.createElement('li');
    li.textContent = 'Sin gastos todavía';
    kidExpenseHistory.appendChild(li);
  } else {
    expenses.forEach(entry => {
      const li = document.createElement('li');
      li.textContent = `${entry.date}: -${formatCurrency(entry.amount)} · ${entry.description}`;
      kidExpenseHistory.appendChild(li);
    });
  }
}

function renderKidCategories(user) {
  kidCategoryTabs.innerHTML = '';
  if (state.categories.length === 0) {
    kidCategoryTabs.innerHTML = '<p>No hay apartados disponibles.</p>';
    return;
  }

  state.categories.forEach(category => {
    const button = document.createElement('button');
    button.type = 'button';
    button.classList.add('kid-tab');
    if (category === state.selectedKidCategory) {
      button.classList.add('active');
    }
    button.textContent = category;
    button.addEventListener('click', () => {
      state.selectedKidCategory = category;
      Array.from(kidCategoryTabs.children).forEach(child => child.classList.remove('active'));
      button.classList.add('active');
      renderKidTasks(user, category);
    });
    kidCategoryTabs.appendChild(button);
  });
}

function renderKidTasks(user, category) {
  kidTaskPanel.innerHTML = '';
  const tasks = state.tasks.filter(task => task.assignedTo === user.username && task.category === category);

  if (tasks.length === 0) {
    const card = document.createElement('div');
    card.classList.add('kid-task-card');
    card.innerHTML = `<p>No tienes tareas en "${category}" por ahora.</p>`;
    kidTaskPanel.appendChild(card);
    return;
  }

  tasks.forEach(task => {
    const card = document.createElement('div');
    card.classList.add('kid-task-card');
    card.innerHTML = `
      <div>
        <h3>${task.title}</h3>
        <p>${task.description}</p>
      </div>
    `;

    const actions = document.createElement('div');
    actions.classList.add('actions');

    const checkLabel = document.createElement('label');
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.classList.add('kid-checkbox');
    checkbox.checked = Boolean(task.completed);
    checkbox.addEventListener('change', async () => {
      const newValue = checkbox.checked;
      try {
        await updateTaskCompletion(task.id, newValue);
      } catch (error) {
        console.error('Error al actualizar el estado de la tarea:', error);
        checkbox.checked = !newValue;
        alert('No se pudo actualizar la tarea. Revisa la consola para más detalles.');
      }
    });

    checkLabel.appendChild(checkbox);
    checkLabel.append(' ¡Tarea terminada!');
    actions.appendChild(checkLabel);

    if (task.type === 'exam') {
      const scoreLabel = document.createElement('label');
      scoreLabel.textContent = 'Tu nota:';
      const scoreInput = document.createElement('input');
      scoreInput.type = 'number';
      scoreInput.classList.add('score-input');
      scoreInput.min = '0';
      scoreInput.max = '10';
      scoreInput.step = '0.01';
      if (typeof task.score === 'number') {
        scoreInput.value = task.score.toString();
      }

      const saveButton = document.createElement('button');
      saveButton.type = 'button';
      saveButton.classList.add('primary-btn');
      saveButton.textContent = task.rewardGranted ? 'Recompensa guardada' : 'Guardar nota';
      if (task.rewardGranted) {
        saveButton.disabled = true;
      }

      const rewardInfo = document.createElement('span');
      rewardInfo.classList.add('reward-label');
      if (task.rewardGranted && typeof task.rewardAmount === 'number') {
        rewardInfo.textContent = ` Recompensa: ${formatCurrency(Math.abs(task.rewardAmount))}`;
        if (task.rewardAmount < 0) {
          rewardInfo.textContent = ` Penalización: ${formatCurrency(Math.abs(task.rewardAmount))}`;
        }
      }

      saveButton.addEventListener('click', async () => {
        const score = parseFloat(scoreInput.value);
        if (isNaN(score) || score < 0 || score > 10) {
          alert('Introduce una nota entre 0 y 10.');
          return;
        }
        const reward = calculateExamReward(score);
        try {
          await saveExamResult({
            taskId: task.id,
            username: user.username,
            score,
            reward
          });
        } catch (error) {
          console.error('Error al guardar la recompensa del examen:', error);
          alert('No se pudo guardar la recompensa. Revisa la consola para más detalles.');
          return;
        }
        saveButton.textContent = 'Recompensa guardada';
        saveButton.disabled = true;
        if (reward > 0) {
          rewardInfo.textContent = ` Recompensa: ${formatCurrency(reward)}`;
        } else if (reward < 0) {
          rewardInfo.textContent = ` Penalización: ${formatCurrency(Math.abs(reward))}`;
        } else {
          rewardInfo.textContent = ' Recompensa: 0, ¡a seguir esforzándote!';
        }
      });

      scoreLabel.appendChild(scoreInput);
      actions.appendChild(scoreLabel);
      actions.appendChild(saveButton);
      actions.appendChild(rewardInfo);
    }

    card.appendChild(actions);
    kidTaskPanel.appendChild(card);
  });
}

function calculateExamReward(score) {
  if (score >= 9 && score <= 10) {
    return 10;
  }
  if (score >= 8.5 && score < 9) {
    return 5;
  }
  if (score >= 8 && score < 8.5) {
    return 0;
  }
  if (score >= 7.5 && score < 8) {
    return -5;
  }
  if (score < 7.5) {
    const difference = 7.49 - score;
    const extraSteps = Math.min(4, Math.max(0, Math.floor(difference)));
    return -10 - extraSteps * 10;
  }
  return 0;
}

function refreshUI() {
  renderCategoryOptions();
  renderAdminTaskList();
  renderCategoryList();
  renderWalletOverview();

  if (!state.loggedUser) {
    return;
  }

  const updatedUser = state.users[state.loggedUser.username];
  if (!updatedUser) {
    return;
  }

  state.loggedUser = updatedUser;
  if (updatedUser.role === 'admin' && !adminSection.classList.contains('hidden')) {
    populateUserSelects();
  }
  if (updatedUser.role === 'basic' && !basicSection.classList.contains('hidden')) {
    renderKidDashboard(updatedUser);
  }
}

async function updateAppState(mutator) {
  if (persistenceMode === 'firestore') {
    try {
      await runTransaction(db, async transaction => {
        const snapshot = await transaction.get(appStateRef);
        if (!snapshot.exists()) {
          throw new Error('No se encontró el estado de la aplicación.');
        }
        const current = normalizeAppState(snapshot.data());
        const updated = normalizeAppState(mutator(deepClone(current)) || current);
        transaction.set(appStateRef, updated);
      });
      return;
    } catch (error) {
      if (shouldFallbackToLocal(error)) {
        handlePersistenceFailure(error, 'Error al actualizar en Firestore. Se usará almacenamiento local.');
        if (persistenceMode === 'local') {
          return updateAppState(mutator);
        }
      }
      throw error;
    }
  }

  const current = loadLocalAppState();
  const updated = normalizeAppState(mutator(deepClone(current)) || current);
  saveLocalAppState(updated);
  applyAppState(updated);
  refreshUI();
}

function formatCurrency(value) {
  const numericValue = Number(value) || 0;
  return `${numericValue.toFixed(2)} €`;
}

function formatNumber(value) {
  const numericValue = Number(value) || 0;
  return numericValue.toFixed(2);
}
