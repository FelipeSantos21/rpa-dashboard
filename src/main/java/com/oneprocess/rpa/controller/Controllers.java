package com.oneprocess.rpa.controller;

import com.oneprocess.rpa.model.*;
import com.oneprocess.rpa.repository.*;
import lombok.*;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.*;
import java.util.stream.Collectors;

// =========================================================================
// 1. AUTH CONTROLLER
// =========================================================================

@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
@CrossOrigin(origins = "*")
class AuthController {
    private final UsuarioPerfilRepository usuarioPerfilRepository;
    private final VinculoClienteUsuarioRepository vinculoClienteUsuarioRepository;
    private final org.springframework.jdbc.core.JdbcTemplate jdbcTemplate;

    @PostMapping("/login")
    public ResponseEntity<?> login(@RequestBody LoginRequest req) {
        Optional<UsuarioPerfil> userOpt = usuarioPerfilRepository.findByUsername(req.getUsername().trim().toLowerCase());
        if (userOpt.isPresent()) {
            UsuarioPerfil u = userOpt.get();
            try {
                String encryptedPassword = jdbcTemplate.queryForObject(
                    "SELECT encrypted_password FROM auth.users WHERE id = ?",
                    String.class,
                    u.getId()
                );
                if (encryptedPassword != null && org.mindrot.jbcrypt.BCrypt.checkpw(req.getPassword(), encryptedPassword)) {
                    UUID clientId = null;
                    String companyName = null;
                    
                    if ("client".equals(u.getRole())) {
                        List<VinculoClienteUsuario> links = vinculoClienteUsuarioRepository.findByUsuarioId(u.getId());
                        if (!links.isEmpty()) {
                            Cliente c = links.get(0).getCliente();
                            clientId = c.getId();
                            companyName = c.getNome();
                        }
                    }

                    return ResponseEntity.ok(LoginResponse.builder()
                            .id(u.getId())
                            .nome(u.getNome())
                            .sobrenome(u.getSobrenome())
                            .username(u.getUsername())
                            .role(u.getRole())
                            .clientId(clientId)
                            .companyName(companyName)
                            .build());
                }
            } catch (Exception e) {
                // Auth user check failed or not found in auth.users
            }
        }
        return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("message", "Usuário ou senha incorretos"));
    }
}

@Data
@NoArgsConstructor
@AllArgsConstructor
class LoginRequest {
    private String username;
    private String password;
}

@Data
@Builder
class LoginResponse {
    private UUID id;
    private String nome;
    private String sobrenome;
    private String username;
    private String role;
    private UUID clientId;
    private String companyName;
}

// =========================================================================
// 2. DASHBOARD CONTROLLER
// =========================================================================

@RestController
@RequestMapping("/api/dashboard")
@RequiredArgsConstructor
@CrossOrigin(origins = "*")
class DashboardController {
    private final ClienteRepository clienteRepository;
    private final CadastroRpaRepository cadastroRpaRepository;
    private final org.springframework.jdbc.core.JdbcTemplate jdbcTemplate;

    @GetMapping("/admin")
    public ResponseEntity<?> getAdminDashboard() {
        long totalClientes = clienteRepository.count();
        List<CadastroRpa> rpas = cadastroRpaRepository.findAll();
        
        long totalRpas = rpas.size();
        long rpasAtivos = rpas.stream().filter(r -> "Ativo".equalsIgnoreCase(r.getStatus())).count();
        long rpasManutencao = rpas.stream().filter(r -> "Em Manutenção".equalsIgnoreCase(r.getStatus())).count();

        // Calculate per-client stats
        List<ClientStatDto> clientStats = clienteRepository.findAll().stream().map(c -> {
            List<CadastroRpa> clientRpas = rpas.stream()
                    .filter(r -> r.getCliente().getId().equals(c.getId()))
                    .collect(Collectors.toList());
            
            long clientRpaCount = clientRpas.size();
            long executions = 0;
            long totalRows = 0;
            long successRows = 0;

            for (CadastroRpa r : clientRpas) {
                String ident = r.getIdentificadorRpa();
                if (ident == null || ident.trim().isEmpty()) continue;
                String taskTable = ident + "_task";
                try {
                    Integer count = jdbcTemplate.queryForObject("SELECT COUNT(*) FROM " + taskTable, Integer.class);
                    if (count != null) executions += count;
                    
                    Integer sumTotal = jdbcTemplate.queryForObject("SELECT COALESCE(SUM(total_linhas), 0) FROM " + taskTable, Integer.class);
                    if (sumTotal != null) totalRows += sumTotal;
                    
                    Integer sumSuccess = jdbcTemplate.queryForObject("SELECT COALESCE(SUM(linhas_sucesso), 0) FROM " + taskTable, Integer.class);
                    if (sumSuccess != null) successRows += sumSuccess;
                } catch (Exception e) {
                    // Ignore missing tables
                }
            }
            
            int successRate = 100;
            if (totalRows > 0) {
                successRate = (int) Math.round((double) successRows / totalRows * 100);
            }

            boolean hasMaintenance = clientRpas.stream().anyMatch(r -> "Em Manutenção".equalsIgnoreCase(r.getStatus()));
            String status = hasMaintenance ? "Manutenção" : "Ativo";

            return ClientStatDto.builder()
                    .id(c.getId())
                    .nome(c.getNome())
                    .username("cliente_" + c.getNome().toLowerCase().replaceAll("[^a-z0-9]", ""))
                    .rpaCount(clientRpaCount)
                    .executions(executions)
                    .successRate(successRate)
                    .status(status)
                    .build();
        }).collect(Collectors.toList());

        return ResponseEntity.ok(Map.of(
            "totalClientes", totalClientes,
            "totalRpas", totalRpas,
            "rpasAtivos", rpasAtivos,
            "rpasManutencao", rpasManutencao,
            "clientStats", clientStats
        ));
    }

