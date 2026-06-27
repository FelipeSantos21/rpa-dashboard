// Intercept all outgoing fetch API calls to inject the Authorization Bearer token (User UUID)
(function() {
  const originalFetch = window.fetch;
  window.fetch = function(url, options) {
    options = options || {};
    options.headers = options.headers || {};
    
    // Ensure headers support string assignment
    if (!(options.headers instanceof Headers)) {
      if (Array.isArray(options.headers)) {
        const headersObj = {};
        options.headers.forEach(h => { headersObj[h[0]] = h[1]; });
        options.headers = headersObj;
      }
    }
    
    try {
      const sessionStr = sessionStorage.getItem("op_session");
      if (sessionStr) {
        const sess = JSON.parse(sessionStr);
        if (sess && sess.id) {
          if (options.headers instanceof Headers) {
            options.headers.set("Authorization", "Bearer " + sess.id);
          } else {
            options.headers["Authorization"] = "Bearer " + sess.id;
          }
        }
      }
    } catch (e) {
      console.error("Error setting Auth header on fetch:", e);
    }
    
    return originalFetch(url, options);
  };
})();

let session = null;
let currentAlertEmails = [];
let currentAlertRpaId = null;

// Determine if we should run in static/offline mock mode
function isMockMode() {
  if (window.useMockMode === true) return true;
  if (window.isThymeleafProcessed === true) return false;
  if (window.location.protocol === 'file:') return true;
  return false;
}

// ── LOCAL STORAGE MOCK DATA KEYS ──
const MOCK_CLIENTS_KEY = "op_mock_clients";
const MOCK_RPAS_KEY = "op_mock_rpas";
const MOCK_SUBTASKS_KEY = "op_mock_subtasks";
const MOCK_USERS_KEY = "op_mock_users";

function getMockClients() {
  return JSON.parse(localStorage.getItem(MOCK_CLIENTS_KEY)) || [];
}
function saveMockClients(clients) {
  localStorage.setItem(MOCK_CLIENTS_KEY, JSON.stringify(clients));
}
function getMockRpas() {
  return JSON.parse(localStorage.getItem(MOCK_RPAS_KEY)) || [];
}
function saveMockRpas(rpas) {
  localStorage.setItem(MOCK_RPAS_KEY, JSON.stringify(rpas));
}
function getMockSubtasks() {
  return JSON.parse(localStorage.getItem(MOCK_SUBTASKS_KEY)) || [];
}
function saveMockSubtasks(subtasks) {
  localStorage.setItem(MOCK_SUBTASKS_KEY, JSON.stringify(subtasks));
}
function getMockUsers() {
  return JSON.parse(localStorage.getItem(MOCK_USERS_KEY)) || [];
}
function saveMockUsers(users) {
  localStorage.setItem(MOCK_USERS_KEY, JSON.stringify(users));
}

// ── INITIALIZE MOCK DATA FOR OFFLINE PREVIEW ──
function initMockData() {
  if (!localStorage.getItem(MOCK_CLIENTS_KEY)) {
    const clients = [
      { id: "33333333-3333-3333-3333-333333333333", nome: "ABC Indústria Ltda", razaoSocial: "ABC Indústria Metalúrgica Ltda", cnpj: "12.345.678/0001-01", responsavel: "Carlos Silva" },
      { id: "44444444-4444-4444-4444-444444444444", nome: "TechSolutions S.A.", razaoSocial: "TechSolutions Consultoria e Tecnologia S.A.", cnpj: "98.765.432/0001-99", responsavel: "Mariana Costa" },
      { id: "55555555-5555-5555-5555-555555555555", nome: "Global Logistics Corp", razaoSocial: "Global Logistics Transportes Ltda", cnpj: "45.678.901/0001-22", responsavel: "Ricardo Souza" },
      { id: "66666666-6666-6666-6666-666666666666", nome: "Financeira Alfa", razaoSocial: "Alfa Crédito e Financiamento S.A.", cnpj: "23.456.789/0001-33", responsavel: "Patricia Santos" }
    ];
    saveMockClients(clients);
  }

  if (!localStorage.getItem(MOCK_RPAS_KEY)) {
    const rpas = [
      { id: "r1111111-1111-1111-1111-111111111111", cliente: { id: "33333333-3333-3333-3333-333333333333", nome: "ABC Indústria Ltda" }, nome: "Leitura Planilha NFe", identificadorRpa: "rpa_sja_001", departamento: "Financeiro", status: "Ativo", descricao: "Lê planilhas de entrada e lança NFes no portal SEFAZ.", regras: "1. Baixar planilha do email\n2. Validar CNPJ\n3. Lançar no site SEFAZ\n4. Confirmar recibo", riscos: "Site do SEFAZ instável, formato de planilha incorreto.", emailsAlerta: ["fiscal@abc.com", "suporte@oneprocess.com"] },
      { id: "r2222222-2222-2222-2222-222222222222", cliente: { id: "33333333-3333-3333-3333-333333333333", nome: "ABC Indústria Ltda" }, nome: "Faturamento Automático", identificadorRpa: "rpa_sja_002", departamento: "Faturamento", status: "Em Manutenção", descricao: "Gera notas fiscais de saída automaticamente com base no ERP.", regras: "1. Consultar pedidos prontos\n2. Emitir NF-e\n3. Enviar XML para o cliente", riscos: "Indisponibilidade do ERP, rejeição de alíquota tributária.", emailsAlerta: ["faturamento@abc.com"] },
      { id: "r3333333-3333-3333-3333-333333333333", cliente: { id: "44444444-4444-4444-4444-444444444444", nome: "TechSolutions S.A." }, nome: "Conciliação Bancária", identificadorRpa: "rpa_sja_003", departamento: "Financeiro", status: "Ativo", descricao: "Verifica extratos bancários e faz o match no sistema de contas a pagar.", regras: "1. Baixar OFX do banco\n2. Comparar com contas pagas\n3. Baixar no ERP", riscos: "Extrato bancário incompleto, divergência de centavos.", emailsAlerta: ["financeiro@techsolutions.com"] },
      { id: "r4444444-4444-4444-4444-444444444444", cliente: { id: "55555555-5555-5555-5555-555555555555", nome: "Global Logistics Corp" }, nome: "Monitoramento de Cargas", identificadorRpa: "rpa_sja_004", departamento: "Operações", status: "Ativo", descricao: "Rastreia entregas nos portais das transportadoras parceiras.", regras: "1. Consultar chave de rastreio\n2. Capturar status atual\n3. Atualizar TMS", riscos: "Portal de transportadora com CAPTCHA.", emailsAlerta: ["logistica@globallog.com"] }
    ];
    saveMockRpas(rpas);
  }

  if (!localStorage.getItem(MOCK_SUBTASKS_KEY)) {
    const subtasks = [
      { dataExecucao: new Date(Date.now() - 5 * 60000).toISOString(), numeroDocumento: "NF-001024", mensagemOnde: "Autorizada pelo portal SEFAZ", status: "Sucesso", rpaNome: "Leitura Planilha NFe", valor: 12500.00, fornecedor: "Metalúrgica Central", rpaId: "r1111111-1111-1111-1111-111111111111", clientId: "33333333-3333-3333-3333-333333333333" },
      { dataExecucao: new Date(Date.now() - 15 * 60000).toISOString(), numeroDocumento: "NF-001023", mensagemOnde: "Erro na validação do CNPJ do fornecedor", status: "Não Encontrado", rpaNome: "Leitura Planilha NFe", valor: 340.50, fornecedor: "Papelaria Express", rpaId: "r1111111-1111-1111-1111-111111111111", clientId: "33333333-3333-3333-3333-333333333333" },
      { dataExecucao: new Date(Date.now() - 30 * 60000).toISOString(), numeroDocumento: "BOL-99052", mensagemOnde: "Baixa concluída no ERP corporativo", status: "Sucesso", rpaNome: "Conciliação Bancária", valor: 4500.00, fornecedor: "Banco Itaú S.A.", rpaId: "r3333333-3333-3333-3333-333333333333", clientId: "44444444-4444-4444-4444-444444444444" },
      { dataExecucao: new Date(Date.now() - 45 * 60000).toISOString(), numeroDocumento: "TRK-77401", mensagemOnde: "Status atualizado: Em trânsito para filial", status: "Sucesso", rpaNome: "Monitoramento de Cargas", valor: 0.00, fornecedor: "Transp. Rápido S.A.", rpaId: "r4444444-4444-4444-4444-444444444444", clientId: "55555555-5555-5555-5555-555555555555" },
      { dataExecucao: new Date(Date.now() - 60 * 60000).toISOString(), numeroDocumento: "NF-001022", mensagemOnde: "Falha de conexão com a API do SEFAZ", status: "Erro", rpaNome: "Leitura Planilha NFe", valor: 7890.90, fornecedor: "Vidros Paraná Ltda", rpaId: "r1111111-1111-1111-1111-111111111111", clientId: "33333333-3333-3333-3333-333333333333" }
    ];
    saveMockSubtasks(subtasks);
  }

  if (!localStorage.getItem(MOCK_USERS_KEY)) {
    const users = [
      { id: "71872f92-bf1c-4e31-9716-e58a3426dc7c", nome: "OneProcess", sobrenome: "Admin", departamento: "TI", username: "oneprocess", role: "admin", clientes: [] },
      { id: "user-abc-id", nome: "João", sobrenome: "Ferreira", departamento: "Financeiro", username: "cliente_abc", role: "client", clientes: [{ id: "33333333-3333-3333-3333-333333333333", nome: "ABC Indústria Ltda" }] },
      { id: "user-xyz-id", nome: "Maria", sobrenome: "Fernanda", departamento: "Fiscal", username: "cliente_xyz", role: "client", clientes: [{ id: "44444444-4444-4444-4444-444444444444", nome: "TechSolutions S.A." }] }
    ];
    saveMockUsers(users);
  }
}

// ── LIFECYCLE INITIALIZER ──
window.addEventListener('load', function() {
  initMockData();
  const cached = sessionStorage.getItem("op_session");
  if (cached) {
    session = JSON.parse(cached);
    bootstrapApp();
  }
  
  // Set up listeners for enter key on login fields
  const inpUser = document.getElementById('inp-user');
  const inpPass = document.getElementById('inp-pass');
  if (inpUser) inpUser.addEventListener('keydown', e => { if(e.key === 'Enter') doLogin(); });
  if (inpPass) inpPass.addEventListener('keydown', e => { if(e.key === 'Enter') doLogin(); });
});

