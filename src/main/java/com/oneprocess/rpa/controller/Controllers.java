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

    @PostMapping("/login")
    public ResponseEntity<?> login(@RequestBody LoginRequest req) {
        Optional<UsuarioPerfil> userOpt = usuarioPerfilRepository.findByUsername(req.getUsername().trim().toLowerCase());
        if (userOpt.isPresent() && userOpt.get().getPassword().equals(req.getPassword())) {
            UsuarioPerfil u = userOpt.get();
            
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
    private final RpaTaskRepository rpaTaskRepository;

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
            long executions = rpaTaskRepository.countByClienteId(c.getId());
            
            long totalRows = rpaTaskRepository.sumTotalLinhasByClienteId(c.getId());
            long successRows = rpaTaskRepository.sumLinhasSucessoByClienteId(c.getId());
            
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

    @GetMapping
    public List<Cliente> getAll() {
        return clienteRepository.findAll();
    }

    @PostMapping
    public ResponseEntity<?> create(@RequestBody CreateClientRequest req) {
        if (req.getNome() == null || req.getNome().trim().isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("message", "Nome da empresa é obrigatório"));
        }

        Cliente c = Cliente.builder()
                .nome(req.getNome())
                .razaoSocial(req.getRazaoSocial())
                .cnpj(req.getCnpj())
                .build();
        c = clienteRepository.save(c);

        if (req.getUsername() != null && !req.getUsername().trim().isEmpty()) {
            UsuarioPerfil u = UsuarioPerfil.builder()
                    .nome(req.getResponsavel() != null ? req.getResponsavel() : req.getNome())
                    .sobrenome("Contato")
                    .departamento("Geral")
                    .username(req.getUsername().trim().toLowerCase())
                    .password(req.getPassword() != null ? req.getPassword() : "123456")
                    .role("client")
                    .build();
            u = usuarioPerfilRepository.save(u);

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
        }
        clienteRepository.deleteById(id);
        return ResponseEntity.ok(Map.of("message", "Cliente removido com sucesso"));
    }
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

    @GetMapping
    public List<?> getResultados(@RequestParam(required = false) UUID clientId,
                                @RequestParam(required = false) UUID rpaId,
                                @RequestParam(required = false) String status) {
        List<RpaSubtask> subtasks;
        if (rpaId != null) {
            subtasks = rpaSubtaskRepository.findByTaskCadastroRpaId(rpaId);
        } else if (clientId != null) {
            subtasks = rpaSubtaskRepository.findByTaskCadastroRpaClienteId(clientId);
        } else {
            subtasks = rpaSubtaskRepository.findAll();
        }

        return subtasks.stream()
            .filter(s -> status == null || "Todos".equalsIgnoreCase(status) || s.getStatus().equalsIgnoreCase(status))
            .map(s -> Map.of(
                "dataExecucao", s.getTask().getTimestampInicio(),
                "numeroDocumento", s.getNumeroDocumento() != null ? s.getNumeroDocumento() : "N/A",
                "mensagemOnde", s.getMsgSefaz() != null ? s.getMsgSefaz() : (s.getMsgErro() != null ? s.getMsgErro() : "Processamento concluído"),
                "status", s.getStatus(),
                "rpaNome", s.getTask().getCadastroRpa().getNome(),
                "valor", s.getValorTotalDocumento() != null ? s.getValorTotalDocumento() : BigDecimal.ZERO,
                "fornecedor", s.getNomeFornecedor() != null ? s.getNomeFornecedor() : "N/A"
            ))
            .sorted((a, b) -> ((OffsetDateTime) b.get("dataExecucao")).compareTo((OffsetDateTime) a.get("dataExecucao")))
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

        Optional<RpaTask> taskOpt = rpaTaskRepository.findById(req.getId());
        RpaTask task;
        if (taskOpt.isPresent()) {
            task = taskOpt.get();
            task.setNome(req.getNome());
            task.setCaminhoJsonDisco(req.getCaminhoJsonDisco());
            task.setStatus(req.getStatus() != null ? req.getStatus() : "Processando");
            if (req.getMsgErro() != null) task.setMsgErro(req.getMsgErro());
            if (req.getTimestampFim() != null) task.setTimestampFim(req.getTimestampFim());
        } else {
            task = RpaTask.builder()
                    .id(req.getId())
                    .cadastroRpa(rpaOpt.get())
                    .nome(req.getNome())
                    .caminhoJsonDisco(req.getCaminhoJsonDisco())
                    .status(req.getStatus() != null ? req.getStatus() : "Processando")
                    .msgErro(req.getMsgErro())
                    .totalLinhas(0)
                    .linhasSucesso(0)
                    .linhasErro(0)
                    .timestampInicio(OffsetDateTime.now())
                    .build();
        }

        task = rpaTaskRepository.save(task);
        return ResponseEntity.ok(task);
    }

    @PostMapping("/subtask")
    public ResponseEntity<?> upsertSubtask(@RequestBody CreateSubtaskRequest req) {
        if (req.getId() == null) {
            return ResponseEntity.badRequest().body(Map.of("message", "UUID 'id' is required for subtask idempotency"));
        }

        Optional<RpaTask> taskOpt = rpaTaskRepository.findById(req.getIdTask());
        if (taskOpt.isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("message", "Task ID de referência não encontrado"));
        }

        RpaTask task = taskOpt.get();

        Optional<RpaSubtask> subtaskOpt = rpaSubtaskRepository.findById(req.getId());
        boolean isNew = subtaskOpt.isEmpty();
        String oldStatus = isNew ? null : subtaskOpt.get().getStatus();

        RpaSubtask subtask = subtaskOpt.orElse(new RpaSubtask());
        subtask.setId(req.getId());
        subtask.setTask(task);
        subtask.setNome(req.getNome());
        subtask.setStatus(req.getStatus());
        subtask.setMsgErro(req.getMsgErro());
        subtask.setMsgSefaz(req.getMsgSefaz());
        subtask.setNumeroDocumento(req.getNumeroDocumento());
        subtask.setSerieDocumento(req.getSerieDocumento());
        subtask.setDataEmissao(req.getDataEmissao());
        subtask.setValorTotalDocumento(req.getValorTotalDocumento());
        subtask.setCodigoFornecedor(req.getCodigoFornecedor());
        subtask.setNomeFornecedor(req.getNomeFornecedor());

        subtask = rpaSubtaskRepository.save(subtask);

        if (isNew) {
            task.setTotalLinhas(task.getTotalLinhas() + 1);
            if ("Sucesso".equalsIgnoreCase(req.getStatus())) {
                task.setLinhasSucesso(task.getLinhasSucesso() + 1);
            } else {
                task.setLinhasErro(task.getLinhasErro() + 1);
            }
        } else {
            if (!req.getStatus().equalsIgnoreCase(oldStatus)) {
                if ("Sucesso".equalsIgnoreCase(req.getStatus())) {
                    task.setLinhasSucesso(task.getLinhasSucesso() + 1);
                    task.setLinhasErro(Math.max(0, task.getLinhasErro() - 1));
                } else if ("Sucesso".equalsIgnoreCase(oldStatus)) {
                    task.setLinhasSucesso(Math.max(0, task.getLinhasSucesso() - 1));
                    task.setLinhasErro(task.getLinhasErro() + 1);
                }
            }
        }
        
        if (task.getLinhasErro() > 0) {
            task.setStatus("Erro");
        } else {
            task.setStatus("Sucesso");
        }
        task.setTimestampFim(OffsetDateTime.now());
        rpaTaskRepository.save(task);

        return ResponseEntity.ok(subtask);
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
    private String msgSefaz;
    private String numeroDocumento;
    private String serieDocumento;
    private LocalDate dataEmissao;
    private BigDecimal valorTotalDocumento;
    private String codigoFornecedor;
    private String nomeFornecedor;
}