    @GetMapping("/client/{clientId}")
    public ResponseEntity<?> getClientDashboard(@PathVariable UUID clientId) {
        List<CadastroRpa> rpas = cadastroRpaRepository.findByClienteId(clientId);
        long totalRpas = rpas.size();
        long rpasAtivos = rpas.stream().filter(r -> "Ativo".equalsIgnoreCase(r.getStatus())).count();
        long rpasManutencao = rpas.stream().filter(r -> "Em Manutenção".equalsIgnoreCase(r.getStatus())).count();
        long rpasInativos = rpas.stream().filter(r -> "Inativo".equalsIgnoreCase(r.getStatus())).count();

        return ResponseEntity.ok(Map.of(
            "totalRpas", totalRpas,
            "rpasAtivos", rpasAtivos,
            "rpasManutencao", rpasManutencao,
            "rpasInativos", rpasInativos,
            "rpas", rpas
        ));
    }
}

@Data
@Builder
class ClientStatDto {
    private UUID id;
    private String nome;
    private String username;
    private long rpaCount;
    private long executions;
    private int successRate;
    private String status;
}

// =========================================================================
// 3. CLIENTE CONTROLLER
// =========================================================================

@RestController
@RequestMapping("/api/clientes")
@RequiredArgsConstructor
@CrossOrigin(origins = "*")
class ClienteController {
    private final ClienteRepository clienteRepository;
    private final UsuarioPerfilRepository usuarioPerfilRepository;
    private final VinculoClienteUsuarioRepository vinculoClienteUsuarioRepository;
    private final org.springframework.jdbc.core.JdbcTemplate jdbcTemplate;

    @GetMapping
    public List<Cliente> getAll() {
        return clienteRepository.findAll();
    }

    @PostMapping
    public ResponseEntity<?> create(@RequestBody CreateClientRequest req) {
        if (req.getNome() == null || req.getNome().trim().isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("message", "Nome da empresa é obrigatório"));
        }

        String username = null;
        if (req.getUsername() != null && !req.getUsername().trim().isEmpty()) {
            username = req.getUsername().trim().toLowerCase();
            if (usuarioPerfilRepository.findByUsername(username).isPresent()) {
                return ResponseEntity.badRequest().body(Map.of("message", "O nome de usuário '" + username + "' já está em uso."));
            }
        }

        String cnpj = req.getCnpj();
        if (cnpj != null && cnpj.trim().isEmpty()) {
            cnpj = null;
        }

        String razaoSocial = req.getRazaoSocial();
        if (razaoSocial != null && razaoSocial.trim().isEmpty()) {
            razaoSocial = null;
        }

        Cliente c = Cliente.builder()
                .nome(req.getNome())
                .razaoSocial(razaoSocial)
                .cnpj(cnpj)
                .build();
        c = clienteRepository.save(c);

        if (username != null) {
            UUID newUserId = UUID.randomUUID();
            
            String rawPassword = req.getPassword() != null ? req.getPassword() : "123456";
            String encryptedPassword = org.mindrot.jbcrypt.BCrypt.hashpw(rawPassword, org.mindrot.jbcrypt.BCrypt.gensalt());
            String email = username + "@oneprocess.com";
            
            // Clean up any orphaned credentials for this email before inserting (avoids conflict from prior failed attempts)
            jdbcTemplate.update("DELETE FROM auth.users WHERE email = ?", email);

            // 1. Insert credentials in auth.users first to satisfy foreign key constraint on usuario_perfil(id)
            jdbcTemplate.update(
                "INSERT INTO auth.users (id, email, encrypted_password, role, created_at) VALUES (?, ?, ?, ?, NOW())",
                newUserId, email, encryptedPassword, "authenticated"
            );

            // 2. Insert profile using the exact same ID
            UsuarioPerfil u = UsuarioPerfil.builder()
                    .id(newUserId)
                    .nome(req.getResponsavel() != null ? req.getResponsavel() : req.getNome())
                    .sobrenome("Contato")
                    .departamento("Geral")
                    .username(username)
                    .role("client")
                    .build();
            u = usuarioPerfilRepository.save(u);

            // 3. Create the client-user tenant binding
            vinculoClienteUsuarioRepository.save(VinculoClienteUsuario.builder()
                    .cliente(c)
                    .usuario(u)
                    .build());
        }

        return ResponseEntity.status(HttpStatus.CREATED).body(c);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<?> delete(@PathVariable UUID id) {
        List<VinculoClienteUsuario> links = vinculoClienteUsuarioRepository.findByClienteId(id);
        for (VinculoClienteUsuario link : links) {
            vinculoClienteUsuarioRepository.delete(link);
            usuarioPerfilRepository.delete(link.getUsuario());
            try {
                jdbcTemplate.update("DELETE FROM auth.users WHERE id = ?", link.getUsuario().getId());
            } catch (Exception e) {
                // Ignore if not present
            }
        }
        clienteRepository.deleteById(id);
        return ResponseEntity.ok(Map.of("message", "Cliente removido com sucesso"));
    }
}

