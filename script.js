const state = {
  users: {
    admin: {
      username: 'admin',
      password: 'admin123',
      role: 'admin',
      displayName: 'Administrador',
      wallet: {
        balance: 0,
        incomes: [],
        expenses: []
      }
    },
    carlota: {
      username: 'carlota',
      password: 'carlota123',
      role: 'basic',
      displayName: 'Carlota',
      wallet: {
        balance: 0,
        incomes: [],
        expenses: []
      }
    }
  },
  categories: ['Exámenes', 'Tareas del hogar', 'Gastos fijos', 'Gastos extras'],
  tasks: [],
  nextTaskId: 1,
  loggedUser: null
};

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

function init() {
  setupLogin();
  setupTabs();
  setupForms();
  renderCategoryOptions();
  renderAdminTaskList();
  renderCategoryList();
  renderWalletOverview();
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
  taskForm.addEventListener('submit', event => {
    event.preventDefault();
    const title = document.getElementById('task-title').value.trim();
    const description = document.getElementById('task-description').value.trim();
    const category = taskCategorySelect.value;
    const username = taskUserSelect.value;

    if (!title || !description || !category || !username) {
      return;
    }

    const task = {
      id: state.nextTaskId++,
      title,
      description,
      category,
      assignedTo: username,
      completed: false,
      type: category === 'Exámenes' ? 'exam' : 'general',
      score: null,
      rewardGranted: false
    };

    state.tasks.push(task);
    taskForm.reset();
    renderAdminTaskList();
    renderBasicTasksForUser(username);
  });

  categoryForm.addEventListener('submit', event => {
    event.preventDefault();
    const newCategory = newCategoryInput.value.trim();
    if (!newCategory) return;
    if (state.categories.includes(newCategory)) {
      newCategoryInput.value = '';
      return;
    }
    state.categories.push(newCategory);
    newCategoryInput.value = '';
    renderCategoryOptions();
    renderCategoryList();
    const user = state.loggedUser;
    if (user && user.role === 'basic') {
      renderKidCategories(user);
    }
  });

  incomeForm.addEventListener('submit', event => {
    event.preventDefault();
    const username = incomeUserSelect.value;
    const amount = Number(incomeAmountInput.value);
    const description = incomeDescriptionInput.value.trim();
    if (!username || isNaN(amount) || amount <= 0 || !description) return;
    registerWalletMovement(username, amount, description, 'income');
    incomeForm.reset();
    renderWalletOverview();
    renderBasicTasksForUser(username);
  });

  fixedExpenseForm.addEventListener('submit', event => {
    event.preventDefault();
    const username = fixedUserSelect.value;
    const amount = Number(fixedAmountInput.value);
    const description = fixedDescriptionInput.value.trim();
    if (!username || isNaN(amount) || amount <= 0 || !description) return;
    registerWalletMovement(username, amount, description, 'fixed-expense');
    fixedExpenseForm.reset();
    renderWalletOverview();
    renderBasicTasksForUser(username);
  });

  extraExpenseForm.addEventListener('submit', event => {
    event.preventDefault();
    const username = extraUserSelect.value;
    const amount = Number(extraAmountInput.value);
    const description = extraDescriptionInput.value.trim();
    if (!username || isNaN(amount) || amount <= 0 || !description) return;
    registerWalletMovement(username, amount, description, 'extra-expense');
    extraExpenseForm.reset();
    renderWalletOverview();
    renderBasicTasksForUser(username);
  });
}

function registerWalletMovement(username, amount, description, type) {
  const user = state.users[username];
  if (!user) return;
  const entry = {
    amount,
    description,
    date: new Date().toLocaleDateString()
  };

  if (type === 'income') {
    user.wallet.balance += amount;
    user.wallet.incomes.push(entry);
  } else {
    user.wallet.balance -= amount;
    user.wallet.expenses.push(entry);
  }

  if (state.loggedUser && state.loggedUser.role === 'basic' && state.loggedUser.username === username) {
    renderKidWallet(user);
  }
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
    node.querySelector('.task-meta').textContent = `${task.category} · Asignada a ${state.users[task.assignedTo].displayName}`;

    const status = document.createElement('span');
    status.classList.add('status-badge', task.completed ? 'status-done' : 'status-open');
    status.textContent = task.completed ? 'Terminada' : 'Pendiente';
    node.querySelector('.task-actions').appendChild(status);

    adminTaskList.appendChild(node);
  });
}

