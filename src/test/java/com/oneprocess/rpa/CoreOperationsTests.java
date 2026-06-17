package com.oneprocess.rpa;

import com.oneprocess.rpa.model.CadastroRpa;
import com.oneprocess.rpa.model.Cliente;
import com.oneprocess.rpa.model.RpaTask;
import com.oneprocess.rpa.model.UsuarioPerfil;
import com.oneprocess.rpa.repository.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;

import java.util.Arrays;
import java.util.UUID;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest(properties = {
    "spring.datasource.url=jdbc:h2:mem:testdb;MODE=PostgreSQL",
    "spring.datasource.driver-class-name=org.h2.Driver",
    "spring.datasource.username=sa",
    "spring.datasource.password=",
    "spring.jpa.database-platform=org.hibernate.dialect.H2Dialect",
    "spring.jpa.hibernate.ddl-auto=create-drop",
    "spring.sql.init.mode=always"
})
@AutoConfigureMockMvc
public class CoreOperationsTests {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private UsuarioPerfilRepository usuarioPerfilRepository;

    @Autowired
    private ClienteRepository clienteRepository;

    @Autowired
    private CadastroRpaRepository cadastroRpaRepository;

    @Autowired
    private RpaTaskRepository rpaTaskRepository;

    @Autowired
    private RpaSubtaskRepository rpaSubtaskRepository;

    @Autowired
    private VinculoClienteUsuarioRepository vinculoClienteUsuarioRepository;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    private UsuarioPerfil adminUser;
    private Cliente seededCliente;
    private CadastroRpa seededRpa;

    @BeforeEach
    public void setup() {
        // Clear H2 tables in correct constraint order
        rpaSubtaskRepository.deleteAll();
        rpaTaskRepository.deleteAll();
        cadastroRpaRepository.deleteAll();
        vinculoClienteUsuarioRepository.deleteAll();
        usuarioPerfilRepository.deleteAll();
        clienteRepository.deleteAll();
        jdbcTemplate.execute("DELETE FROM auth.users");

        // Seed default admin for headers
        adminUser = UsuarioPerfil.builder()
                .nome("Admin")
                .sobrenome("Test")
                .departamento("IT")
                .username("admin")
                .role("admin")
                .build();
        adminUser = usuarioPerfilRepository.save(adminUser);

        // Seed a default client
        seededCliente = Cliente.builder()
                .nome("Base Company")
                .razaoSocial("Base Company Ltda")
                .cnpj("11.111.111/0001-11")
                .build();
        seededCliente = clienteRepository.save(seededCliente);

        // Seed a default RPA bot
        seededRpa = CadastroRpa.builder()
                .cliente(seededCliente)
                .nome("Base RPA")
                .identificadorRpa("rpa_base_001")
                .status("Ativo")
                .build();
        seededRpa = cadastroRpaRepository.save(seededRpa);
    }

    private String getAuthHeader() {
        return "Bearer " + adminUser.getId();
    }

    // =========================================================================
    // CLIENT OPERATIONS TESTS
    // =========================================================================

    @Test
    public void testCreateClientSuccess() throws Exception {
        String payload = "{" +
                "\"nome\":\"New Client\"," +
                "\"razaoSocial\":\"New Client S.A.\"," +
                "\"cnpj\":\"22.222.222/0001-22\"," +
                "\"responsavel\":\"Jane Manager\"," +
                "\"username\":\"client_new\"," +
                "\"password\":\"pass123\"" +
                "}";

        mockMvc.perform(post("/api/clientes")
                .header("Authorization", getAuthHeader())
                .contentType(MediaType.APPLICATION_JSON)
                .content(payload))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.nome").value("New Client"))
                .andExpect(jsonPath("$.cnpj").value("22.222.222/0001-22"));

        // Verify user profile created
        Optional<UsuarioPerfil> profile = usuarioPerfilRepository.findByUsername("client_new");
        assertTrue(profile.isPresent());
        assertEquals("client", profile.get().getRole());

        // Verify credentials seeded in auth.users
        int count = jdbcTemplate.queryForObject(
            "SELECT count(*) FROM auth.users WHERE id = ?", Integer.class, profile.get().getId()
        );
        assertEquals(1, count);
    }