// =========================================================================
// 3.5. USUARIO CONTROLLER
// =========================================================================

@RestController
@RequestMapping("/api/usuarios")
@RequiredArgsConstructor
@CrossOrigin(origins = "*")
class UsuarioController {
    private final UsuarioPerfilRepository usuarioPerfilRepository;
    private final VinculoClienteUsuarioRepository vinculoClienteUsuarioRepository;
    private final ClienteRepository clienteRepository;
    private final org.springframework.jdbc.core.JdbcTemplate jdbcTemplate;

    @GetMapping
    public List<Map<String, Object>> getAll() {
        List<UsuarioPerfil> perfis = usuarioPerfilRepository.findAll();
        List<Map<String, Object>> res = new ArrayList<>();
        
        for (UsuarioPerfil u : perfis) {
            Map<String, Object> map = new HashMap<>();
            map.put("id", u.getId());
            map.put("nome", u.getNome());
            map.put("sobrenome", u.getSobrenome());
            map.put("departamento", u.getDepartamento());
            map.put("username", u.getUsername());
            map.put("role", u.getRole());
            map.put("criadoEm", u.getCriadoEm());
            
            // Get linked clients
            List<VinculoClienteUsuario> vinculos = vinculoClienteUsuarioRepository.findByUsuario(u);
            List<Map<String, Object>> clientes = new ArrayList<>();
            for (VinculoClienteUsuario v : vinculos) {
                Map<String, Object> cliMap = new HashMap<>();
                cliMap.put("id", v.getCliente().getId());
                cliMap.put("nome", v.getCliente().getNome());
                clientes.add(cliMap);
            }
            map.put("clientes", clientes);
            res.add(map);
        }
        return res;
    }

    @PostMapping
    public ResponseEntity<?> create(@RequestBody CreateUserRequest req) {
        if (req.getUsername() == null || req.getUsername().trim().isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("message", "Username é obrigatório"));
        }
        if (req.getNome() == null || req.getNome().trim().isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("message", "Nome é obrigatório"));
        }
        
        String username = req.getUsername().trim().toLowerCase();
        if (usuarioPerfilRepository.findByUsername(username).isPresent()) {
            return ResponseEntity.badRequest().body(Map.of("message", "O nome de usuário '" + username + "' já está em uso."));
        }

        UUID newUserId = UUID.randomUUID();
        String rawPassword = req.getPassword() != null ? req.getPassword() : "123456";
        String encryptedPassword = org.mindrot.jbcrypt.BCrypt.hashpw(rawPassword, org.mindrot.jbcrypt.BCrypt.gensalt());
        String email = username + "@oneprocess.com";

        // Clean up any orphans
        jdbcTemplate.update("DELETE FROM auth.users WHERE email = ?", email);

        // 1. auth.users
        jdbcTemplate.update(
            "INSERT INTO auth.users (id, email, encrypted_password, role, created_at) VALUES (?, ?, ?, ?, NOW())",
            newUserId, email, encryptedPassword, "authenticated"
        );

        // 2. usuario_perfil
        UsuarioPerfil u = UsuarioPerfil.builder()
                .id(newUserId)
                .nome(req.getNome())
                .sobrenome(req.getSobrenome())
                .departamento(req.getDepartamento())
                .username(username)
                .role(req.getRole() != null ? req.getRole() : "client")
                .build();
        u = usuarioPerfilRepository.save(u);

        return ResponseEntity.status(HttpStatus.CREATED).body(u);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<?> delete(@PathVariable UUID id) {
        UsuarioPerfil u = usuarioPerfilRepository.findById(id).orElse(null);
        if (u == null) {
            return ResponseEntity.notFound().build();
        }

        // Delete links
        List<VinculoClienteUsuario> links = vinculoClienteUsuarioRepository.findByUsuario(u);
        for (VinculoClienteUsuario link : links) {
            vinculoClienteUsuarioRepository.delete(link);
        }

        // Delete profile
        usuarioPerfilRepository.delete(u);

        // Delete credentials
        try {
            jdbcTemplate.update("DELETE FROM auth.users WHERE id = ?", id);
        } catch (Exception e) {
            // ignore
        }

        return ResponseEntity.ok(Map.of("message", "Usuário removido com sucesso"));
    }

    @PostMapping("/{id}/vinculos")
    public ResponseEntity<?> updateVinculos(@PathVariable UUID id, @RequestBody List<UUID> clientIds) {
        UsuarioPerfil u = usuarioPerfilRepository.findById(id).orElse(null);
        if (u == null) {
            return ResponseEntity.notFound().build();
        }

        // 1. Delete existing links
        List<VinculoClienteUsuario> existing = vinculoClienteUsuarioRepository.findByUsuario(u);
        for (VinculoClienteUsuario v : existing) {
            vinculoClienteUsuarioRepository.delete(v);
        }

        // 2. Create new links
        if (clientIds != null) {
            for (UUID cid : clientIds) {
                Cliente c = clienteRepository.findById(cid).orElse(null);
                if (c != null) {
                    vinculoClienteUsuarioRepository.save(VinculoClienteUsuario.builder()
                            .cliente(c)
                            .usuario(u)
                            .build());
                }
            }
        }

        return ResponseEntity.ok(Map.of("message", "Vínculos atualizados com sucesso"));
    }
}