/* ═════════════════════════════════════════════════════════════
   2. AUTHENTICATION CONTROLS
   ═════════════════════════════════════════════════════════════ */
function doLogin() {
  const user = document.getElementById('inp-user').value.trim();
  const pass = document.getElementById('inp-pass').value.trim();
  const err = document.getElementById('login-error');

  if (!user || !pass) {
    err.style.display = 'block';
    err.querySelector('#login-error-msg').textContent = "Preencha usuário e senha.";
    return;
  }

  if (isMockMode()) {
    handleMockLogin(user, pass, err);
    return;
  }

  fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: user, password: pass })
  })
  .then(res => {
    if (!res.ok) {
      throw new Error("Credenciais inválidas");
    }
    return res.json();
  })
  .then(data => {
    session = data;
    session.originalRole = data.role;
    sessionStorage.setItem("op_session", JSON.stringify(session));
    err.style.display = 'none';
    bootstrapApp();
  })
  .catch(e => {
    if (e.message === "Failed to fetch" || e.name === "TypeError") {
      console.warn("Server connection failed. Switching to offline mockup mode...");
      window.useMockMode = true;
      doLogin();
    } else {
      err.style.display = 'block';
      err.querySelector('#login-error-msg').textContent = "Usuário ou senha incorretos. Tente novamente.";
    }
  });
}

function handleMockLogin(user, pass, errElement) {
  const normalizedUser = user.toLowerCase();
  if (normalizedUser === 'oneprocess' && pass === 'op2025') {
    session = {
      id: "11111111-1111-1111-1111-111111111111",
      nome: "Admin",
      sobrenome: "OneProcess",
      username: "oneprocess",
      role: "admin",
      clientId: null,
      companyName: null,
      originalRole: "admin"
    };
    sessionStorage.setItem("op_session", JSON.stringify(session));
    errElement.style.display = 'none';
    bootstrapApp();
  } else if (normalizedUser === 'cliente_abc' && pass === 'abc123') {
    session = {
      id: "22222222-2222-2222-2222-222222222222",
      nome: "ABC",
      sobrenome: "Indústria",
      username: "cliente_abc",
      role: "client",
      clientId: "33333333-3333-3333-3333-333333333333",
      companyName: "ABC Indústria Ltda",
      originalRole: "client"
    };
    sessionStorage.setItem("op_session", JSON.stringify(session));
    errElement.style.display = 'none';
    bootstrapApp();
  } else {
    // Check custom mock clients
    const clients = getMockClients();
    const matched = clients.find(c => {
      const u = 'cliente_' + c.nome.toLowerCase().replaceAll(/[^a-z0-9]/g, "");
      return u === normalizedUser;
    });
    if (matched && pass === '123456') {
      session = {
        id: "mock-user-" + matched.id,
        nome: matched.responsavel,
        sobrenome: "Contato",
        username: 'cliente_' + matched.nome.toLowerCase().replaceAll(/[^a-z0-9]/g, ""),
        role: "client",
        clientId: matched.id,
        companyName: matched.nome,
        originalRole: "client"
      };
      sessionStorage.setItem("op_session", JSON.stringify(session));
      errElement.style.display = 'none';
      bootstrapApp();
    } else {
      errElement.style.display = 'block';
      errElement.querySelector('#login-error-msg').textContent = "Usuário ou senha incorretos. Tente novamente.";
    }
  }
}

function doLogout() {
  session = null;
  sessionStorage.removeItem("op_session");
  document.getElementById('app').style.display = 'none';
  document.getElementById('login-wrap').style.display = 'flex';
  document.getElementById('inp-user').value = '';
  document.getElementById('inp-pass').value = '';
}

/* ═════════════════════════════════════════════════════════════
   3. APP SHELL BOOTSTRAPPER & ROUTER
   ═════════════════════════════════════════════════════════════ */
function bootstrapApp() {
  document.getElementById('login-wrap').style.display = 'none';
  const app = document.getElementById('app');
  app.style.display = 'block';

  // Profile configuration
  const av = document.getElementById('profile-avatar');
  av.textContent = session.nome.substring(0,2).toUpperCase();
  av.className = 'avatar ' + (session.role === 'admin' ? 'av-admin' : 'av-client');
  document.getElementById('profile-name').textContent = session.nome + ' ' + (session.sobrenome || '');
  
  const roleLabel = document.getElementById('profile-role-label');
  roleLabel.textContent = session.role === 'admin' ? 'Administrador' : 'Cliente';
  roleLabel.className = 'profile-role ' + (session.role === 'admin' ? 'role-admin' : 'role-client');

  // Navigation display
  document.getElementById('nav-admin').style.display = session.role === 'admin' ? 'block' : 'none';
  document.getElementById('nav-client').style.display = session.role === 'client' ? 'block' : 'none';

  // Simulated view control badge
  const simContainer = document.getElementById('simulated-badge-container');
  if (session.originalRole === 'admin' && session.role === 'client') {
    simContainer.style.display = 'block';
  } else {
    simContainer.style.display = 'none';
  }

  // Simulation selector setup
  const simSelectorWrap = document.getElementById('sim-selector-wrap');
  if (simSelectorWrap) {
    if (session.originalRole === 'admin') {
      simSelectorWrap.style.display = 'flex';
      populateSimulationSelector();
    } else {
      simSelectorWrap.style.display = 'none';
    }
  }

  // Topbar and navigation boot
  const tb = document.getElementById('topbar-badge');
  const btnNovo = document.getElementById('btn-novo-top');
  if (session.role === 'admin') {
    tb.className = 'topbar-badge tb-admin';
    tb.innerHTML = '<i class="ti ti-shield-check"></i> Admin OneProcess';
    btnNovo.style.display = 'inline-flex';
  } else {
    tb.className = 'topbar-badge tb-client';
    tb.innerHTML = '<i class="ti ti-building"></i> ' + session.companyName;
    btnNovo.style.display = 'none';
    document.getElementById('client-company-sub').textContent = session.companyName + ' — automações multi-tenant';
  }

  // Handle routing on boot
  if (window.location.hash && window.location.hash.startsWith('#/')) {
    handleRouting();
  } else {
    const defaultScreen = session.role === 'admin' ? 'dash-admin' : 'meus-rpas';
    window.location.hash = '#/' + defaultScreen;
  }

  // Initialize WebSocket for real-time updates
  if (!window.isWebSocketInitialized) {
    window.isWebSocketInitialized = true;
    initWebSocket();
  }
}

function initWebSocket() {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const wsUrl = `${protocol}//${window.location.host}/ws/execucoes`;
  const socket = new WebSocket(wsUrl);

  socket.onmessage = function(event) {
    console.log("WebSocket message received:", event.data);
    if (event.data === "update") {
      const activeScreen = document.querySelector('.screen.active');
      if (activeScreen) {
        const screenId = activeScreen.id.replace('screen-', '');
        if (screenId === 'resultados') {
          loadExecutions();
        } else if (screenId === 'dash-admin') {
          loadAdminDashboard();
        } else if (screenId === 'meus-rpas') {
          loadClientDashboard();
        }
      }
    }
  };

  socket.onclose = function() {
    console.warn("WebSocket closed. Reconnecting in 5 seconds...");
    setTimeout(initWebSocket, 5000);
  };
  
  socket.onerror = function(err) {
    console.error("WebSocket error:", err);
    socket.close();
  };
}

// Router config
const SCREEN_TITLES = {
  'dash-admin': ['Dashboard','Visão geral consolidada dos clientes'],
  'clientes':   ['Clientes','Empresas cadastradas no ecossistema'],
  'rpas-admin': ['Catálogo RPAs','Parques de robôs cadastrados por cliente'],
  'credenciais':['Credenciais','Dados de integração dos robôs'],
  'meus-rpas':  ['Meus RPAs','Desempenho dos robôs ativos'],
  'alertas':    ['Configurar Alertas','Contatos de notificação de erros'],
  'resultados': ['Resultados','Execuções e histórico em tempo real'],
};

function populateSimulationSelector() {
  const select = document.getElementById('sim-client-select');
  if (!select) return;
  
  const handleData = (clients) => {
    select.innerHTML = '<option value="">-- Administrador (Visão Geral) --</option>';
    clients.forEach(c => {
      const opt = document.createElement('option');
      opt.value = c.id;
      opt.textContent = c.nome;
      select.appendChild(opt);
    });
    
    if (session.originalRole === 'admin' && session.role === 'client') {
      select.value = session.clientId;
    } else {
      select.value = "";
    }
  };

  if (isMockMode()) {
    handleData(getMockClients());
  } else {
    fetch('/api/clientes')
      .antigravityJson()
      .then(data => {
        handleData(data);
      })
      .catch(err => {
        console.warn("Failed to fetch clients for simulation selector", err);
        handleData([]);
      });
  }
}

function startSimulation(clientId) {
  if (!session || session.originalRole !== 'admin') return;
  
  if (!clientId) {
    exitSimulation();
    return;
  }
  
  const handleStart = (name) => {
    session.role = 'client';
    session.clientId = clientId;
    session.companyName = name;
    sessionStorage.setItem("op_session", JSON.stringify(session));
    bootstrapApp();
  };

  if (isMockMode()) {
    const clients = getMockClients();
    const found = clients.find(c => c.id === clientId);
    handleStart(found ? found.nome : "Cliente Simulado");
  } else {
    fetch('/api/clientes')
      .antigravityJson()
      .then(clients => {
        const found = clients.find(c => c.id === clientId);
        handleStart(found ? found.nome : "Cliente Simulado");
      })
      .catch(err => {
        console.error("Failed to fetch clients for simulation", err);
      });
  }
}

function exitSimulation() {
  if (session && session.originalRole === 'admin') {
    session.role = 'admin';
    session.clientId = null;
    session.companyName = null;
    sessionStorage.setItem("op_session", JSON.stringify(session));
    bootstrapApp();
  }
}

function openRpaReport(rpaId) {
  go('resultados', { rpaId: rpaId });
}

