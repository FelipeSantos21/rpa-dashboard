/* ═════════════════════════════════════════════════════════════
   1. OFFLINE DETECTOR & SESSION MANAGEMENT
   ═════════════════════════════════════════════════════════════ */
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
      { dataExecucao: new Date(Date.now() - 15 * 60000).toISOString(), numeroDocumento: "NF-001023", mensagemOnde: "Erro na validação do CNPJ do fornecedor", status: "Inconsistência", rpaNome: "Leitura Planilha NFe", valor: 340.50, fornecedor: "Papelaria Express", rpaId: "r1111111-1111-1111-1111-111111111111", clientId: "33333333-3333-3333-3333-333333333333" },
      { dataExecucao: new Date(Date.now() - 30 * 60000).toISOString(), numeroDocumento: "BOL-99052", mensagemOnde: "Baixa concluída no ERP corporativo", status: "Sucesso", rpaNome: "Conciliação Bancária", valor: 4500.00, fornecedor: "Banco Itaú S.A.", rpaId: "r3333333-3333-3333-3333-333333333333", clientId: "44444444-4444-4444-4444-444444444444" },
      { dataExecucao: new Date(Date.now() - 45 * 60000).toISOString(), numeroDocumento: "TRK-77401", mensagemOnde: "Status atualizado: Em trânsito para filial", status: "Sucesso", rpaNome: "Monitoramento de Cargas", valor: 0.00, fornecedor: "Transp. Rápido S.A.", rpaId: "r4444444-4444-4444-4444-444444444444", clientId: "55555555-5555-5555-5555-555555555555" },
      { dataExecucao: new Date(Date.now() - 60 * 60000).toISOString(), numeroDocumento: "NF-001022", mensagemOnde: "Falha de conexão com a API do SEFAZ", status: "Erro", rpaNome: "Leitura Planilha NFe", valor: 7890.90, fornecedor: "Vidros Paraná Ltda", rpaId: "r1111111-1111-1111-1111-111111111111", clientId: "33333333-3333-3333-3333-333333333333" }
    ];
    saveMockSubtasks(subtasks);
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
    go('dash-admin');
  } else {
    tb.className = 'topbar-badge tb-client';
    tb.innerHTML = '<i class="ti ti-building"></i> ' + session.companyName;
    btnNovo.style.display = 'none';
    document.getElementById('client-company-sub').textContent = session.companyName + ' — automações multi-tenant';
    go('meus-rpas');
  }
}