@Data
class CreateUserRequest {
    private String username;
    private String password;
    private String nome;
    private String sobrenome;
    private String departamento;
    private String role;
}


@Data
class CreateClientRequest {
    private String nome;
    private String razaoSocial;
    private String cnpj;
    private String responsavel;
    private String username;
    private String password;
}

// =========================================================================
// 4. RPA CONTROLLER
// =========================================================================

@RestController
@RequestMapping("/api/rpas")
@RequiredArgsConstructor
@CrossOrigin(origins = "*")
class RpaController {
    private final CadastroRpaRepository cadastroRpaRepository;
    private final ClienteRepository clienteRepository;

    @GetMapping
    public List<CadastroRpa> getAll(@RequestParam(required = false) UUID clientId) {
        if (clientId != null) {
            return cadastroRpaRepository.findByClienteId(clientId);
        }
        return cadastroRpaRepository.findAll();
    }

    @PostMapping
    public ResponseEntity<?> create(@RequestBody CreateRpaRequest req) {
        Optional<Cliente> clientOpt = clienteRepository.findById(req.getClientId());
        if (clientOpt.isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("message", "Cliente inválido"));
        }

        CadastroRpa rpa = CadastroRpa.builder()
                .cliente(clientOpt.get())
                .nome(req.getNome())
                .identificadorRpa(req.getIdentificadorRpa())
                .descricao(req.getDescricao())
                .departamento(req.getDepartamento())
                .status(req.getStatus() != null ? req.getStatus() : "Ativo")
                .regras(req.getRegras())
                .riscos(req.getRiscos())
                .emailsAlerta(req.getEmailsAlerta() != null ? req.getEmailsAlerta() : new ArrayList<>())
                .build();

        rpa = cadastroRpaRepository.save(rpa);
        return ResponseEntity.status(HttpStatus.CREATED).body(rpa);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<?> delete(@PathVariable UUID id) {
        cadastroRpaRepository.deleteById(id);
        return ResponseEntity.ok(Map.of("message", "RPA catalog removido com sucesso"));
    }

    @PutMapping("/{id}/alertas")
    public ResponseEntity<?> configureAlerts(@PathVariable UUID id, @RequestBody List<String> emails) {
        Optional<CadastroRpa> rpaOpt = cadastroRpaRepository.findById(id);
        if (rpaOpt.isEmpty()) {
            return ResponseEntity.notFound().build();
        }
        CadastroRpa rpa = rpaOpt.get();
        rpa.setEmailsAlerta(emails);
        rpa = cadastroRpaRepository.save(rpa);
        return ResponseEntity.ok(rpa);
    }
}

@Data
class CreateRpaRequest {
    private UUID clientId;
    private String nome;
    private String identificadorRpa;
    private String descricao;
    private String departamento;
    private String status;
    private String regras;
    private String riscos;
    private List<String> emailsAlerta;
}

// =========================================================================
// 5. TELEMETRY / WEBHOOK / RESULTS CONTROLLER
// =========================================================================

@RestController
@RequestMapping("/api/resultados")
@RequiredArgsConstructor
@CrossOrigin(origins = "*")
public class Controllers { // Outer wrapper named Controllers to match the filename, containing the remaining endpoints
    private final RpaTaskRepository rpaTaskRepository;
    private final RpaSubtaskRepository rpaSubtaskRepository;
    private final CadastroRpaRepository cadastroRpaRepository;
    private final org.springframework.jdbc.core.JdbcTemplate jdbcTemplate;

    private void checkAndCreateTables(String ident) {
        String taskTable = ident + "_task";
        String subtaskTable = ident + "_subtask";
        try {
            jdbcTemplate.execute("CREATE TABLE IF NOT EXISTS " + taskTable + " (" +
                "id UUID PRIMARY KEY, " +
                "id_cadastro_rpa UUID, " +
                "nome VARCHAR(255) NOT NULL, " +
                "caminho_json_disco VARCHAR(512), " +
                "timestamp_inicio TIMESTAMP WITH TIME ZONE DEFAULT NOW(), " +
                "timestamp_fim TIMESTAMP WITH TIME ZONE, " +
                "status VARCHAR(50) DEFAULT 'Processando', " +
                "msg_erro TEXT, " +
                "total_linhas INT DEFAULT 0, " +
                "linhas_sucesso INT DEFAULT 0, " +
                "linhas_erro INT DEFAULT 0, " +
                "linhas_nao_encontrado INT DEFAULT 0, " +
                "criado_em TIMESTAMP WITH TIME ZONE DEFAULT NOW()" +
                ")");
                
            jdbcTemplate.execute("CREATE TABLE IF NOT EXISTS " + subtaskTable + " (" +
                "id UUID PRIMARY KEY, " +
                "id_task UUID REFERENCES " + taskTable + "(id) ON DELETE CASCADE, " +
                "nome VARCHAR(255), " +
                "status VARCHAR(50) NOT NULL, " +
                "msg_erro TEXT, " +
                "numero_documento VARCHAR(50), " +
                "serie_documento VARCHAR(20), " +
                "data_emissao DATE, " +
                "valor_total_documento NUMERIC(15, 2), " +
                "codigo_fornecedor VARCHAR(50), " +
                "nome_fornecedor VARCHAR(255), " +
                "criado_em TIMESTAMP WITH TIME ZONE DEFAULT NOW()" +
                ")");
        } catch (Exception e) {
            System.err.println("Error creating dynamic tables: " + e.getMessage());
        }
    }