function showSubtaskDetails(taskIndex, subtaskIndex) {
  const task = window.currentExecutions[taskIndex];
  if (!task) return;
  const sub = task.subtasks[subtaskIndex];
  if (!sub) return;

  const modal = document.getElementById('modal-resultado-detalhe');
  if (!modal) return;
  modal.classList.add('open');

  const subStandardKeys = ['id', 'id_task', 'nome', 'status', 'msgErro', 'dataEmissao', 'criadoEm'];
  const taskStandardKeys = ['id', 'id_cadastro_rpa', 'nome', 'caminhoJsonDisco', 'timestampInicio', 'timestampFim', 'status', 'msgErro', 'totalLinhas', 'linhasSucesso', 'linhasErro', 'linhasNaoEncontrado', 'criadoEm'];

  let subHtml = `
    <div class="detail-section-title">Subtask (Item/Linha)</div>
    <div class="detail-grid">
      <div class="detail-item"><span class="detail-lbl">ID Subtask</span><span class="detail-val">${sub.id || '—'}</span></div>
      <div class="detail-item"><span class="detail-lbl">Nome</span><span class="detail-val">${sub.nome || '—'}</span></div>
      <div class="detail-item"><span class="detail-lbl">Status</span><span class="detail-val"><span class="badge ${sub.status === 'Sucesso' ? 'badge-success' : (sub.status === 'Não Encontrado' ? 'badge-warn' : 'badge-danger')}">${sub.status}</span></span></div>
      <div class="detail-item"><span class="detail-lbl">Data Emissão</span><span class="detail-val">${sub.dataEmissao || '—'}</span></div>
      <div class="detail-item"><span class="detail-lbl">Data Criação</span><span class="detail-val">${sub.criadoEm ? new Date(sub.criadoEm).toLocaleString('pt-BR') : '—'}</span></div>
    </div>
    <div class="detail-item-full"><span class="detail-lbl">Mensagem Erro (Se houver)</span><div class="detail-val-textarea">${sub.msgErro || '—'}</div></div>
  `;

  let taskHtml = `
    <div class="detail-section-title">Task Relacionada (Lote/Arquivo)</div>
    <div class="detail-grid">
      <div class="detail-item"><span class="detail-lbl">ID Task</span><span class="detail-val">${task.id || '—'}</span></div>
      <div class="detail-item"><span class="detail-lbl">Nome do Arquivo</span><span class="detail-val">${task.nome || '—'}</span></div>
      <div class="detail-item"><span class="detail-lbl">Status Lote</span><span class="detail-val"><span class="badge ${task.status === 'Sucesso' ? 'badge-success' : (task.status === 'Não Encontrado' ? 'badge-warn' : 'badge-danger')}">${task.status}</span></span></div>
      <div class="detail-item"><span class="detail-lbl">Caminho Disco</span><span class="detail-val"><code>${task.caminhoJsonDisco || '—'}</code></span></div>
      <div class="detail-item"><span class="detail-lbl">Início</span><span class="detail-val">${task.timestampInicio ? new Date(task.timestampInicio).toLocaleString('pt-BR') : '—'}</span></div>
      <div class="detail-item"><span class="detail-lbl">Fim</span><span class="detail-val">${task.timestampFim ? new Date(task.timestampFim).toLocaleString('pt-BR') : '—'}</span></div>
      <div class="detail-item"><span class="detail-lbl">Total Linhas</span><span class="detail-val">${task.totalLinhas || 0}</span></div>
      <div class="detail-item"><span class="detail-lbl">Sucessos</span><span class="detail-val">${task.linhasSucesso || 0}</span></div>
      <div class="detail-item"><span class="detail-lbl">Não Encontrados</span><span class="detail-val">${task.linhasNaoEncontrado || 0}</span></div>
      <div class="detail-item"><span class="detail-lbl">Erros</span><span class="detail-val">${task.linhasErro || 0}</span></div>
      <div class="detail-item"><span class="detail-lbl">Data de Criação</span><span class="detail-val">${task.criadoEm ? new Date(task.criadoEm).toLocaleString('pt-BR') : '—'}</span></div>
    </div>
    <div class="detail-item-full"><span class="detail-lbl">Mensagem de Erro Geral</span><div class="detail-val-textarea">${task.msgErro || '—'}</div></div>
  `;

  let customHtml = '';
  const customItems = [];

  Object.keys(sub).forEach(key => {
    if (!subStandardKeys.includes(key) && key !== 'task') {
      const label = key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
      customItems.push({ label, val: sub[key] });
    }
  });

  Object.keys(task).forEach(key => {
    if (!taskStandardKeys.includes(key) && key !== 'cadastroRpa' && key !== 'subtasks') {
      const label = key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase()) + ' (Task)';
      customItems.push({ label, val: task[key] });
    }
  });

  if (customItems.length > 0) {
    customHtml += `<div class="detail-section-title">Dados Específicos do RPA</div><div class="detail-grid">`;
    customItems.forEach(item => {
      customHtml += `<div class="detail-item"><span class="detail-lbl">${item.label}</span><span class="detail-val">${item.val !== null ? item.val : '—'}</span></div>`;
    });
    customHtml += `</div>`;
  }

  document.getElementById('detail-subtask-content').innerHTML = subHtml;
  document.getElementById('detail-task-content').innerHTML = taskHtml;
  document.getElementById('detail-custom-content').innerHTML = customHtml;
}

function toggleSidebar(isOpen) {
  const sidebar = document.querySelector('.sidebar');
  const backdrop = document.getElementById('sidebar-backdrop');
  if (isOpen) {
    sidebar.classList.add('open');
    backdrop.classList.add('open');
  } else {
    sidebar.classList.remove('open');
    backdrop.classList.remove('open');
  }
}

function go(id, params) {
  let hash = '#/' + id;
  if (params) {
    const query = Object.keys(params).map(k => `${encodeURIComponent(k)}=${encodeURIComponent(params[k])}`).join('&');
    if (query) hash += '?' + query;
  }
  window.location.hash = hash;
}

function handleRouting() {
  if (!session) return;
  const hash = window.location.hash || '';
  if (!hash.startsWith('#/')) {
    const defaultScreen = session.role === 'admin' ? 'dash-admin' : 'meus-rpas';
    window.location.hash = '#/' + defaultScreen;
    return;
  }

  const pathPart = hash.substring(2); // remove '#/'
  const [screenId, queryStr] = pathPart.split('?');

  const params = {};
  if (queryStr) {
    queryStr.split('&').forEach(pair => {
      const [k, v] = pair.split('=');
      if (k) params[decodeURIComponent(k)] = decodeURIComponent(v || '');
    });
  }

  navigateToScreen(screenId, params);
}

window.addEventListener('hashchange', handleRouting);

function navigateToScreen(id, params) {
  const currentActiveScreen = document.querySelector('.screen.active');
  const currentScreenId = currentActiveScreen ? currentActiveScreen.id.replace('screen-', '') : '';

  if (id === currentScreenId) {
    if (id === 'resultados') {
      const filterRpa = document.getElementById('filter-rpa');
      const filterStatus = document.getElementById('filter-status');
      if (filterRpa && filterStatus) {
        filterRpa.value = params.rpaId || '';
        filterStatus.value = params.status || 'Todos';
        loadExecutions();
        return;
      }
    }
  }

  toggleSidebar(false);
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  
  const s = document.getElementById('screen-' + id);
  if(s) s.classList.add('active');
  
  document.querySelectorAll('.nav-item').forEach(n => {
    const oc = n.getAttribute('onclick') || '';
    if(oc.includes("'"+id+"'")) n.classList.add('active');
  });

  if(SCREEN_TITLES[id]) {
    document.getElementById('topbar-title').textContent = SCREEN_TITLES[id][0];
    document.getElementById('topbar-sub').textContent = SCREEN_TITLES[id][1];
  }

  // Update topbar actions dynamically
  const btnNovo = document.getElementById('btn-novo-top');
  if(session.role === 'admin') {
    if(id === 'clientes') { btnNovo.innerHTML = '<i class="ti ti-plus"></i> Novo cliente'; btnNovo.onclick = abrirModalCliente; }
    else if(id === 'rpas-admin') { btnNovo.innerHTML = '<i class="ti ti-plus"></i> Novo RPA'; btnNovo.onclick = abrirModalRPA; }
    else { btnNovo.innerHTML = '<i class="ti ti-plus"></i> Novo cliente'; btnNovo.onclick = abrirModalCliente; }
  }

  // Manage real-time polling interval for the Resultados screen
  if (window.resultadosPollIntervalId) {
    clearInterval(window.resultadosPollIntervalId);
    window.resultadosPollIntervalId = null;
  }

  // Apply screen-specific parameters/filters if present
  if (id === 'resultados') {
    window.pendingResultsFilters = params;
  }

  // Data fetching routing
  if (id === 'dash-admin') loadAdminDashboard();
  else if (id === 'clientes') loadClientes();
  else if (id === 'rpas-admin') loadRpasAdmin();
  else if (id === 'credenciais') loadCredenciais();
  else if (id === 'meus-rpas') loadClientDashboard();
  else if (id === 'alertas') loadAlertasView();
  else if (id === 'resultados') {
    loadResultadosView();
    // Poll for updates every 10 minutes while on the Resultados screen (fallback to WebSocket)
    window.resultadosPollIntervalId = setInterval(() => {
      loadExecutions();
    }, 600000); // 10 minutes
  }
}

function applyExecutionsFilter() {
  const rpaId = document.getElementById('filter-rpa').value;
  const status = document.getElementById('filter-status').value;
  const params = {};
  if (rpaId) params.rpaId = rpaId;
  if (status && status !== 'Todos') params.status = status;
  go('resultados', params);
}

/* ═════════════════════════════════════════════════════════════
   4. DATA FETCHERS & DOM RENDERING
   ═════════════════════════════════════════════════════════════ */

// ── ADMIN DASHBOARD ──
function loadAdminDashboard() {
  if (isMockMode()) {
    renderMockAdminDashboard();
    return;
  }
  fetch('/api/dashboard/admin')
    .antigravityJson()
    .then(data => {
      renderAdminDashboardData(data);
    })
    .catch(err => {
      console.warn("Failed to fetch admin dashboard. Retrying in mock mode...", err);
      window.useMockMode = true;
      loadAdminDashboard();
    });
}

