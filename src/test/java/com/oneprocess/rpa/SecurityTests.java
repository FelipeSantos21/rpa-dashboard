package com.oneprocess.rpa;

import com.oneprocess.rpa.model.CadastroRpa;
import com.oneprocess.rpa.model.Cliente;
import com.oneprocess.rpa.model.UsuarioPerfil;
import com.oneprocess.rpa.repository.CadastroRpaRepository;
import com.oneprocess.rpa.repository.ClienteRepository;
import com.oneprocess.rpa.repository.UsuarioPerfilRepository;
import com.oneprocess.rpa.repository.RpaTaskRepository;
import com.oneprocess.rpa.repository.RpaSubtaskRepository;
import com.oneprocess.rpa.repository.VinculoClienteUsuarioRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;

import java.util.UUID;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
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
public class SecurityTests {

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
    private Cliente cliente;
    private CadastroRpa rpa;

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

        // 1. Seed a test client
        cliente = Cliente.builder()
                .nome("Test Company")
                .razaoSocial("Test Company Ltda")
                .cnpj("00.000.000/0001-00")
                .build();
        cliente = clienteRepository.save(cliente);

        // 2. Seed a test admin profile
        adminUser = UsuarioPerfil.builder()
                .nome("Admin")
                .sobrenome("Test")
                .departamento("IT")
                .username("admintest")
                .role("admin")
                .build();
        adminUser = usuarioPerfilRepository.save(adminUser);

        // 3. Seed the user credentials in auth.users
        String hashedPassword = org.mindrot.jbcrypt.BCrypt.hashpw("secret123", org.mindrot.jbcrypt.BCrypt.gensalt());
        jdbcTemplate.update(
            "INSERT INTO auth.users (id, email, encrypted_password, role, created_at) VALUES (?, ?, ?, ?, NOW())",
            adminUser.getId(), "admin@test.com", hashedPassword, "authenticated"
        );

        // 4. Seed an RPA
        rpa = CadastroRpa.builder()
                .cliente(cliente)
                .nome("RPA Test")
                .identificadorRpa("rpa_test_001")
                .status("Ativo")
                .build();
        rpa = cadastroRpaRepository.save(rpa);
    }

    @Test
    public void testUnauthorizedGetClientes() throws Exception {
        mockMvc.perform(get("/api/clientes")
                .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.message").value("Unauthorized. Valid session token required."));
    }

    @Test
    public void testAuthorizedGetClientes() throws Exception {
        mockMvc.perform(get("/api/clientes")
                .header("Authorization", "Bearer " + adminUser.getId())
                .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].nome").value("Test Company"));
    }

    @Test
    public void testLoginSuccess() throws Exception {
        String loginPayload = "{\"username\":\"admintest\", \"password\":\"secret123\"}";
        mockMvc.perform(post("/api/auth/login")
                .contentType(MediaType.APPLICATION_JSON)
                .content(loginPayload))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.nome").value("Admin"))
                .andExpect(jsonPath("$.role").value("admin"));
    }

    @Test
    public void testLoginFailure() throws Exception {
        String loginPayload = "{\"username\":\"admintest\", \"password\":\"wrongpass\"}";
        mockMvc.perform(post("/api/auth/login")
                .contentType(MediaType.APPLICATION_JSON)
                .content(loginPayload))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.message").value("Usuário ou senha incorretos"));
    }

    @Test
    public void testUnauthorizedWebhook() throws Exception {
        String payload = "{\"id\":\"" + UUID.randomUUID() + "\", \"cadastroRpaId\":\"" + rpa.getId() + "\", \"nome\":\"task.json\", \"status\":\"Processando\"}";
        mockMvc.perform(post("/api/resultados/task")
                .contentType(MediaType.APPLICATION_JSON)
                .content(payload))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.message").value("Invalid or missing robot API key (X-API-KEY or Bearer token)"));
    }

    @Test
    public void testAuthorizedWebhook() throws Exception {
        String payload = "{\"id\":\"" + UUID.randomUUID() + "\", \"cadastroRpaId\":\"" + rpa.getId() + "\", \"nome\":\"task.json\", \"status\":\"Processando\"}";
        mockMvc.perform(post("/api/resultados/task")
                .header("X-API-KEY", "op-robot-secret-2026")
                .contentType(MediaType.APPLICATION_JSON)
                .content(payload))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.nome").value("task.json"))
                .andExpect(jsonPath("$.status").value("Processando"));
    }
}