    private Object getValue(Map<String, Object> map, String... keys) {
        for (String key : keys) {
            if (map.containsKey(key)) return map.get(key);
            if (map.containsKey(key.toLowerCase())) return map.get(key.toLowerCase());
            if (map.containsKey(key.toUpperCase())) return map.get(key.toUpperCase());
        }
        return null;
    }

    private UUID toUUID(Object obj) {
        if (obj == null) return null;
        if (obj instanceof UUID) return (UUID) obj;
        return UUID.fromString(obj.toString());
    }

    private OffsetDateTime toOffsetDateTime(Object obj) {
        if (obj == null) return OffsetDateTime.MIN;
        if (obj instanceof OffsetDateTime) return (OffsetDateTime) obj;
        if (obj instanceof java.sql.Timestamp) {
            return ((java.sql.Timestamp) obj).toInstant().atZone(java.time.ZoneId.systemDefault()).toOffsetDateTime();
        }
        if (obj instanceof java.time.LocalDateTime) {
            return ((java.time.LocalDateTime) obj).atZone(java.time.ZoneId.systemDefault()).toOffsetDateTime();
        }
        try {
            return OffsetDateTime.parse(obj.toString());
        } catch (Exception e) {
            return OffsetDateTime.MIN;
        }
    }

    private Map<String, Object> getDynamicTaskById(String ident, UUID taskId) {
        String taskTable = ident + "_task";
        try {
            List<Map<String, Object>> rows = jdbcTemplate.queryForList("SELECT * FROM " + taskTable + " WHERE id = ?", taskId);
            if (rows.isEmpty()) return null;
            Map<String, Object> row = rows.get(0);
            Map<String, Object> taskMap = new HashMap<>();
            taskMap.put("id", getValue(row, "id"));
            taskMap.put("nome", getValue(row, "nome"));
            taskMap.put("caminhoJsonDisco", getValue(row, "caminho_json_disco", "caminhoJsonDisco"));
            taskMap.put("timestampInicio", getValue(row, "timestamp_inicio", "timestampInicio"));
            taskMap.put("timestampFim", getValue(row, "timestamp_fim", "timestampFim"));
            taskMap.put("status", getValue(row, "status"));
            taskMap.put("msgErro", getValue(row, "msg_erro", "msgErro"));
            taskMap.put("totalLinhas", getValue(row, "total_linhas", "totalLinhas"));
            taskMap.put("linhasSucesso", getValue(row, "linhas_sucesso", "linhasSucesso"));
            taskMap.put("linhasErro", getValue(row, "linhas_erro", "linhasErro"));
            taskMap.put("linhasNaoEncontrado", getValue(row, "linhas_nao_encontrado", "linhasNaoEncontrado"));
            return taskMap;
        } catch (Exception e) {
            return null;
        }
    }

    @GetMapping
    public List<?> getResultados(@RequestParam(required = false) UUID clientId,
                                @RequestParam(required = false) UUID rpaId,
                                @RequestParam(required = false) String status) {
        List<CadastroRpa> rpas;
        if (rpaId != null) {
            rpas = cadastroRpaRepository.findById(rpaId).map(List::of).orElse(List.of());
        } else if (clientId != null) {
            rpas = cadastroRpaRepository.findByClienteId(clientId);
        } else {
            rpas = cadastroRpaRepository.findAll();
        }

        List<Map<String, Object>> allTasks = new ArrayList<>();
        for (CadastroRpa rpa : rpas) {
            String ident = rpa.getIdentificadorRpa();
            if (ident == null || ident.trim().isEmpty()) continue;
            checkAndCreateTables(ident);
            
            String taskTable = ident + "_task";
            String subtaskTable = ident + "_subtask";
            try {
                List<Map<String, Object>> taskRows = jdbcTemplate.queryForList("SELECT * FROM " + taskTable);
                for (Map<String, Object> row : taskRows) {
                    Map<String, Object> taskMap = new HashMap<>();
                    UUID taskId = toUUID(getValue(row, "id"));
                    taskMap.put("id", taskId);
                    taskMap.put("nome", getValue(row, "nome"));
                    taskMap.put("caminhoJsonDisco", getValue(row, "caminho_json_disco", "caminhoJsonDisco"));
                    taskMap.put("timestampInicio", getValue(row, "timestamp_inicio", "timestampInicio"));
                    taskMap.put("timestampFim", getValue(row, "timestamp_fim", "timestampFim"));
                    taskMap.put("status", getValue(row, "status"));
                    taskMap.put("msgErro", getValue(row, "msg_erro", "msgErro"));
                    taskMap.put("totalLinhas", getValue(row, "total_linhas", "totalLinhas"));
                    taskMap.put("linhasSucesso", getValue(row, "linhas_sucesso", "linhasSucesso"));
                    taskMap.put("linhasErro", getValue(row, "linhas_erro", "linhasErro"));
                    taskMap.put("linhasNaoEncontrado", getValue(row, "linhas_nao_encontrado", "linhasNaoEncontrado"));
                    taskMap.put("rpaNome", rpa.getNome());
                    taskMap.put("cadastroRpaId", rpa.getId());
                    
                    // Fetch subtasks
                    List<Map<String, Object>> subRows = jdbcTemplate.queryForList("SELECT * FROM " + subtaskTable + " WHERE id_task = ?", taskId);
                    List<Map<String, Object>> subtasksList = new ArrayList<>();
                    for (Map<String, Object> subRow : subRows) {
                        Map<String, Object> subMap = new HashMap<>();
                        subMap.put("id", toUUID(getValue(subRow, "id")));
                        subMap.put("nome", getValue(subRow, "nome"));
                        subMap.put("status", getValue(subRow, "status"));
                        subMap.put("msgErro", getValue(subRow, "msg_erro", "msgErro"));
                        subMap.put("numeroDocumento", getValue(subRow, "numero_documento", "numeroDocumento"));
                        subMap.put("serieDocumento", getValue(subRow, "serie_documento", "serieDocumento"));
                        subMap.put("dataEmissao", getValue(subRow, "data_emissao", "dataEmissao"));
                        subMap.put("valorTotalDocumento", getValue(subRow, "valor_total_documento", "valorTotalDocumento"));
                        subMap.put("codigoFornecedor", getValue(subRow, "codigo_fornecedor", "codigoFornecedor"));
                        subMap.put("nomeFornecedor", getValue(subRow, "nome_fornecedor", "nomeFornecedor"));
                        subtasksList.add(subMap);
                    }
                    taskMap.put("subtasks", subtasksList);
                    allTasks.add(taskMap);
                }
            } catch (Exception e) {
                System.err.println("Error fetching results for " + ident + ": " + e.getMessage());
            }
        }

        return allTasks.stream()
            .filter(t -> status == null || "Todos".equalsIgnoreCase(status) || status.equalsIgnoreCase((String) t.get("status")))
            .sorted((a, b) -> toOffsetDateTime(b.get("timestampInicio")).compareTo(toOffsetDateTime(a.get("timestampInicio"))))
            .collect(Collectors.toList());
    }