function renderAdminDashboardData(data) {
  document.getElementById('admin-m-clientes').textContent = data.totalClientes;
  document.getElementById('admin-m-rpas').textContent = data.totalRpas;
  document.getElementById('admin-m-ativos').textContent = data.rpasAtivos;
  document.getElementById('admin-m-manutencao').textContent = data.rpasManutencao;

  const grid = document.getElementById('admin-clients-grid');
  grid.innerHTML = '';
  if (data.clientStats) {
    data.clientStats.forEach(c => {
      const char = c.nome.substring(0, 2).toUpperCase();
      const card = document.createElement('div');
      card.className = 'client-card';
      card.onclick = () => {
        session.role = 'client';
        session.clientId = c.id;
        session.companyName = c.nome;
        sessionStorage.setItem("op_session", JSON.stringify(session));
        bootstrapApp();
      };
      card.innerHTML = `
        <div class="client-card-header">
          <div class="client-avatar" style="background:var(--gradient-client-card-avatar);">${char}</div>
          <div>
            <div class="client-name">${c.nome}</div>
            <div class="client-meta">${c.username} · ${c.rpaCount} RPAs</div>
          </div>
          <span class="badge ${c.status === 'Ativo' ? 'badge-success' : 'badge-warn'}" style="margin-left:auto;">
            ${c.status === 'Ativo' ? '<span class="glow-dot"></span>Ativo' : '<i class="ti ti-tool"></i>Manutenção'}
          </span>
        </div>
        <div class="client-stats">
          <div class="client-stat">
            <div class="client-stat-num" style="color:var(--color-primary-lilac);">${c.rpaCount}</div>
            <div class="client-stat-lbl">RPAs</div>
          </div>
          <div class="client-stat">
            <div class="client-stat-num" style="color:var(--color-success);">${c.executions}</div>
            <div class="client-stat-lbl">Execuções</div>
          </div>
          <div class="client-stat">
            <div class="client-stat-num" style="color:${c.successRate >= 90 ? 'var(--color-success)' : 'var(--color-warn)'};">${c.successRate}%</div>
            <div class="client-stat-lbl">Sucesso</div>
          </div>
        </div>
        <div class="client-actions">
          <button class="btn btn-ghost btn-xs" onclick="event.stopPropagation(); abrirModalRPA()"><i class="ti ti-robot"></i> Add RPA</button>
          <button class="btn btn-ghost btn-xs" onclick="event.stopPropagation(); abrirModalCred('${c.nome.replaceAll("'", "\\'")}', '${c.username}', 'abc123')"><i class="ti ti-key"></i> Credenciais</button>
          <button class="btn btn-danger-ghost btn-xs" onclick="event.stopPropagation(); deleteCliente('${c.id}')"><i class="ti ti-trash"></i></button>
        </div>
      `;
      grid.appendChild(card);
    });
  }
}

function renderMockAdminDashboard() {
  const clients = getMockClients();
  const rpas = getMockRpas();
  const subtasks = getMockSubtasks();

  const totalClientes = clients.length;
  const totalRpas = rpas.length;
  const rpasAtivos = rpas.filter(r => r.status === 'Ativo').length;
  const rpasManutencao = rpas.filter(r => r.status === 'Em Manutenção').length;

  const clientStats = clients.map(c => {
    const clientRpas = rpas.filter(r => r.cliente.id === c.id);
    const clientSubtasks = subtasks.filter(s => s.clientId === c.id);
    const executions = clientSubtasks.length;
    const successRows = clientSubtasks.filter(s => s.status === 'Sucesso').length;
    
    let successRate = 100;
    if (executions > 0) {
      successRate = Math.round((successRows / executions) * 100);
    }
    
    const hasMaintenance = clientRpas.some(r => r.status === 'Em Manutenção');
    const status = hasMaintenance ? "Manutenção" : "Ativo";

    return {
      id: c.id,
      nome: c.nome,
      username: 'cliente_' + c.nome.toLowerCase().replaceAll(/[^a-z0-9]/g, ""),
      rpaCount: clientRpas.length,
      executions: executions,
      successRate: successRate,
      status: status
    };
  });

  renderAdminDashboardData({
    totalClientes,
    totalRpas,
    rpasAtivos,
    rpasManutencao,
    clientStats
  });
}

// ── CLIENTS VIEW ──
function loadClientes() {
  if (isMockMode()) {
    renderClientesData(getMockClients());
    return;
  }
  fetch('/api/clientes')
    .antigravityJson()
    .then(data => {
      renderClientesData(data);
    })
    .catch(err => {
      console.warn("Failed to fetch clients. Retrying in mock mode...", err);
      window.useMockMode = true;
      loadClientes();
    });
}