// Router config
const SCREEN_TITLES = {
  'dash-admin': ['Dashboard','Visão geral consolidada dos clientes'],
  'clientes':   ['Clientes','Empresas cadastradas no ecossistema'],
  'rpas-admin': ['Catalog RPAs','Parques de robôs cadastrados por cliente'],
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

function go(id) {
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

  // Data fetching routing
  if (id === 'dash-admin') loadAdminDashboard();
  else if (id === 'clientes') loadClientes();
  else if (id === 'rpas-admin') loadRpasAdmin();
  else if (id === 'credenciais') loadCredenciais();
  else if (id === 'meus-rpas') loadClientDashboard();
  else if (id === 'alertas') loadAlertasView();
  else if (id === 'resultados') loadResultadosView();
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
      <td><strong>${r.nome}</strong></td>
      <td><code>${r.identificadorRpa || '—'}</code></td>
      <td><span class="badge badge-info">${r.cliente.nome}</span></td>
      <td>${r.departamento || '—'}</td>
      <td><span class="badge ${r.status === 'Ativo' ? 'badge-success' : (r.status === 'Inativo' ? 'badge-danger' : 'badge-warn')}">${r.status === 'Ativo' ? '<span class="glow-dot"></span>Ativo' : r.status}</span></td>
      <td>
        <button class="btn btn-danger-ghost btn-xs" onclick="deleteRpa('${r.id}')"><i class="ti ti-trash"></i></button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

// ── CREDENTIALS VIEW ──
function loadCredenciais() {
  if (isMockMode()) {
    renderCredenciaisData(getMockClients());
    return;
  }
  fetch('/api/clientes')
    .antigravityJson()
    .then(data => {
      renderCredenciaisData(data);
    })
    .catch(err => {
      console.warn("Failed to fetch credentials. Retrying in mock mode...", err);
      window.useMockMode = true;
      loadCredenciais();
    });
}

function renderCredenciaisData(data) {
  const tbody = document.querySelector('#tbl-credenciais tbody');
  tbody.innerHTML = '';
  data.forEach(c => {
    const user = 'cliente_' + c.nome.toLowerCase().replaceAll(/[^a-z0-9]/g, "");
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><strong>${c.nome}</strong></td>
      <td><code style="background:var(--color-bg-surface-light);padding:2px 8px;border-radius:var(--radius-xs);font-size:var(--fs-sm);">${user}</code></td>
      <td><code style="background:var(--color-bg-surface-light);padding:2px 8px;border-radius:var(--radius-xs);font-size:var(--fs-sm);">abc123</code></td>
      <td>
        <button class="btn btn-ghost btn-xs" onclick="abrirModalCred('${c.nome.replaceAll("'", "\\'")}', '${user}', 'abc123')"><i class="ti ti-send"></i> Mostrar dados de conexão</button>
      </td>
    `;
    tbody.appendChild(tr);
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
        <button class="btn btn-ghost btn-sm" onclick="go('alertas')"><i class="ti ti-bell"></i></button>
        <button class="btn btn-ghost btn-sm" onclick="go('resultados')"><i class="ti ti-chart-bar"></i></button>
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
  const tbody = document.querySelector('#tbl-resultados tbody');
  tbody.innerHTML = '';

  let total = data.length;
  let sucesso = data.filter(s => s.status === 'Sucesso').length;
  let erro = total - sucesso;
  let taxa = total > 0 ? Math.round((sucesso / total) * 100) : 100;

  document.getElementById('res-m-total').textContent = total;
  document.getElementById('res-m-sucesso').textContent = sucesso;
  document.getElementById('res-m-erro').textContent = erro;
  document.getElementById('res-m-taxa').textContent = taxa + '%';

  if (data.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;color:var(--color-text-muted);">Nenhuma execução registrada para os filtros selecionados.</td></tr>`;
    return;
  }

  data.forEach(s => {
    const tr = document.createElement('tr');
    const dtStr = new Date(s.dataExecucao).toLocaleString('pt-BR');
    
    let badge = 'badge-success';
    let icon = 'ti-check';
    if (s.status === 'Erro') { badge = 'badge-warn'; icon = 'ti-clock'; }
    else if (s.status === 'Inconsistência') { badge = 'badge-danger'; icon = 'ti-x'; }

    tr.innerHTML = `
      <td style="color:var(--color-text-muted);">${dtStr}</td>
      <td><span class="badge badge-info">${s.rpaNome}</span></td>
      <td><strong>${s.numeroDocumento}</strong></td>
      <td>${s.mensagemOnde} (Valor: R$ ${s.valor.toFixed(2)} / Forn: ${s.fornecedor})</td>
      <td><span class="badge ${badge}"><i class="ti ${icon}"></i>${s.status}</span></td>
    `;
    tbody.appendChild(tr);
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
  if (status && status !== 'Todos') {
    subtasks = subtasks.filter(s => s.status === status);
  }

  // Sort by execution date descending
  subtasks.sort((a, b) => new Date(b.dataExecucao) - new Date(a.dataExecucao));

  renderExecutionsData(subtasks);
}

/* ═════════════════════════════════════════════════════════════
   5. MUTATION COMMANDS (CRUD SUBMISSIONS)
   ═════════════════════════════════════════════════════════════ */

function submitClient() {
  const nome = document.getElementById('m-cli-nome').value.trim();
  const resp = document.getElementById('m-cli-resp').value.trim();
  const razao = document.getElementById('m-cli-razao').value.trim();
  const cnpj = document.getElementById('m-cli-cnpj').value.trim();
  const user = document.getElementById('m-cli-username').value.trim();
  const pass = document.getElementById('m-cli-password').value.trim();

  if(!nome || !resp || !user || !pass) {
    alert("Por favor, preencha todos os campos obrigatórios (*).");
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
      responsavel: resp,
      username: user,
      password: pass
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
  document.getElementById('m-cli-username').value = '';
  document.getElementById('m-cli-password').value = '';
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
