const fs = require('fs');
const vm = require('vm');

function createClassList() {
  return {
    add() {},
    remove() {},
    toggle() {},
    contains() {
      return false;
    }
  };
}

function createElementStub(initial = {}) {
  const element = {
    ...initial,
    classList: createClassList(),
    style: {},
    dataset: initial.dataset || {},
    children: initial.children || [],
    _listeners: {},
    appendChild(child) {
      this.children.push(child);
      return child;
    },
    append(...nodes) {
      nodes.forEach(node => {
        if (typeof node === 'string') {
          this.children.push(node);
        } else {
          this.appendChild(node);
        }
      });
    },
    addEventListener(type, handler) {
      if (!this._listeners[type]) {
        this._listeners[type] = [];
      }
      this._listeners[type].push(handler);
    },
    dispatchEvent(event) {
      const handlers = this._listeners[event.type] || [];
      handlers.forEach(handler => handler(event));
    },
    querySelector() {
      return createElementStub();
    },
    querySelectorAll() {
      return [];
    },
    set innerHTML(value) {
      this._innerHTML = value;
      this.children = [];
    },
    get innerHTML() {
      return this._innerHTML || '';
    },
    set textContent(value) {
      this._textContent = value;
    },
    get textContent() {
      return this._textContent || '';
    },
    set value(val) {
      this._value = val;
    },
    get value() {
      return this._value || '';
    },
    reset() {},
    cloneNode() {
      return createElementStub();
    }
  };
  return element;
}

function createDocumentStub() {
  const elements = new Map();

  function ensureElement(id, factory) {
    if (!elements.has(id)) {
      elements.set(id, factory ? factory() : createElementStub({ id }));
    }
    return elements.get(id);
  }

  const doc = {
    createElement(tag) {
      const el = createElementStub({ tag });
      if (tag === 'template') {
        el.content = {
          cloneNode() {
            const fragment = createElementStub();
            fragment.querySelector = () => createElementStub();
            return fragment;
          }
        };
      }
      return el;
    },
    getElementById(id) {
      switch (id) {
        case 'login-form':
          return ensureElement(id, () => {
            const form = createElementStub({ id });
            form.reset = function () {
              ensureElement('username').value = '';
              ensureElement('password').value = '';
              form._wasReset = true;
            };
            return form;
          });
        case 'username':
        case 'password':
        case 'login-error':
        case 'login-section':
        case 'admin-section':
        case 'basic-section':
        case 'task-form':
        case 'task-category':
        case 'task-user':
        case 'admin-task-list':
        case 'category-list':
        case 'category-form':
        case 'new-category':
        case 'income-form':
        case 'income-user':
        case 'income-amount':
        case 'income-description':
        case 'fixed-expense-form':
        case 'fixed-user':
        case 'fixed-amount':
        case 'fixed-description':
        case 'extra-expense-form':
        case 'extra-user':
        case 'extra-amount':
        case 'extra-description':
        case 'wallet-overview':
        case 'kid-name':
        case 'kid-balance':
        case 'kid-income-history':
        case 'kid-expense-history':
        case 'kid-category-tabs':
        case 'kid-task-panel':
        case 'logout-admin':
        case 'logout-basic':
          return ensureElement(id);
        case 'task-template':
          return ensureElement(id, () => {
            const template = createElementStub({ id });
            template.content = {
              cloneNode() {
                const fragment = createElementStub();
                fragment.querySelector = () => createElementStub();
                return fragment;
              }
            };
            return template;
          });
        default:
          return ensureElement(id);
      }
    },
    querySelectorAll(selector) {
      if (selector === '.tab-button') {
        return ['tasks-tab', 'categories-tab', 'wallet-tab', 'overview-tab'].map(tab =>
          createElementStub({ dataset: { tab } })
        );
      }
      if (selector === '.tab-panel') {
        return ['tasks-tab', 'categories-tab', 'wallet-tab', 'overview-tab'].map(id =>
          createElementStub({ id })
        );
      }
      return [];
    }
  };

  return doc;
}

const context = {
  console,
  document: createDocumentStub(),
  window: {},
  alert: () => {},
  setTimeout,
  clearTimeout
};
context.window.document = context.document;
context.window.alert = context.alert;
context.window.console = console;

const scriptSource = fs.readFileSync('script.js', 'utf8');
const wrappedSource = `${scriptSource}\nthis.__exportedState = state;\nthis.__exportedHandleLogout = handleLogout;`;

vm.createContext(context);
vm.runInContext(wrappedSource, context);

const state = context.__exportedState;
const handleLogout = context.__exportedHandleLogout;

function simulateLogin(username, password) {
  const form = context.document.getElementById('login-form');
  const usernameInput = context.document.getElementById('username');
  const passwordInput = context.document.getElementById('password');
  usernameInput.value = username;
  passwordInput.value = password;
  const listeners = form._listeners.submit || [];
  listeners.forEach(listener => listener({ preventDefault() {} }));
  return state.loggedUser ? state.loggedUser.username : null;
}

const adminLogin = simulateLogin('admin', 'admin123');
handleLogout();
const basicLogin = simulateLogin('carlota', 'carlota123');

if (adminLogin !== 'admin' || basicLogin !== 'carlota') {
  console.error('Credential verification failed', { adminLogin, basicLogin });
  process.exit(1);
}

console.log('Admin login user:', adminLogin);
console.log('Basic login user:', basicLogin);