    @PostMapping("/task")
    public ResponseEntity<?> upsertTask(@RequestBody CreateTaskRequest req) {
        if (req.getId() == null) {
            return ResponseEntity.badRequest().body(Map.of("message", "UUID 'id' is required for task idempotency"));
        }

        Optional<CadastroRpa> rpaOpt = cadastroRpaRepository.findById(req.getCadastroRpaId());
        if (rpaOpt.isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("message", "Cadastro RPA ID incorreto"));
        }

        CadastroRpa rpa = rpaOpt.get();
        String ident = rpa.getIdentificadorRpa();
        if (ident == null || ident.trim().isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("message", "Identificador RPA não cadastrado"));
        }

        checkAndCreateTables(ident);
        String taskTable = ident + "_task";

        String countQuery = "SELECT COUNT(*) FROM " + taskTable + " WHERE id = ?";
        Integer count = jdbcTemplate.queryForObject(countQuery, Integer.class, req.getId());

        if (count != null && count > 0) {
            String updateQuery = "UPDATE " + taskTable + " SET nome = ?, caminho_json_disco = ?, status = ?, msg_erro = ?, timestamp_fim = ? WHERE id = ?";
            jdbcTemplate.update(updateQuery, req.getNome(), req.getCaminhoJsonDisco(), req.getStatus() != null ? req.getStatus() : "Processando", req.getMsgErro(), req.getTimestampFim(), req.getId());
        } else {
            String insertQuery = "INSERT INTO " + taskTable + " (id, id_cadastro_rpa, nome, caminho_json_disco, status, msg_erro, total_linhas, linhas_sucesso, linhas_erro, linhas_nao_encontrado, timestamp_inicio) VALUES (?, ?, ?, ?, ?, ?, 0, 0, 0, 0, ?)";
            jdbcTemplate.update(insertQuery, req.getId(), req.getCadastroRpaId(), req.getNome(), req.getCaminhoJsonDisco(), req.getStatus() != null ? req.getStatus() : "Processando", req.getMsgErro(), OffsetDateTime.now());
        }

        Map<String, Object> taskMap = getDynamicTaskById(ident, req.getId());
        return ResponseEntity.ok(taskMap);
    }

    @PostMapping("/subtask")
    public ResponseEntity<?> upsertSubtask(@RequestBody CreateSubtaskRequest req) {
        if (req.getId() == null) {
            return ResponseEntity.badRequest().body(Map.of("message", "UUID 'id' is required for subtask idempotency"));
        }

        CadastroRpa matchedRpa = null;
        List<CadastroRpa> rpas = cadastroRpaRepository.findAll();
        for (CadastroRpa rpa : rpas) {
            String ident = rpa.getIdentificadorRpa();
            if (ident == null || ident.trim().isEmpty()) continue;
            checkAndCreateTables(ident);
            String taskTable = ident + "_task";
            String checkQuery = "SELECT COUNT(*) FROM " + taskTable + " WHERE id = ?";
            try {
                Integer count = jdbcTemplate.queryForObject(checkQuery, Integer.class, req.getIdTask());
                if (count != null && count > 0) {
                    matchedRpa = rpa;
                    break;
                }
            } catch (Exception e) {
                // Ignore table errors
            }
        }

        if (matchedRpa == null) {
            return ResponseEntity.badRequest().body(Map.of("message", "Task ID de referência não encontrado"));
        }

        String ident = matchedRpa.getIdentificadorRpa();
        String taskTable = ident + "_task";
        String subtaskTable = ident + "_subtask";

        String subCheckQuery = "SELECT status FROM " + subtaskTable + " WHERE id = ?";
        List<String> statuses = jdbcTemplate.query(subCheckQuery, (rs, rowNum) -> rs.getString(1), req.getId());
        boolean isNew = statuses.isEmpty();
        String oldStatus = isNew ? null : statuses.get(0);

        if (isNew) {
            String subInsert = "INSERT INTO " + subtaskTable + " (id, id_task, nome, status, msg_erro, numero_documento, serie_documento, data_emissao, valor_total_documento, codigo_fornecedor, nome_fornecedor, criado_em) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)";
            jdbcTemplate.update(subInsert, req.getId(), req.getIdTask(), req.getNome(), req.getStatus(), req.getMsgErro(), req.getNumeroDocumento(), req.getSerieDocumento(), req.getDataEmissao(), req.getValorTotalDocumento(), req.getCodigoFornecedor(), req.getNomeFornecedor(), OffsetDateTime.now());
        } else {
            String subUpdate = "UPDATE " + subtaskTable + " SET nome = ?, status = ?, msg_erro = ?, numero_documento = ?, serie_documento = ?, data_emissao = ?, valor_total_documento = ?, codigo_fornecedor = ?, nome_fornecedor = ? WHERE id = ?";
            jdbcTemplate.update(subUpdate, req.getNome(), req.getStatus(), req.getMsgErro(), req.getNumeroDocumento(), req.getSerieDocumento(), req.getDataEmissao(), req.getValorTotalDocumento(), req.getCodigoFornecedor(), req.getNomeFornecedor(), req.getId());
        }

        // Update task counters
        String countersQuery = "SELECT total_linhas, linhas_sucesso, linhas_erro, linhas_nao_encontrado FROM " + taskTable + " WHERE id = ?";
        Map<String, Object> countersRow = jdbcTemplate.queryForMap(countersQuery, req.getIdTask());
        int totalLinhas = ((Number) getValue(countersRow, "total_linhas")).intValue();
        int linhasSucesso = ((Number) getValue(countersRow, "linhas_sucesso")).intValue();
        int linhasErro = ((Number) getValue(countersRow, "linhas_erro")).intValue();
        int linhasNaoEncontrado = ((Number) getValue(countersRow, "linhas_nao_encontrado")).intValue();

        if (isNew) {
            totalLinhas += 1;
            if ("Sucesso".equalsIgnoreCase(req.getStatus())) {
                linhasSucesso += 1;
            } else if ("Não Encontrado".equalsIgnoreCase(req.getStatus())) {
                linhasNaoEncontrado += 1;
            } else {
                linhasErro += 1;
            }
        } else {
            if (!req.getStatus().equalsIgnoreCase(oldStatus)) {
                // Decrement old counter
                if ("Sucesso".equalsIgnoreCase(oldStatus)) {
                    linhasSucesso = Math.max(0, linhasSucesso - 1);
                } else if ("Não Encontrado".equalsIgnoreCase(oldStatus)) {
                    linhasNaoEncontrado = Math.max(0, linhasNaoEncontrado - 1);
                } else {
                    linhasErro = Math.max(0, linhasErro - 1);
                }
                
                // Increment new counter
                if ("Sucesso".equalsIgnoreCase(req.getStatus())) {
                    linhasSucesso += 1;
                } else if ("Não Encontrado".equalsIgnoreCase(req.getStatus())) {
                    linhasNaoEncontrado += 1;
                } else {
                    linhasErro += 1;
                }
            }
        }

        String parentStatus;
        if (linhasErro > 0) {
            parentStatus = "Erro";
        } else if (linhasNaoEncontrado > 0) {
            parentStatus = "Não Encontrado";
        } else {
            parentStatus = "Sucesso";
        }

        String parentUpdate = "UPDATE " + taskTable + " SET total_linhas = ?, linhas_sucesso = ?, linhas_erro = ?, linhas_nao_encontrado = ?, status = ?, timestamp_fim = ? WHERE id = ?";
        jdbcTemplate.update(parentUpdate, totalLinhas, linhasSucesso, linhasErro, linhasNaoEncontrado, parentStatus, OffsetDateTime.now(), req.getIdTask());

        List<Map<String, Object>> subRows = jdbcTemplate.queryForList("SELECT * FROM " + subtaskTable + " WHERE id = ?", req.getId());
        return ResponseEntity.ok(subRows.isEmpty() ? Map.of() : subRows.get(0));
    }
}