    @Test
    public void testCreateClientMissingName() throws Exception {
        String payload = "{" +
                "\"razaoSocial\":\"Invalid S.A.\"," +
                "\"cnpj\":\"00.000.000/0001-99\"" +
                "}";

        mockMvc.perform(post("/api/clientes")
                .header("Authorization", getAuthHeader())
                .contentType(MediaType.APPLICATION_JSON)
                .content(payload))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("Nome da empresa é obrigatório"));
    }

    @Test
    public void testDeleteClientSuccess() throws Exception {
        // Create client first
        Cliente c = Cliente.builder().nome("Delete Me").build();
        c = clienteRepository.save(c);

        mockMvc.perform(delete("/api/clientes/" + c.getId())
                .header("Authorization", getAuthHeader()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.message").value("Cliente removido com sucesso"));

        assertFalse(clienteRepository.existsById(c.getId()));
    }

    // =========================================================================
    // RPA CATALOG OPERATIONS TESTS
    // =========================================================================

    @Test
    public void testCreateRpaSuccess() throws Exception {
        String payload = "{" +
                "\"clientId\":\"" + seededCliente.getId() + "\"," +
                "\"nome\":\"Fiscal Auditor\"," +
                "\"identificadorRpa\":\"rpa_fiscal_005\"," +
                "\"descricao\":\"Audits taxes\"," +
                "\"departamento\":\"Finance\"," +
                "\"status\":\"Ativo\"" +
                "}";

        mockMvc.perform(post("/api/rpas")
                .header("Authorization", getAuthHeader())
                .contentType(MediaType.APPLICATION_JSON)
                .content(payload))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.nome").value("Fiscal Auditor"))
                .andExpect(jsonPath("$.identificadorRpa").value("rpa_fiscal_005"));
    }

    @Test
    public void testCreateRpaInvalidClient() throws Exception {
        String payload = "{" +
                "\"clientId\":\"" + UUID.randomUUID() + "\"," +
                "\"nome\":\"Ghost Bot\"," +
                "\"identificadorRpa\":\"rpa_ghost_001\"" +
                "}";

        mockMvc.perform(post("/api/rpas")
                .header("Authorization", getAuthHeader())
                .contentType(MediaType.APPLICATION_JSON)
                .content(payload))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("Cliente inválido"));
    }

    @Test
    public void testConfigureAlertsSuccess() throws Exception {
        String payload = "[\"alert1@test.com\", \"alert2@test.com\"]";

        mockMvc.perform(put("/api/rpas/" + seededRpa.getId() + "/alertas")
                .header("Authorization", getAuthHeader())
                .contentType(MediaType.APPLICATION_JSON)
                .content(payload))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.emailsAlerta[0]").value("alert1@test.com"))
                .andExpect(jsonPath("$.emailsAlerta[1]").value("alert2@test.com"));
    }

    @Test
    public void testConfigureAlertsNotFound() throws Exception {
        String payload = "[\"alert1@test.com\"]";

        mockMvc.perform(put("/api/rpas/" + UUID.randomUUID() + "/alertas")
                .header("Authorization", getAuthHeader())
                .contentType(MediaType.APPLICATION_JSON)
                .content(payload))
                .andExpect(status().isNotFound());
    }

    // =========================================================================
    // TELEMETRY WEBHOOKS & REAL-TIME COUNTER DYNAMICS TESTS
    // =========================================================================

    @Test
    public void testUpsertTaskSuccess() throws Exception {
        UUID taskId = UUID.randomUUID();
        String payload = "{" +
                "\"id\":\"" + taskId + "\"," +
                "\"cadastroRpaId\":\"" + seededRpa.getId() + "\"," +
                "\"nome\":\"batch_execution_01.json\"," +
                "\"caminhoJsonDisco\":\"/data/inputs/batch_execution_01.json\"," +
                "\"status\":\"Processando\"" +
                "}";

        mockMvc.perform(post("/api/resultados/task")
                .header("X-API-KEY", "op-robot-secret-2026")
                .contentType(MediaType.APPLICATION_JSON)
                .content(payload))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(taskId.toString()))
                .andExpect(jsonPath("$.status").value("Processando"));

        assertTrue(rpaTaskRepository.existsById(taskId));
    }

    @Test
    public void testUpsertTaskMissingId() throws Exception {
        String payload = "{" +
                "\"cadastroRpaId\":\"" + seededRpa.getId() + "\"," +
                "\"nome\":\"batch_execution_01.json\"" +
                "}";

        mockMvc.perform(post("/api/resultados/task")
                .header("X-API-KEY", "op-robot-secret-2026")
                .contentType(MediaType.APPLICATION_JSON)
                .content(payload))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("UUID 'id' is required for task idempotency"));
    }

    @Test
    public void testUpsertTaskInvalidRpaId() throws Exception {
        String payload = "{" +
                "\"id\":\"" + UUID.randomUUID() + "\"," +
                "\"cadastroRpaId\":\"" + UUID.randomUUID() + "\"," +
                "\"nome\":\"batch_execution_01.json\"" +
                "}";

        mockMvc.perform(post("/api/resultados/task")
                .header("X-API-KEY", "op-robot-secret-2026")
                .contentType(MediaType.APPLICATION_JSON)
                .content(payload))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("Cadastro RPA ID incorreto"));
    }

    @Test
    public void testUpsertSubtaskSuccessAndCountersUpdate() throws Exception {
        // 1. Initialize parent task
        UUID taskId = UUID.randomUUID();
        String taskPayload = "{" +
                "\"id\":\"" + taskId + "\"," +
                "\"cadastroRpaId\":\"" + seededRpa.getId() + "\"," +
                "\"nome\":\"invoice_batch.json\"," +
                "\"status\":\"Processando\"" +
                "}";

        mockMvc.perform(post("/api/resultados/task")
                .header("X-API-KEY", "op-robot-secret-2026")
                .contentType(MediaType.APPLICATION_JSON)
                .content(taskPayload))
                .andExpect(status().isOk());

        // 2. Stream Subtask 1 (Success)
        UUID subtaskId1 = UUID.randomUUID();
        String subtaskPayload1 = "{" +
                "\"id\":\"" + subtaskId1 + "\"," +
                "\"idTask\":\"" + taskId + "\"," +
                "\"nome\":\"Row 1\"," +
                "\"status\":\"Sucesso\"," +
                "\"numeroDocumento\":\"NF-100\"," +
                "\"valorTotalDocumento\":500.00" +
                "}";

        mockMvc.perform(post("/api/resultados/subtask")
                .header("X-API-KEY", "op-robot-secret-2026")
                .contentType(MediaType.APPLICATION_JSON)
                .content(subtaskPayload1))
                .andExpect(status().isOk());

        // Verify parent task counters: total=1, success=1, error=0
        RpaTask taskState = rpaTaskRepository.findById(taskId).orElseThrow();
        assertEquals(1, taskState.getTotalLinhas());
        assertEquals(1, taskState.getLinhasSucesso());
        assertEquals(0, taskState.getLinhasErro());
        assertEquals("Sucesso", taskState.getStatus());

        // 3. Stream Subtask 2 (Error)
        UUID subtaskId2 = UUID.randomUUID();
        String subtaskPayload2 = "{" +
                "\"id\":\"" + subtaskId2 + "\"," +
                "\"idTask\":\"" + taskId + "\"," +
                "\"nome\":\"Row 2\"," +
                "\"status\":\"Erro\"," +
                "\"numeroDocumento\":\"NF-101\"," +
                "\"valorTotalDocumento\":250.0" +
                "}";

        mockMvc.perform(post("/api/resultados/subtask")
                .header("X-API-KEY", "op-robot-secret-2026")
                .contentType(MediaType.APPLICATION_JSON)
                .content(subtaskPayload2))
                .andExpect(status().isOk());

        // Verify parent task counters: total=2, success=1, error=1
        taskState = rpaTaskRepository.findById(taskId).orElseThrow();
        assertEquals(2, taskState.getTotalLinhas());
        assertEquals(1, taskState.getLinhasSucesso());
        assertEquals(1, taskState.getLinhasErro());
        assertEquals("Erro", taskState.getStatus()); // Error on any row flags task status as Erro

        // 4. Update Subtask 2 to Success (Idempotency resolution correction)
        String subtaskPayload2Updated = "{" +
                "\"id\":\"" + subtaskId2 + "\"," +
                "\"idTask\":\"" + taskId + "\"," +
                "\"nome\":\"Row 2\"," +
                "\"status\":\"Sucesso\"," +
                "\"numeroDocumento\":\"NF-101\"," +
                "\"valorTotalDocumento\":250.0" +
                "}";

        mockMvc.perform(post("/api/resultados/subtask")
                .header("X-API-KEY", "op-robot-secret-2026")
                .contentType(MediaType.APPLICATION_JSON)
                .content(subtaskPayload2Updated))
                .andExpect(status().isOk());

        // Verify parent task counters: total=2, success=2, error=0 (dynamic rollback adjustment!)
        taskState = rpaTaskRepository.findById(taskId).orElseThrow();
        assertEquals(2, taskState.getTotalLinhas());
        assertEquals(2, taskState.getLinhasSucesso());
        assertEquals(0, taskState.getLinhasErro());
        assertEquals("Sucesso", taskState.getStatus());
    }

    @Test
    public void testUpsertSubtaskInvalidTaskId() throws Exception {
        String payload = "{" +
                "\"id\":\"" + UUID.randomUUID() + "\"," +
                "\"idTask\":\"" + UUID.randomUUID() + "\"," +
                "\"nome\":\"Orphan Row\"," +
                "\"status\":\"Sucesso\"" +
                "}";

        mockMvc.perform(post("/api/resultados/subtask")
                .header("X-API-KEY", "op-robot-secret-2026")
                .contentType(MediaType.APPLICATION_JSON)
                .content(payload))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("Task ID de referência não encontrado"));
    }

    // =========================================================================
    // DASHBOARD VIEWS TESTS
    // =========================================================================

    @Test
    public void testAdminDashboardMetrics() throws Exception {
        mockMvc.perform(get("/api/dashboard/admin")
                .header("Authorization", getAuthHeader()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalClientes").value(1))
                .andExpect(jsonPath("$.totalRpas").value(1))
                .andExpect(jsonPath("$.clientStats[0].nome").value("Base Company"));
    }

    @Test
    public void testClientDashboardMetrics() throws Exception {
        mockMvc.perform(get("/api/dashboard/client/" + seededCliente.getId())
                .header("Authorization", getAuthHeader()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalRpas").value(1))
                .andExpect(jsonPath("$.rpas[0].nome").value("Base RPA"));
    }
}