function renderClientesData(data) {
  const tbody = document.querySelector('#tbl-clientes tbody');
  tbody.innerHTML = '';
  if (data.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;color:var(--color-text-muted);">Nenhum cliente cadastrado.</td></tr>`;
    return;
  }
  data.forEach(c => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><strong>${c.nome}</strong></td>
      <td>${c.razaoSocial || '—'}</td>
      <td><code>${c.cnpj || '—'}</code></td>
      <td><span class="badge badge-success"><span class="glow-dot"></span>Ativo</span></td>
      <td>
        <div style="display:flex;gap:6px;">
          <button class="btn btn-ghost btn-xs" onclick="abrirModalCred('${c.nome.replaceAll("'", "\\'")}', 'cliente_${c.nome.toLowerCase().replaceAll(/[^a-z0-9]/g, "")}', 'abc123')"><i class="ti ti-key"></i></button>
          <button class="btn btn-danger-ghost btn-xs" onclick="deleteCliente('${c.id}')"><i class="ti ti-trash"></i></button>
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

// ── RPAS CATALOG ──
function loadRpasAdmin() {
  if (isMockMode()) {
    renderRpasAdminData(getMockRpas());
    return;
  }
  fetch('/api/rpas')
    .antigravityJson()
    .then(data => {
      renderRpasAdminData(data);
    })
    .catch(err => {
      console.warn("Failed to fetch RPAs. Retrying in mock mode...", err);
      window.useMockMode = true;
      loadRpasAdmin();
    });
}

function renderRpasAdminData(data) {
  const tbody = document.querySelector('#tbl-rpas-admin tbody');
  tbody.innerHTML = '';
  if (data.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;color:var(--color-text-muted);">Nenhum RPA cadastrado.</td></tr>`;
    return;
  }
  data.forEach(r => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><strong style="cursor:pointer;color:var(--color-primary-light);text-decoration:underline;" onclick="openRpaReport('${r.id}')">${r.nome}</strong></td>
      <td><code>${r.identificadorRpa || '—'}</code></td>
      <td><span class="badge badge-info">${r.cliente.nome}</span></td>
      <td>${r.departamento || '—'}</td>
      <td><span class="badge ${r.status === 'Ativo' ? 'badge-success' : (r.status === 'Inativo' ? 'badge-danger' : 'badge-warn')}">${r.status === 'Ativo' ? '<span class="glow-dot"></span>Ativo' : r.status}</span></td>
      <td>
        <button class="btn btn-danger-ghost btn-xs" onclick="event.stopPropagation(); deleteRpa('${r.id}')"><i class="ti ti-trash"></i></button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

// ── CREDENTIALS/USERS VIEW ──
function loadCredenciais() {
  if (isMockMode()) {
    renderUsuariosData(getMockUsers());
    return;
  }
  fetch('/api/usuarios')
    .antigravityJson()
    .then(data => {
      renderUsuariosData(data);
    })
    .catch(err => {
      console.warn("Failed to fetch users. Retrying in mock mode...", err);
      window.useMockMode = true;
      loadCredenciais();
    });
}

function renderUsuariosData(users) {
  const tbody = document.querySelector('#tbl-usuarios tbody');
  if (!tbody) return;
  tbody.innerHTML = '';
  
  users.forEach(u => {
    const tr = document.createElement('tr');
    
    // Format linked clients as badges
    let clientesBadges = '';
    if (u.clientes && u.clientes.length > 0) {
      clientesBadges = u.clientes.map(c => 
        `<span style="display:inline-block; background:var(--color-bg-surface-light); color:var(--color-text); padding:3px 8px; border-radius:var(--radius-xs); font-size:11px; font-weight:500; border:1px solid var(--color-border); margin:2px;">${c.nome}</span>`
      ).join('');
    } else {
      clientesBadges = `<span style="font-size:11.5px; color:var(--color-text-muted); font-style:italic;">Nenhuma empresa vinculada</span>`;
    }
    
    // Perfil Badge
    const roleBadge = u.role === 'admin' 
      ? `<span class="topbar-badge" style="margin:0;"><i class="ti ti-shield-check"></i> Admin</span>`
      : `<span class="topbar-badge" style="margin:0; background:#e8f4fd; color:#0b66c2; border-color:#0b66c2;"><i class="ti ti-user"></i> Cliente</span>`;

    tr.innerHTML = `
      <td><strong>${u.nome} ${u.sobrenome || ''}</strong></td>
      <td><code>${u.username}</code></td>
      <td>${roleBadge}</td>
      <td><div style="display:flex; flex-wrap:wrap; gap:4px;">${clientesBadges}</div></td>
      <td>
        <button class="btn btn-ghost btn-xs" style="color:var(--color-primary-lilac); border-color:var(--color-border);" onclick="abrirModalVinculos('${u.id}', '${u.nome.replaceAll("'", "\\'")}')"><i class="ti ti-link"></i> Vincular Empresas</button>
        <button class="btn btn-ghost btn-xs" style="color:var(--color-danger); border-color:var(--color-border);" onclick="deleteUser('${u.id}')"><i class="ti ti-trash"></i> Excluir</button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

function abrirModalUsuario() {
  document.getElementById('modal-usuario').style.display = 'flex';
}

function submitUser() {
  const nome = document.getElementById('m-user-nome').value.trim();
  const sobrenome = document.getElementById('m-user-sobrenome').value.trim();
  const dep = document.getElementById('m-user-dep').value.trim();
  const role = document.getElementById('m-user-role').value;
  const user = document.getElementById('m-user-username').value.trim();
  const pass = document.getElementById('m-user-password').value.trim();

  if(!nome || !user || !pass) {
    alert("Por favor, preencha todos os campos obrigatórios (*).");
    return;
  }

  if (isMockMode()) {
    const users = getMockUsers();
    const newUser = {
      id: crypto.randomUUID ? crypto.randomUUID() : "mock-user-" + Date.now(),
      nome: nome,
      sobrenome: sobrenome,
      departamento: dep,
      role: role,
      username: user.toLowerCase(),
      clientes: []
    };
    users.push(newUser);
    saveMockUsers(users);

    fecharModal('modal-usuario');
    clearUserFormFields();
    loadCredenciais();
    return;
  }

  fetch('/api/usuarios', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      nome: nome,
      sobrenome: sobrenome,
      departamento: dep,
      role: role,
      username: user,
      password: pass
    })
  })
  .then(res => {
    if(res.ok) {
      fecharModal('modal-usuario');
      clearUserFormFields();
      loadCredenciais();
    } else {
      res.json().then(data => {
        alert(data.message || "Erro ao criar usuário.");
      }).catch(() => {
        alert("Erro ao criar usuário.");
      });
    }
  })
  .catch(err => {
    console.warn("Failed to create user. Retrying in mock mode...", err);
    window.useMockMode = true;
    submitUser();
  });
}

function clearUserFormFields() {
  document.getElementById('m-user-nome').value = '';
  document.getElementById('m-user-sobrenome').value = '';
  document.getElementById('m-user-dep').value = '';
  document.getElementById('m-user-role').value = 'client';
  document.getElementById('m-user-username').value = '';
  document.getElementById('m-user-password').value = '';
}

function deleteUser(userId) {
  if (!confirm("Tem certeza que deseja remover este usuário?")) return;

  if (isMockMode()) {
    const users = getMockUsers().filter(u => u.id !== userId);
    saveMockUsers(users);
    loadCredenciais();
    return;
  }

  fetch(`/api/usuarios/${userId}`, {
    method: 'DELETE'
  })
  .then(res => {
    if(res.ok) {
      loadCredenciais();
    } else {
      alert("Erro ao remover usuário.");
    }
  })
  .catch(err => {
    console.warn("Failed to remove user. Retrying in mock mode...", err);
    window.useMockMode = true;
    deleteUser(userId);
  });
}

function abrirModalVinculos(userId, userNome) {
  document.getElementById('m-vinculo-userid').value = userId;
  document.getElementById('vinculos-modal-sub').textContent = `Selecione as empresas que o usuário "${userNome}" poderá visualizar`;

  const checkboxList = document.getElementById('vinculos-checkbox-list');
  checkboxList.innerHTML = `<div style="text-align:center; padding:15px; color:var(--color-text-muted);">Carregando empresas...</div>`;

  document.getElementById('modal-vinculos').style.display = 'flex';

  // 1. Get all clients
  let clientsPromise = isMockMode() 
    ? Promise.resolve(getMockClients())
    : fetch('/api/clientes').then(res => res.json());

  // 2. Get user current links
  let userPromise = isMockMode()
    ? Promise.resolve(getMockUsers().find(u => u.id === userId))
    : fetch('/api/usuarios').then(res => res.json()).then(users => users.find(u => u.id === userId));

  Promise.all([clientsPromise, userPromise])
    .then(([clients, user]) => {
      checkboxList.innerHTML = '';
      if (!clients || clients.length === 0) {
        checkboxList.innerHTML = `<div style="text-align:center; padding:15px; color:var(--color-text-muted);">Nenhum cliente cadastrado.</div>`;
        return;
      }

      const linkedIds = (user && user.clientes) ? user.clientes.map(c => c.id) : [];

      clients.forEach(c => {
        const isChecked = linkedIds.includes(c.id) ? 'checked' : '';
        const item = document.createElement('div');
        item.style.display = 'flex';
        item.style.alignItems = 'center';
        item.style.gap = '10px';
        item.style.padding = '8px 6px';
        item.style.borderBottom = '1px solid var(--color-border)';
        item.innerHTML = `
          <input type="checkbox" id="chk-vinculo-${c.id}" value="${c.id}" ${isChecked} style="width:16px; height:16px; cursor:pointer;">
          <label for="chk-vinculo-${c.id}" style="cursor:pointer; font-weight:500; font-size:var(--fs-sm);">${c.nome}</label>
        `;
        checkboxList.appendChild(item);
      });
    })
    .catch(err => {
      console.error("Error loading links data", err);
      checkboxList.innerHTML = `<div style="color:var(--color-danger); text-align:center; padding:15px;">Erro ao carregar dados de vínculo.</div>`;
    });
}

function submitVinculos() {
  const userId = document.getElementById('m-vinculo-userid').value;
  const checkboxList = document.getElementById('vinculos-checkbox-list');
  const checkedBoxes = checkboxList.querySelectorAll('input[type="checkbox"]:checked');
  const clientIds = Array.from(checkedBoxes).map(cb => cb.value);

  if (isMockMode()) {
    const users = getMockUsers();
    const user = users.find(u => u.id === userId);
    if (user) {
      const allClients = getMockClients();
      user.clientes = allClients.filter(c => clientIds.includes(c.id)).map(c => ({ id: c.id, nome: c.nome }));
      saveMockUsers(users);
    }
    fecharModal('modal-vinculos');
    loadCredenciais();
    return;
  }

  fetch(`/api/usuarios/${userId}/vinculos`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(clientIds)
  })
  .then(res => {
    if (res.ok) {
      fecharModal('modal-vinculos');
      loadCredenciais();
    } else {
      alert("Erro ao salvar vínculos.");
    }
  })
  .catch(err => {
    console.error("Error saving links", err);
    alert("Erro ao salvar vínculos.");
  });
}

// ── CLIENT WORKSPACE ──
function loadClientDashboard() {
  if (isMockMode()) {
    renderMockClientDashboard();
    return;
  }
  fetch(`/api/dashboard/client/${session.clientId}`)
    .antigravityJson()
    .then(data => {
      renderClientDashboardData(data);
    })
    .catch(err => {
      console.warn("Failed to fetch client dashboard. Retrying in mock mode...", err);
      window.useMockMode = true;
      loadClientDashboard();
    });
}

function renderClientDashboardData(data) {
  document.getElementById('client-m-total').textContent = data.totalRpas;
  document.getElementById('client-m-ativos').textContent = data.rpasAtivos;
  document.getElementById('client-m-manutencao').textContent = data.rpasManutencao;
  document.getElementById('client-m-inativos').textContent = data.rpasInativos;

  const rows = document.getElementById('client-rpa-list-rows');
  rows.innerHTML = '';
  if (data.rpas.length === 0) {
    rows.innerHTML = `<div style="padding:20px;text-align:center;color:var(--color-text-muted);">Nenhum robô cadastrado para sua empresa.</div>`;
    return;
  }
  data.rpas.forEach(r => {
    const icon = r.status === 'Em Manutenção' ? 'warn' : '';
    const rIcon = r.nome.includes('Fiscal') || r.nome.includes('NF') ? 'ti-file-invoice' : (r.nome.includes('Boleto') ? 'ti-receipt' : 'ti-shopping-cart');
    const row = document.createElement('div');
    row.className = 'rpa-row';
    row.innerHTML = `
      <div class="rpa-icon ${icon}"><i class="ti ${rIcon}"></i></div>
      <div>
        <div style="font-weight:500;font-size:var(--fs-base);">${r.nome}</div>
        <div style="font-size:var(--fs-sm);color:var(--color-text-muted);">${r.departamento || 'Geral'} &middot; ID: <code>${r.identificadorRpa || '—'}</code> &middot; ${r.descricao || 'Sem descrição'}</div>
      </div>
      <span class="badge ${r.status === 'Ativo' ? 'badge-success' : (r.status === 'Inativo' ? 'badge-danger' : 'badge-warn')}" style="margin-left:auto;margin-right:12px;">
        ${r.status === 'Ativo' ? '<span class="glow-dot"></span>Ativo' : r.status}
      </span>
      <div style="display:flex;gap:6px;">
        <button class="btn btn-success-ghost btn-sm" onclick="event.stopPropagation(); executarRpaAgora('${r.id}')" title="Executar agora" style="color:var(--color-success); border-color:rgba(46,204,113,0.2);"><i class="ti ti-player-play"></i></button>
        <button class="btn btn-ghost btn-sm" onclick="event.stopPropagation(); abrirModalAgendamentos('${r.id}', '${r.nome.replaceAll("'", "\\'")}')" title="Agendamentos"><i class="ti ti-clock"></i></button>
        <button class="btn btn-ghost btn-sm" onclick="event.stopPropagation(); go('alertas')"><i class="ti ti-bell"></i></button>
        <button class="btn btn-ghost btn-sm" onclick="event.stopPropagation(); openRpaReport('${r.id}')"><i class="ti ti-chart-bar"></i></button>
      </div>
    `;
    rows.appendChild(row);
  });
}

function renderMockClientDashboard() {
  const rpas = getMockRpas().filter(r => r.cliente.id === session.clientId);
  const totalRpas = rpas.length;
  const rpasAtivos = rpas.filter(r => r.status === 'Ativo').length;
  const rpasManutencao = rpas.filter(r => r.status === 'Em Manutenção').length;
  const rpasInativos = rpas.filter(r => r.status === 'Inativo').length;

  renderClientDashboardData({
    totalRpas,
    rpasAtivos,
    rpasManutencao,
    rpasInativos,
    rpas
  });
}

// ── ALERTS SELECTION ──
function loadAlertasView() {
  if (isMockMode()) {
    renderMockAlertasView();
    return;
  }
  fetch(`/api/rpas?clientId=${session.clientId}`)
    .antigravityJson()
    .then(rpas => {
      renderAlertasViewDropdown(rpas);
    })
    .catch(err => {
      console.warn("Failed to fetch alerts. Retrying in mock mode...", err);
      window.useMockMode = true;
      loadAlertasView();
    });
}

function renderAlertasViewDropdown(rpas) {
  const select = document.getElementById('alert-rpa-select');
  select.innerHTML = '';
  rpas.forEach(r => {
    const opt = document.createElement('option');
    opt.value = r.id;
    opt.textContent = r.nome;
    select.appendChild(opt);
  });
  loadAlertsForSelectedRpa();
}

function renderMockAlertasView() {
  const rpas = getMockRpas().filter(r => r.cliente.id === session.clientId);
  renderAlertasViewDropdown(rpas);
}

function loadAlertsForSelectedRpa() {
  const rpaId = document.getElementById('alert-rpa-select').value;
  if (!rpaId) return;
  currentAlertRpaId = rpaId;

  if (isMockMode()) {
    const rpas = getMockRpas().filter(r => r.cliente.id === session.clientId);
    const rpa = rpas.find(r => r.id === rpaId);
    if (rpa) {
      currentAlertEmails = rpa.emailsAlerta || [];
      renderEmailTags();
    }
    return;
  }

  fetch(`/api/rpas?clientId=${session.clientId}`)
    .antigravityJson()
    .then(rpas => {
      const rpa = rpas.find(r => r.id === rpaId);
      if (rpa) {
        currentAlertEmails = rpa.emailsAlerta || [];
        renderEmailTags();
      }
    })
    .catch(err => {
      console.warn("Failed to fetch RPA alerts. Retrying in mock mode...", err);
      window.useMockMode = true;
      loadAlertsForSelectedRpa();
    });
}

function renderEmailTags() {
  const container = document.getElementById('alert-email-tags');
  container.innerHTML = '';
  if (currentAlertEmails.length === 0) {
    container.innerHTML = `<span style="font-size:var(--fs-sm);color:var(--color-text-muted);">Nenhum email cadastrado.</span>`;
    return;
  }
  currentAlertEmails.forEach((email, idx) => {
    const tag = document.createElement('span');
    tag.className = 'email-tag';
    tag.innerHTML = `<i class="ti ti-mail" style="font-size:13px;color:var(--color-primary-lilac);"></i>${email}<span class="rm" onclick="removeAlertEmailTag(${idx})">×</span>`;
    container.appendChild(tag);
  });
}

function addAlertEmailTag() {
  const inp = document.getElementById('inp-alert-email');
  const email = inp.value.trim();
  if (email && email.includes('@') && !currentAlertEmails.includes(email)) {
    currentAlertEmails.push(email);
    renderEmailTags();
    inp.value = '';
  }
}

function removeAlertEmailTag(idx) {
  currentAlertEmails.splice(idx, 1);
  renderEmailTags();
}

function saveRpaAlerts() {
  if (!currentAlertRpaId) return;

  if (isMockMode()) {
    const rpas = getMockRpas();
    const idx = rpas.findIndex(r => r.id === currentAlertRpaId);
    if (idx !== -1) {
      rpas[idx].emailsAlerta = currentAlertEmails;
      saveMockRpas(rpas);
      alert("Configurações de alerta salvas offline!");
    }
    return;
  }

  fetch(`/api/rpas/${currentAlertRpaId}/alertas`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(currentAlertEmails)
  })
  .then(res => {
    if (res.ok) alert("Configurações de alerta salvas!");
  })
  .catch(err => {
    console.warn("Failed to save alerts. Retrying in mock mode...", err);
    window.useMockMode = true;
    saveRpaAlerts();
  });
}

// ── RESULTS & RUNTIME EXECUTION ──
function loadResultadosView() {
  if (isMockMode()) {
    const rpas = getMockRpas().filter(r => session.role === 'admin' ? true : r.cliente.id === session.clientId);
    renderResultadosViewDropdown(rpas);
    return;
  }

  fetch(`/api/rpas?clientId=${session.role === 'admin' ? '' : session.clientId}`)
    .antigravityJson()
    .then(rpas => {
      renderResultadosViewDropdown(rpas);
    })
    .catch(err => {
      console.warn("Failed to load search filters. Retrying in mock mode...", err);
      window.useMockMode = true;
      loadResultadosView();
    });
}

function renderResultadosViewDropdown(rpas) {
  const filter = document.getElementById('filter-rpa');
  filter.innerHTML = '<option value="">Todos</option>';
  rpas.forEach(r => {
    const opt = document.createElement('option');
    opt.value = r.id;
    opt.textContent = r.nome;
    filter.appendChild(opt);
  });

  // Apply pending URL parameters if any
  if (window.pendingResultsFilters) {
    if (window.pendingResultsFilters.rpaId) {
      filter.value = window.pendingResultsFilters.rpaId;
    }
    if (window.pendingResultsFilters.status) {
      document.getElementById('filter-status').value = window.pendingResultsFilters.status;
    }
    window.pendingResultsFilters = null; // consume filters
  }

  loadExecutions();
}

function loadExecutions() {
  const rpaId = document.getElementById('filter-rpa').value;
  const status = document.getElementById('filter-status').value;

  if (isMockMode()) {
    renderMockExecutions(rpaId, status);
    return;
  }
  
  let url = '/api/resultados?';
  if (session.role !== 'admin') url += `clientId=${session.clientId}&`;
  if (rpaId) url += `rpaId=${rpaId}&`;
  if (status && status !== 'Todos') url += `status=${status}&`;

  fetch(url)
    .antigravityJson()
    .then(data => {
      renderExecutionsData(data);
    })
    .catch(err => {
      console.warn("Failed to query execution logs. Retrying in mock mode...", err);
      window.useMockMode = true;
      loadExecutions();
    });
}

function renderExecutionsData(data) {
  window.currentExecutions = data;
  const tbody = document.querySelector('#tbl-resultados tbody');
  tbody.innerHTML = '';

  if (!window.expandedTaskIds) {
    window.expandedTaskIds = new Set();
  }

  let totalTasks = data.length;
  let totalSubtasks = 0;
  let totalSucesso = 0;
  let totalErro = 0;
  let totalNaoEncontrado = 0;

  data.forEach(t => {
    totalSubtasks += t.totalLinhas || 0;
    totalSucesso += t.linhasSucesso || 0;
    totalErro += t.linhasErro || 0;
    totalNaoEncontrado += t.linhasNaoEncontrado || 0;
  });

  let taxa = totalSubtasks > 0 ? Math.round((totalSucesso / totalSubtasks) * 100) : 100;

  document.getElementById('res-m-total').textContent = totalSubtasks;
  document.getElementById('res-m-sucesso').textContent = totalSucesso;
  document.getElementById('res-m-erro').textContent = totalErro;
  document.getElementById('res-m-nao-encontrado').textContent = totalNaoEncontrado;
  document.getElementById('res-m-taxa').textContent = taxa + '%';

  if (data.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;color:var(--color-text-muted); padding:16px;">Nenhuma execução registrada para os filtros selecionados.</td></tr>`;
    return;
  }

  data.forEach((t, tIndex) => {
    // 1. Task Row
    const tr = document.createElement('tr');
    tr.className = 'task-row';
    tr.style.cursor = 'pointer';
    
    const dtStr = t.timestampInicio ? new Date(t.timestampInicio).toLocaleString('pt-BR') : '—';
    
    let badge = 'badge-success';
    let icon = 'ti-check';
    if (t.status === 'Erro') { badge = 'badge-danger'; icon = 'ti-x'; }
    else if (t.status === 'Não Encontrado') { badge = 'badge-warn'; icon = 'ti-alert-circle'; }
    else if (t.status === 'Processando') { badge = 'badge-info'; icon = 'ti-loader'; }

    // Summary description of subtasks
    let summaryHtml = `
      <span style="color:var(--color-success); font-weight:600; margin-right:12px;">
        <i class="ti ti-circle-check"></i> ${t.linhasSucesso || 0}
      </span>
      <span style="color:var(--color-danger); font-weight:600; margin-right:12px;">
        <i class="ti ti-alert-triangle"></i> ${t.linhasErro || 0}
      </span>
      <span style="color:var(--color-warn); font-weight:600;">
        <i class="ti ti-help-circle"></i> ${t.linhasNaoEncontrado || 0}
      </span>
    `;

    const isExpanded = window.expandedTaskIds.has(t.id);
    const caretTransform = isExpanded ? 'transform: rotate(90deg);' : '';

    tr.innerHTML = `
      <td><i class="ti ti-chevron-right toggle-caret" style="margin-right:8px; display:inline-block; transition: transform 0.2s; ${caretTransform}"></i>${dtStr}</td>
      <td><span class="badge badge-info">${t.rpaNome}</span></td>
      <td><strong>${t.nome}</strong></td>
      <td>${summaryHtml}</td>
      <td><span class="badge ${badge}"><i class="ti ${icon}"></i>${t.status}</span></td>
    `;
    
    // 2. Nested Subtasks Row
    const subtr = document.createElement('tr');
    subtr.className = 'subtasks-nested-row';
    subtr.style.display = isExpanded ? 'table-row' : 'none';
    
    let subtasksTableRowsHtml = '';
    if (t.subtasks && t.subtasks.length > 0) {
      t.subtasks.forEach((sub, sIndex) => {
        let subBadge = 'badge-success';
        let subIcon = 'ti-check';
        if (sub.status === 'Erro') { subBadge = 'badge-danger'; subIcon = 'ti-x'; }
        else if (sub.status === 'Não Encontrado') { subBadge = 'badge-warn'; subIcon = 'ti-alert-circle'; }

        const subVal = sub.valorTotalDocumento != null ? 'R$ ' + sub.valorTotalDocumento.toFixed(2) : 'R$ 0,00';
        const subForn = sub.nomeFornecedor || 'N/A';
        const subDoc = sub.numeroDocumento || 'N/A';
        
        let chkHtml = '';
        if (sub.status === 'Erro' || sub.status === 'Não Encontrado') {
          chkHtml = `<input type="checkbox" class="subtask-reprocess-chk-${t.id}" data-subtask-id="${sub.id}" data-doc="${subDoc}" onclick="event.stopPropagation();" style="width:16px; height:16px; cursor:pointer; vertical-align:middle;">`;
        } else {
          chkHtml = `<input type="checkbox" disabled style="width:16px; height:16px; opacity:0.25; cursor:not-allowed; vertical-align:middle;">`;
        }

        subtasksTableRowsHtml += `
          <tr style="border-bottom:1px solid rgba(0,0,0,0.05); background: transparent;">
            <td style="padding:8px; text-align:center;">${chkHtml}</td>
            <td style="padding:8px;">${sub.nome || '—'}</td>
            <td style="padding:8px;"><strong>${subDoc}</strong></td>
            <td style="padding:8px;">${sub.dataEmissao || '—'}</td>
            <td style="padding:8px;">${subVal}</td>
            <td style="padding:8px;">${subForn}</td>
            <td style="padding:8px;"><span class="badge ${subBadge}"><i class="ti ${subIcon}"></i>${sub.status}</span></td>
            <td style="padding:8px; max-width:200px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;" title="${sub.msgErro || ''}">
              ${sub.msgErro || 'Processamento concluído'}
            </td>
            <td style="padding:8px; text-align:center;">
              <button class="btn btn-sm btn-ghost" onclick="event.stopPropagation(); showSubtaskDetails(${tIndex}, ${sIndex});" style="padding: 2px 6px; font-size: 11px;">
                <i class="ti ti-eye"></i> Detalhes
              </button>
            </td>
          </tr>
        `;
      });
    } else {
      subtasksTableRowsHtml = `
        <tr>
          <td colspan="9" style="text-align:center; color:var(--color-text-muted); padding:12px;">
            Nenhuma subtask registrada para esta execução.
          </td>
        </tr>
      `;
    }

    let reprocessBtnHtml = '';
    if (t.status !== 'Processando') {
      reprocessBtnHtml = `<button class="btn btn-primary btn-xs" onclick="event.stopPropagation(); reprocessarSubtasksSelecionadas('${t.id}', '${t.cadastroRpaId}', '${t.caminhoPlanilha || ''}')" style="margin-left: 15px; padding: 3px 10px; font-size: 11px;"><i class="ti ti-rotate-clockwise"></i> Reprocessar Notas Selecionadas</button>`;
    }

    subtr.innerHTML = `
      <td colspan="5" style="padding:16px 24px; background: var(--color-bg-surface-light); border-top: 1px inset var(--color-border); border-bottom: 1px inset var(--color-border);">
        <div style="font-size: 12px; font-weight: 600; color: var(--color-text-muted); margin-bottom: 8px; text-transform: uppercase; letter-spacing: 0.5px; display:flex; align-items:center;">
          Itens Processados (Subtasks) ${reprocessBtnHtml}
        </div>
        <div class="table-wrap" style="box-shadow: none; border: 1px solid var(--color-border); margin: 0; background: var(--color-card);">
          <table style="width:100%; border-collapse: collapse;">
            <thead>
              <tr style="background: var(--color-bg-surface); border-bottom: 2px solid var(--color-border);">
                <th style="padding:8px; font-size:12px; text-align:center; width: 40px;">Sel</th>
                <th style="padding:8px; font-size:12px; text-align:left;">Item</th>
                <th style="padding:8px; font-size:12px; text-align:left;">Documento</th>
                <th style="padding:8px; font-size:12px; text-align:left;">Emissão</th>
                <th style="padding:8px; font-size:12px; text-align:left;">Valor</th>
                <th style="padding:8px; font-size:12px; text-align:left;">Fornecedor</th>
                <th style="padding:8px; font-size:12px; text-align:left;">Status</th>
                <th style="padding:8px; font-size:12px; text-align:left;">Resultado / Log</th>
                <th style="padding:8px; font-size:12px; text-align:center; width: 90px;">Ação</th>
              </tr>
            </thead>
            <tbody>
              ${subtasksTableRowsHtml}
            </tbody>
          </table>
        </div>
      </td>
    `;
    
    tr.onclick = () => {
      const isVisible = subtr.style.display !== 'none';
      subtr.style.display = isVisible ? 'none' : 'table-row';
      if (isVisible) {
        window.expandedTaskIds.delete(t.id);
      } else {
        window.expandedTaskIds.add(t.id);
      }
      const caret = tr.querySelector('.toggle-caret');
      if (caret) {
        caret.style.transform = isVisible ? 'rotate(0deg)' : 'rotate(90deg)';
      }
    };

    tbody.appendChild(tr);
    tbody.appendChild(subtr);
  });
}

function renderMockExecutions(rpaId, status) {
  let subtasks = getMockSubtasks();

  if (session.role !== 'admin') {
    subtasks = subtasks.filter(s => s.clientId === session.clientId);
  }
  if (rpaId) {
    subtasks = subtasks.filter(s => s.rpaId === rpaId);
  }

  // Group mock subtasks into mock tasks dynamically
  const tasksMap = {};
  
  subtasks.forEach(s => {
    const key = s.rpaId;
    if (!tasksMap[key]) {
      tasksMap[key] = {
        id: "mock-task-" + s.rpaId,
        nome: s.rpaNome === "Leitura Planilha NFe" ? "lote_nfe_entradas.json" : 
              s.rpaNome === "Conciliação Bancária" ? "conciliacao_extrato.json" : "monitoramento_rotas.json",
        caminhoJsonDisco: "/data/mock/" + (s.rpaNome === "Leitura Planilha NFe" ? "lote_nfe_entradas.json" : 
                            s.rpaNome === "Conciliação Bancária" ? "conciliacao_extrato.json" : "monitoramento_rotas.json"),
        timestampInicio: s.dataExecucao,
        timestampFim: s.dataExecucao,
        status: "Sucesso",
        msgErro: null,
        totalLinhas: 0,
        linhasSucesso: 0,
        linhasErro: 0,
        linhasNaoEncontrado: 0,
        rpaNome: s.rpaNome,
        rpaId: s.rpaId,
        clientId: s.clientId,
        subtasks: []
      };
    }
    
    const task = tasksMap[key];
    task.totalLinhas++;
    if (s.status === 'Sucesso') task.linhasSucesso++;
    else if (s.status === 'Não Encontrado') task.linhasNaoEncontrado++;
    else if (s.status === 'Erro') task.linhasErro++;
    
    task.subtasks.push(s);
    
    if (new Date(s.dataExecucao) < new Date(task.timestampInicio)) {
      task.timestampInicio = s.dataExecucao;
    }
    if (new Date(s.dataExecucao) > new Date(task.timestampFim)) {
      task.timestampFim = s.dataExecucao;
    }
  });
  
  let tasks = Object.values(tasksMap);
  tasks.forEach(t => {
    if (t.linhasErro > 0) t.status = 'Erro';
    else if (t.linhasNaoEncontrado > 0) t.status = 'Não Encontrado';
    else t.status = 'Sucesso';
  });

  if (status && status !== 'Todos') {
    tasks = tasks.filter(t => t.status === status);
  }

  tasks.sort((a, b) => new Date(b.timestampInicio) - new Date(a.timestampInicio));

  renderExecutionsData(tasks);
}

/* ═════════════════════════════════════════════════════════════
   5. MUTATION COMMANDS (CRUD SUBMISSIONS)
   ═════════════════════════════════════════════════════════════ */

function submitClient() {
  const nome = document.getElementById('m-cli-nome').value.trim();
  const resp = document.getElementById('m-cli-resp').value.trim();
  const razao = document.getElementById('m-cli-razao').value.trim();
  const cnpj = document.getElementById('m-cli-cnpj').value.trim();

  if(!nome) {
    alert("Por favor, preencha o campo obrigatório Nome da empresa (*).");
    return;
  }

  if (isMockMode()) {
    const clients = getMockClients();
    const newClient = {
      id: crypto.randomUUID ? crypto.randomUUID() : "mock-client-" + Date.now(),
      nome: nome,
      razaoSocial: razao,
      cnpj: cnpj,
      responsavel: resp
    };
    clients.push(newClient);
    saveMockClients(clients);

    fecharModal('modal-cliente');
    clearClientFormFields();
    loadAdminDashboard();
    loadClientes();
    return;
  }

  fetch('/api/clientes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      nome: nome,
      razaoSocial: razao,
      cnpj: cnpj,
      responsavel: resp
    })
  })
  .then(res => {
    if(res.ok) {
      fecharModal('modal-cliente');
      clearClientFormFields();
      loadAdminDashboard();
      loadClientes();
    } else {
      alert("Erro ao criar cliente.");
    }
  })
  .catch(err => {
    console.warn("Failed to create client. Retrying in mock mode...", err);
    window.useMockMode = true;
    submitClient();
  });
}

function clearClientFormFields() {
  document.getElementById('m-cli-nome').value = '';
  document.getElementById('m-cli-resp').value = '';
  document.getElementById('m-cli-razao').value = '';
  document.getElementById('m-cli-cnpj').value = '';
}

function submitRpa() {
  const clientId = document.getElementById('m-rpa-cliente').value;
  const nome = document.getElementById('m-rpa-nome').value.trim();
  const identificadorRpa = document.getElementById('m-rpa-identificador').value.trim();
  const dep = document.getElementById('m-rpa-dep').value.trim();
  const regras = document.getElementById('m-rpa-regras').value.trim();
  const riscos = document.getElementById('m-rpa-riscos').value.trim();

  if(!clientId || !nome || !identificadorRpa) {
    alert("Selecione o cliente, preencha o nome do RPA e o identificador.");
    return;
  }

  if (isMockMode()) {
    const rpas = getMockRpas();
    const clients = getMockClients();
    const client = clients.find(c => c.id === clientId) || { id: clientId, nome: "Desconhecido" };
    const newRpa = {
      id: crypto.randomUUID ? crypto.randomUUID() : "mock-rpa-" + Date.now(),
      cliente: { id: client.id, nome: client.nome },
      nome: nome,
      identificadorRpa: identificadorRpa,
      departamento: dep,
      status: 'Ativo',
      descricao: regras.substring(0, 100),
      regras: regras,
      riscos: riscos,
      emailsAlerta: []
    };
    rpas.push(newRpa);
    saveMockRpas(rpas);

    fecharModal('modal-rpa');
    clearRpaFormFields();
    loadAdminDashboard();
    loadRpasAdmin();
    return;
  }

  fetch('/api/rpas', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      clientId: clientId,
      nome: nome,
      identificadorRpa: identificadorRpa,
      departamento: dep,
      status: 'Ativo',
      regras: regras,
      riscos: riscos
    })
  })
  .then(res => {
    if(res.ok) {
      fecharModal('modal-rpa');
      clearRpaFormFields();
      loadAdminDashboard();
      loadRpasAdmin();
    } else {
      alert("Erro ao cadastrar RPA.");
    }
  })
  .catch(err => {
    console.warn("Failed to create RPA. Retrying in mock mode...", err);
    window.useMockMode = true;
    submitRpa();
  });
}