@Data
class CreateTaskRequest {
    private UUID id;
    private UUID cadastroRpaId;
    private String nome;
    private String caminhoJsonDisco;
    private String status;
    private String msgErro;
    private OffsetDateTime timestampFim;
}

@Data
class CreateSubtaskRequest {
    private UUID id;
    private UUID idTask;
    private String nome;
    private String status;
    private String msgErro;
    private String numeroDocumento;
    private String serieDocumento;
    private LocalDate dataEmissao;
    private BigDecimal valorTotalDocumento;
    private String codigoFornecedor;
    private String nomeFornecedor;
}

@RestController
@RequestMapping("/api")
@RequiredArgsConstructor
@CrossOrigin(origins = "*")
class RpaSchedulerApiController {
    private final JobsRpaRepository jobsRpaRepository;
    private final RpaExecucaoFilaRepository rpaExecucaoFilaRepository;
    private final ClienteRepository clienteRepository;
    private final CadastroRpaRepository cadastroRpaRepository;
    private final org.springframework.jdbc.core.JdbcTemplate jdbcTemplate;

    @GetMapping("/jobs-rpa")
    public List<JobsRpa> getJobs(@RequestParam(required = false) UUID clientId, @RequestParam(required = false) UUID rpaId) {
        if (rpaId != null) {
            return jobsRpaRepository.findByCadastroRpaId(rpaId);
        }
        if (clientId != null) {
            return jobsRpaRepository.findByClienteId(clientId);
        }
        return jobsRpaRepository.findAll();
    }