function renderCategoryList() {
  categoryList.innerHTML = '';
  state.categories.forEach(category => {
    const li = document.createElement('li');
    li.textContent = category;
    categoryList.appendChild(li);
  });
}

function renderWalletOverview() {
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
      <p class="wallet-amount">${formatCurrency(user.wallet.balance)}</p>
      <div class="wallet-history">
        <div>
          <h4>Ingresos</h4>
          <ul>${user.wallet.incomes.map(item => `<li>${item.date}: +${formatCurrency(item.amount)} · ${item.description}</li>`).join('') || '<li>Aún no hay ingresos</li>'}</ul>
        </div>
        <div>
          <h4>Gastos</h4>
          <ul>${user.wallet.expenses.map(item => `<li>${item.date}: -${formatCurrency(item.amount)} · ${item.description}</li>`).join('') || '<li>Aún no hay gastos</li>'}</ul>
        </div>
      </div>
    `;
    walletOverview.appendChild(card);
  });
}

function showBasicPanel(user) {
  loginSection.classList.add('hidden');
  basicSection.classList.remove('hidden');
  renderKidDashboard(user);
}

function renderKidDashboard(user) {
  kidName.textContent = `Hola, ${user.displayName} 👋`;
  renderKidWallet(user);
  renderKidCategories(user);
  if (state.categories.length > 0) {
    renderKidTasks(user, state.categories[0]);
  } else {
    kidTaskPanel.innerHTML = '<p>Aún no hay apartados disponibles.</p>';
  }
}

function renderKidWallet(user) {
  kidBalance.textContent = formatNumber(user.wallet.balance);
  kidIncomeHistory.innerHTML = '';
  kidExpenseHistory.innerHTML = '';

  if (user.wallet.incomes.length === 0) {
    const li = document.createElement('li');
    li.textContent = 'Sin ingresos todavía';
    kidIncomeHistory.appendChild(li);
  } else {
    user.wallet.incomes.slice().reverse().forEach(entry => {
      const li = document.createElement('li');
      li.textContent = `${entry.date}: +${formatCurrency(entry.amount)} · ${entry.description}`;
      kidIncomeHistory.appendChild(li);
    });
  }

  if (user.wallet.expenses.length === 0) {
    const li = document.createElement('li');
    li.textContent = 'Sin gastos todavía';
    kidExpenseHistory.appendChild(li);
  } else {
    user.wallet.expenses.slice().reverse().forEach(entry => {
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

  state.categories.forEach((category, index) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.classList.add('kid-tab');
    if (index === 0) button.classList.add('active');
    button.textContent = category;
    button.addEventListener('click', () => {
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
    checkbox.checked = task.completed;
    checkbox.addEventListener('change', () => {
      task.completed = checkbox.checked;
      renderAdminTaskList();
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
        rewardInfo.textContent = ` Recompensa: ${formatCurrency(task.rewardAmount)}`;
      }

      saveButton.addEventListener('click', () => {
        const score = parseFloat(scoreInput.value);
        if (isNaN(score) || score < 0 || score > 10) {
          alert('Introduce una nota entre 0 y 10.');
          return;
        }
        const reward = calculateExamReward(score);
        task.score = score;
        task.rewardGranted = true;
        task.rewardAmount = reward;
        saveButton.textContent = 'Recompensa guardada';
        saveButton.disabled = true;
        rewardInfo.textContent = ` Recompensa: ${formatCurrency(reward)}`;
        applyExamReward(user, task, reward);
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

function applyExamReward(user, task, reward) {
  const description = `Recompensa examen "${task.title}"`;
  const entry = {
    amount: Math.abs(reward),
    description,
    date: new Date().toLocaleDateString()
  };

  if (reward > 0) {
    user.wallet.balance += reward;
    user.wallet.incomes.push(entry);
  } else if (reward < 0) {
    user.wallet.balance += reward; // reward is negative
    user.wallet.expenses.push(entry);
  } else {
    user.wallet.incomes.push({ ...entry, amount: 0 });
  }

  renderKidWallet(user);
  renderWalletOverview();
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

function renderBasicTasksForUser(username) {
  const user = state.users[username];
  if (!user || user.role !== 'basic') return;
  if (state.loggedUser && state.loggedUser.username === username) {
    renderKidDashboard(user);
  }
}

function formatCurrency(value) {
  return `${value.toFixed(2)} €`;
}

function formatNumber(value) {
  return value.toFixed(2);
}

init();