function clearRpaFormFields() {
  document.getElementById('m-rpa-nome').value = '';
  document.getElementById('m-rpa-identificador').value = '';
  document.getElementById('m-rpa-dep').value = '';
  document.getElementById('m-rpa-regras').value = '';
  document.getElementById('m-rpa-riscos').value = '';
}

function deleteCliente(id) {
  if (confirm("Tem certeza que deseja remover este cliente? Todos os RPAs vinculados serão perdidos.")) {
    if (isMockMode()) {
      const clients = getMockClients().filter(c => c.id !== id);
      saveMockClients(clients);
      
      const rpas = getMockRpas().filter(r => r.cliente.id !== id);
      saveMockRpas(rpas);

      loadAdminDashboard();
      loadClientes();
      return;
    }

    fetch(`/api/clientes/${id}`, { method: 'DELETE' })
      .then(res => {
        if(res.ok) {
          loadAdminDashboard();
          loadClientes();
        }
      })
      .catch(err => {
        console.warn("Failed to remove client. Retrying in mock mode...", err);
        window.useMockMode = true;
        deleteCliente(id);
      });
  }
}

function deleteRpa(id) {
  if (confirm("Deseja remover este robô do catálogo?")) {
    if (isMockMode()) {
      const rpas = getMockRpas().filter(r => r.id !== id);
      saveMockRpas(rpas);

      loadAdminDashboard();
      loadRpasAdmin();
      return;
    }

    fetch(`/api/rpas/${id}`, { method: 'DELETE' })
      .then(res => {
        if (res.ok) {
          loadAdminDashboard();
          loadRpasAdmin();
        }
      })
      .catch(err => {
        console.warn("Failed to remove RPA. Retrying in mock mode...", err);
        window.useMockMode = true;
        deleteRpa(id);
      });
  }
}