    @PostMapping("/jobs-rpa")
    public ResponseEntity<?> saveJob(@RequestBody CreateJobRpaRequest req) {
        Cliente cliente = clienteRepository.findById(req.getClientId()).orElse(null);
        CadastroRpa rpa = cadastroRpaRepository.findById(req.getCadastroRpaId()).orElse(null);
        
        if (cliente == null || rpa == null) {
            return ResponseEntity.badRequest().body(Map.of("message", "Cliente ou RPA inválido"));
        }

        JobsRpa job;
        if (req.getId() != null) {
            job = jobsRpaRepository.findById(req.getId()).orElse(new JobsRpa());
        } else {
            job = new JobsRpa();
        }

        job.setCliente(cliente);
        job.setCadastroRpa(rpa);
        job.setCronExpression(req.getCronExpression());
        job.setStatus(req.getStatus() != null ? req.getStatus() : "ativo");
        job.setAtualizadoEm(OffsetDateTime.now());
        
        if (job.getId() == null) {
            job.setCriadoEm(OffsetDateTime.now());
        }

        job = jobsRpaRepository.save(job);
        return ResponseEntity.ok(job);
    }

    @DeleteMapping("/jobs-rpa/{id}")
    public ResponseEntity<?> deleteJob(@PathVariable UUID id) {
        jobsRpaRepository.deleteById(id);
        return ResponseEntity.ok(Map.of("message", "Agendamento removido com sucesso"));
    }

    @PostMapping("/rpas/{rpaId}/executar")
    public ResponseEntity<?> executarAgora(@PathVariable UUID rpaId) {
        CadastroRpa rpa = cadastroRpaRepository.findById(rpaId).orElse(null);
        if (rpa == null) {
            return ResponseEntity.notFound().build();
        }

        RpaExecucaoFila fila = RpaExecucaoFila.builder()
                .cadastroRpa(rpa)
                .status("pendente")
                .tipoExecucao("manual")
                .parametros("{}")
                .mensagemStatus("Aguardando orquestrador")
                .criadoEm(OffsetDateTime.now())
                .atualizadoEm(OffsetDateTime.now())
                .build();

        fila = rpaExecucaoFilaRepository.save(fila);
        return ResponseEntity.ok(fila);
    }

    @PostMapping("/rpas/reprocessar")
    public ResponseEntity<?> reprocessar(@RequestBody CreateReprocessRequest req) {
        CadastroRpa rpa = cadastroRpaRepository.findById(req.getCadastroRpaId()).orElse(null);
        if (rpa == null) {
            return ResponseEntity.badRequest().body(Map.of("message", "RPA inválido"));
        }

        // Marcar subtasks no banco com reprocessar = true
        if (req.getSubtaskIds() != null && !req.getSubtaskIds().isEmpty()) {
            String subtaskTable = rpa.getIdentificadorRpa() + "_subtask";
            for (UUID subtaskId : req.getSubtaskIds()) {
                try {
                    jdbcTemplate.update("UPDATE " + subtaskTable + " SET reprocessar = true WHERE id = ?", subtaskId);
                } catch (Exception e) {
                    // Ignore table errors or fallback
                }
            }
        }

        // Criar registro na fila de execuções
        String docsJoined = req.getDocumentos() == null ? "" : req.getDocumentos().stream().map(d -> "\"" + d + "\"").collect(Collectors.joining(","));
        String paramsJson = String.format("{\"caminho_planilha\": \"%s\", \"documentos\": [%s], \"task_id\": \"%s\"}",
                req.getCaminhoPlanilha() != null ? req.getCaminhoPlanilha().replace("\\", "\\\\") : "",
                docsJoined,
                req.getTaskId() != null ? req.getTaskId() : "");

        RpaExecucaoFila fila = RpaExecucaoFila.builder()
                .cadastroRpa(rpa)
                .status("pendente")
                .tipoExecucao("reprocessamento")
                .parametros(paramsJson)
                .mensagemStatus("Reprocessamento solicitado")
                .criadoEm(OffsetDateTime.now())
                .atualizadoEm(OffsetDateTime.now())
                .build();

        fila = rpaExecucaoFilaRepository.save(fila);
        return ResponseEntity.ok(fila);
    }
}

@Data
class CreateJobRpaRequest {
    private UUID id;
    private UUID clientId;
    private UUID cadastroRpaId;
    private String cronExpression;
    private String status;
}

@Data
class CreateReprocessRequest {
    private UUID cadastroRpaId;
    private UUID taskId;
    private String caminhoPlanilha;
    private List<UUID> subtaskIds;
    private List<String> documentos;
}