function loadClientDropdown() {
  if (isMockMode()) {
    renderClientDropdown(getMockClients());
    return;
  }
  fetch('/api/clientes')
    .antigravityJson()
    .then(data => {
      renderClientDropdown(data);
    })
    .catch(err => {
      console.warn("Failed to fetch clients list. Retrying in mock mode...", err);
      window.useMockMode = true;
      loadClientDropdown();
    });
}

function renderClientDropdown(data) {
  const select = document.getElementById('m-rpa-cliente');
  select.innerHTML = '<option value="">Selecione o cliente...</option>';
  data.forEach(c => {
    const opt = document.createElement('option');
    opt.value = c.id;
    opt.textContent = c.nome;
    select.appendChild(opt);
  });
}

/* ═════════════════════════════════════════════════════════════
   6. HELPER EXTENSIONS & MODALS
   ═════════════════════════════════════════════════════════════ */
Promise.prototype.antigravityJson = function() {
  return this.then(res => {
    if (!res.ok) {
      throw new Error("HTTP error " + res.status);
    }
    return res.json().catch(() => ({}));
  });
};

function abrirModalCliente() { document.getElementById('modal-cliente').classList.add('open'); }
function abrirModalRPA()     { loadClientDropdown(); document.getElementById('modal-rpa').classList.add('open'); }
function abrirModalCred(empresa, user, pass) {
  document.getElementById('cred-empresa').textContent = empresa;
  document.getElementById('cred-user').textContent = user;
  document.getElementById('cred-pass').textContent = pass;
  document.getElementById('modal-cred').classList.add('open');
}
function fecharModal(id) { document.getElementById(id).classList.remove('open'); }

// Close overlay when clicking outside
window.addEventListener('click', e => {
  document.querySelectorAll('.modal-overlay').forEach(o => {
    if (e.target === o) o.classList.remove('open');
  });
});

function copyCredentials() {
  const company = document.getElementById('cred-empresa').textContent;
  const user = document.getElementById('cred-user').textContent;
  const pass = document.getElementById('cred-pass').textContent;
  const url = document.getElementById('cred-url').textContent;
  
  const text = `Cliente: ${company}\nUsername (Webhook ID): ${user}\nPassword (Secret): ${pass}\nWebhook Endpoint: ${url}`;
  navigator.clipboard.writeText(text).then(() => alert("Dados de conexão copiados para a área de transferência!"));
}

/* ═════════════════════════════════════════════════════════════
   7. RPA SCHEDULER & REPROCESS EVENT HANDLERS
   ═════════════════════════════════════════════════════════════ */
const MOCK_JOBS_KEY = "op_mock_jobs";

function getMockJobs() {
  return JSON.parse(localStorage.getItem(MOCK_JOBS_KEY)) || [];
}

function saveMockJobs(jobs) {
  localStorage.setItem(MOCK_JOBS_KEY, JSON.stringify(jobs));
}

function executarRpaAgora(rpaId) {
  if (!confirm("Deseja iniciar a execução deste RPA imediatamente?")) return;

  if (isMockMode()) {
    alert("Simulação: Comando de execução imediata registrado com sucesso!");
    return;
  }

  fetch(`/api/rpas/${rpaId}/executar`, { method: 'POST' })
    .then(res => {
      if (res.ok) {
        alert("Comando enviado! O robô iniciará a execução em instantes.");
        go('resultados');
      } else {
        alert("Erro ao enviar comando de execução.");
      }
    })
    .catch(err => {
      console.error("Erro ao disparar RPA agora:", err);
      alert("Erro ao tentar conectar ao servidor.");
    });
}

function abrirModalAgendamentos(rpaId, rpaNome) {
  document.getElementById('m-cron-rpa-id').value = rpaId;
  document.getElementById('m-cron-rpa-nome').textContent = rpaNome;
  document.getElementById('m-cron-expression').value = '';
  document.getElementById('m-cron-status').value = 'ativo';
  
  loadAgendamentos(rpaId);
  document.getElementById('modal-agendamentos').classList.add('open');
}

function loadAgendamentos(rpaId) {
  const container = document.getElementById('cron-list-container');
  container.innerHTML = '<div style="text-align:center; padding:10px; color:var(--color-text-muted);">Carregando agendamentos...</div>';

  if (isMockMode()) {
    const jobs = getMockJobs().filter(j => j.cadastroRpaId === rpaId);
    renderAgendamentosList(jobs);
    return;
  }

  fetch(`/api/jobs-rpa?rpaId=${rpaId}`)
    .antigravityJson()
    .then(jobs => {
      renderAgendamentosList(jobs);
    })
    .catch(err => {
      console.error("Erro ao carregar agendamentos:", err);
      container.innerHTML = '<div style="color:var(--color-danger); text-align:center; padding:10px;">Erro ao carregar agendamentos do servidor.</div>';
    });
}

function renderAgendamentosList(jobs) {
  const container = document.getElementById('cron-list-container');
  container.innerHTML = '';
  
  if (jobs.length === 0) {
    container.innerHTML = '<div style="text-align:center; padding:15px; color:var(--color-text-muted); font-size:var(--fs-sm);">Nenhum agendamento cron configurado para este robô.</div>';
    return;
  }

  jobs.forEach(j => {
    const div = document.createElement('div');
    div.style.display = 'flex';
    div.style.alignItems = 'center';
    div.style.justifyContent = 'space-between';
    div.style.padding = '8px 10px';
    div.style.borderBottom = '1px solid var(--color-border)';
    div.style.fontSize = 'var(--fs-sm)';

    const isAtivo = (j.status === 'ativo' || j.status === 'Ativo');
    const badgeHtml = `<span class="badge ${isAtivo ? 'badge-success' : 'badge-danger'}" style="padding: 2px 6px; font-size: 10px;">${j.status}</span>`;

    div.innerHTML = `
      <div>
        <code style="font-size: 12.5px; font-weight: 600; color: var(--color-primary-light);">${j.cronExpression}</code>
        <span style="margin-left: 8px;">${badgeHtml}</span>
      </div>
      <button class="btn btn-danger-ghost btn-xs" onclick="event.stopPropagation(); deleteCronJob('${j.id}', '${j.cadastroRpaId || j.rpaId}')" style="padding: 3px 6px;"><i class="ti ti-trash"></i></button>
    `;
    container.appendChild(div);
  });
}

function deleteCronJob(jobId, rpaId) {
  if (!confirm("Deseja remover este agendamento cron?")) return;

  if (isMockMode()) {
    const jobs = getMockJobs().filter(j => j.id !== jobId);
    saveMockJobs(jobs);
    loadAgendamentos(rpaId);
    return;
  }

  fetch(`/api/jobs-rpa/${jobId}`, { method: 'DELETE' })
    .then(res => {
      if (res.ok) {
        loadAgendamentos(rpaId);
      } else {
        alert("Erro ao excluir agendamento.");
      }
    })
    .catch(err => {
      console.error("Erro ao deletar job cron:", err);
      alert("Erro de conexão ao excluir agendamento.");
    });
}

function submitCronJob() {
  const rpaId = document.getElementById('m-cron-rpa-id').value;
  const expr = document.getElementById('m-cron-expression').value.trim();
  const status = document.getElementById('m-cron-status').value;

  if (!expr) {
    alert("Por favor, digite uma expressão cron.");
    return;
  }

  if (isMockMode()) {
    const jobs = getMockJobs();
    const newJob = {
      id: "mock-job-" + Date.now(),
      cadastroRpaId: rpaId,
      rpaId: rpaId,
      cronExpression: expr,
      status: status
    };
    jobs.push(newJob);
    saveMockJobs(jobs);
    
    document.getElementById('m-cron-expression').value = '';
    loadAgendamentos(rpaId);
    return;
  }

  fetch('/api/jobs-rpa', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      clientId: session.clientId,
      cadastroRpaId: rpaId,
      cronExpression: expr,
      status: status
    })
  })
  .then(res => {
    if (res.ok) {
      document.getElementById('m-cron-expression').value = '';
      loadAgendamentos(rpaId);
    } else {
      res.json().then(data => {
        alert(data.message || "Erro ao salvar agendamento.");
      }).catch(() => alert("Erro ao salvar agendamento."));
    }
  })
  .catch(err => {
    console.error("Erro ao criar job cron:", err);
    alert("Erro de rede ao salvar agendamento.");
  });
}

function reprocessarSubtasksSelecionadas(taskId, rpaId, caminhoPlanilha) {
  const chks = document.querySelectorAll(`.subtask-reprocess-chk-${taskId}:checked`);
  if (chks.length === 0) {
    alert("Selecione ao menos uma nota com erro ou não encontrada para reprocessar.");
    return;
  }

  const subtaskIds = [];
  const documentos = [];

  chks.forEach(cb => {
    subtaskIds.push(cb.getAttribute('data-subtask-id'));
    documentos.push(cb.getAttribute('data-doc'));
  });

  if (!confirm(`Deseja enviar ${documentos.length} nota(s) para reprocessamento no RPA?`)) return;

  if (isMockMode()) {
    alert(`Simulação: ${documentos.length} notas enviadas para reprocessamento offline!`);
    chks.forEach(cb => { cb.checked = false; });
    return;
  }

  fetch('/api/rpas/reprocessar', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      cadastroRpaId: rpaId,
      taskId: taskId,
      caminhoPlanilha: caminhoPlanilha,
      subtaskIds: subtaskIds,
      documentos: documentos
    })
  })
  .then(res => {
    if (res.ok) {
      alert("Comando de reprocessamento enviado com sucesso! O robô reprocessará estas notas em instantes.");
      chks.forEach(cb => { cb.checked = false; });
      loadExecutions();
    } else {
      alert("Erro ao disparar reprocessamento.");
    }
  })
  .catch(err => {
    console.error("Erro ao enviar reprocessamento:", err);
    alert("Erro de rede ao enviar reprocessamento.");
  });
}
