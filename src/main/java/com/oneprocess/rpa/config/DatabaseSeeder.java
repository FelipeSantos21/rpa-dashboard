package com.oneprocess.rpa.config;

import com.oneprocess.rpa.model.*;
import com.oneprocess.rpa.repository.*;
import org.springframework.boot.CommandLineRunner;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.Arrays;
import java.util.Collections;
import java.util.UUID;

@Component
public class DatabaseSeeder implements CommandLineRunner {

    private final ClienteRepository clienteRepository;
    private final UsuarioPerfilRepository usuarioPerfilRepository;
    private final VinculoClienteUsuarioRepository vinculoClienteUsuarioRepository;
    private final CadastroRpaRepository cadastroRpaRepository;
    private final RpaTaskRepository rpaTaskRepository;
    private final RpaSubtaskRepository rpaSubtaskRepository;

    public DatabaseSeeder(ClienteRepository clienteRepository,
                          UsuarioPerfilRepository usuarioPerfilRepository,
                          VinculoClienteUsuarioRepository vinculoClienteUsuarioRepository,
                          CadastroRpaRepository cadastroRpaRepository,
                          RpaTaskRepository rpaTaskRepository,
                          RpaSubtaskRepository rpaSubtaskRepository) {
        this.clienteRepository = clienteRepository;
        this.usuarioPerfilRepository = usuarioPerfilRepository;
        this.vinculoClienteUsuarioRepository = vinculoClienteUsuarioRepository;
        this.cadastroRpaRepository = cadastroRpaRepository;
        this.rpaTaskRepository = rpaTaskRepository;
        this.rpaSubtaskRepository = rpaSubtaskRepository;
    }

    @Override
    public void run(String... args) throws Exception {
        // Check if database has already been seeded or has data
        if (usuarioPerfilRepository.count() > 0 || clienteRepository.count() > 0) {
            return;
        }

        // 1. Create Clients (Tenants)
        Cliente abc = Cliente.builder()
                .nome("ABC Indústria")
                .razaoSocial("ABC Indústria Metalúrgica Ltda")
                .cnpj("12.345.678/0001-90")
                .build();
        abc = clienteRepository.save(abc);

        Cliente xyz = Cliente.builder()
                .nome("XYZ Comércio")
                .razaoSocial("XYZ Comércio Varejista S.A.")
                .cnpj("98.765.432/0001-21")
                .build();
        xyz = clienteRepository.save(xyz);

        Cliente delta = Cliente.builder()
                .nome("Delta Serviços")
                .razaoSocial("Delta Prestadora de Serviços Eireli")
                .cnpj("45.678.901/0001-34")
                .build();
        delta = clienteRepository.save(delta);

        // 2. Create User Profiles (with credentials)
        UsuarioPerfil admin = UsuarioPerfil.builder()
                .nome("OneProcess")
                .sobrenome("Admin")
                .departamento("TI")
                .username("oneprocess")
                .password("op2025")
                .role("admin")
                .build();
        usuarioPerfilRepository.save(admin);

        UsuarioPerfil userAbc = UsuarioPerfil.builder()
                .nome("João")
                .sobrenome("Ferreira")
                .departamento("Financeiro")
                .username("cliente_abc")
                .password("abc123")
                .role("client")
                .build();
        userAbc = usuarioPerfilRepository.save(userAbc);

        UsuarioPerfil userXyz = UsuarioPerfil.builder()
                .nome("Maria")
                .sobrenome("Fernanda")
                .departamento("Fiscal")
                .username("cliente_xyz")
                .password("xyz456")
                .role("client")
                .build();
        userXyz = usuarioPerfilRepository.save(userXyz);

        UsuarioPerfil userDelta = UsuarioPerfil.builder()
                .nome("Carlos")
                .sobrenome("Melo")
                .departamento("Operações")
                .username("cliente_delta")
                .password("delta789")
                .role("client")
                .build();
        userDelta = usuarioPerfilRepository.save(userDelta);

        // 3. Create Tenant Bindings
        vinculoClienteUsuarioRepository.save(VinculoClienteUsuario.builder().cliente(abc).usuario(userAbc).build());
        vinculoClienteUsuarioRepository.save(VinculoClienteUsuario.builder().cliente(xyz).usuario(userXyz).build());
        vinculoClienteUsuarioRepository.save(VinculoClienteUsuario.builder().cliente(delta).usuario(userDelta).build());

        // 4. Create RPAs (Cadastro RPA)
        // ABC Indústria RPAs
        CadastroRpa rpaAbc1 = CadastroRpa.builder()
                .cliente(abc)
                .nome("Conciliação Fiscal NF-e")
                .identificadorRpa("rpa_sja_001")
                .descricao("Concilia notas fiscais eletrônicas de entrada com o ERP.")
                .departamento("Financeiro")
                .status("Ativo")
                .regras("Mapeamento XML de fornecedores contra o ERP SAP Business One.")
                .riscos("Erros de leitura de CNPJ inativo na SEFAZ.")
                .emailsAlerta(Arrays.asList("joao.silva@empresa.com", "ti@empresa.com"))
                .build();
        rpaAbc1 = cadastroRpaRepository.save(rpaAbc1);

        CadastroRpa rpaAbc2 = CadastroRpa.builder()
                .cliente(abc)
                .nome("Lançamento de Pedidos ERP")
                .identificadorRpa("rpa_sja_002")
                .descricao("Automatiza o input de pedidos vindos do Salesforce no ERP.")
                .departamento("Compras")
                .status("Ativo")
                .regras("Verificação de estoque e inserção de ordens de venda.")
                .riscos("Preços divergentes entre Salesforce e ERP.")
                .build();
        cadastroRpaRepository.save(rpaAbc2);

        CadastroRpa rpaAbc3 = CadastroRpa.builder()
                .cliente(abc)
                .nome("Boleto Automático Clientes")
                .identificadorRpa("rpa_sja_003")
                .descricao("Emite e envia boletos bancários gerados pelo ERP para os clientes.")
                .departamento("Financeiro")
                .status("Em Manutenção")
                .regras("Geração de arquivos de remessa bancária e PDF de boletos.")
                .riscos("Rejeição bancária por dados cadastrais inválidos.")
                .build();
        cadastroRpaRepository.save(rpaAbc3);

        // XYZ Comércio RPAs
        CadastroRpa rpaXyz1 = CadastroRpa.builder()
                .cliente(xyz)
                .nome("Emissão de NF-e Automática")
                .identificadorRpa("rpa_sja_004")
                .descricao("Faturamento automático de pedidos de e-commerce.")
                .departamento("Fiscal")
                .status("Ativo")
                .build();
        rpaXyz1 = cadastroRpaRepository.save(rpaXyz1);

        CadastroRpa rpaXyz2 = CadastroRpa.builder()
                .cliente(xyz)
                .nome("Conciliação Bancária")
                .identificadorRpa("rpa_sja_005")
                .descricao("Importa extratos bancários (.OFX) e faz batimento de saldos.")
                .departamento("Financeiro")
                .status("Ativo")
                .build();
        cadastroRpaRepository.save(rpaXyz2);

        CadastroRpa rpaXyz3 = CadastroRpa.builder()
                .cliente(xyz)
                .nome("Leitura de Extratos")
                .identificadorRpa("rpa_sja_006")
                .descricao("Extrai extratos em PDF dos principais bancos parceiros diariamente.")
                .departamento("Financeiro")
                .status("Inativo")
                .build();
        cadastroRpaRepository.save(rpaXyz3);

        CadastroRpa rpaXyz4 = CadastroRpa.builder()
                .cliente(xyz)
                .nome("Consulta SEFAZ")
                .identificadorRpa("rpa_sja_007")
                .descricao("Verifica manifestação do destinatário de notas emitidas contra o CNPJ.")
                .departamento("Fiscal")
                .status("Em Manutenção")
                .build();
        cadastroRpaRepository.save(rpaXyz4);

        // Delta Serviços RPAs
        CadastroRpa rpaDelta1 = CadastroRpa.builder()
                .cliente(delta)
                .nome("Controle de Ponto")
                .identificadorRpa("rpa_sja_008")
                .descricao("Coleta e consolida registros de ponto eletrônico.")
                .departamento("RH")
                .status("Ativo")
                .build();
        cadastroRpaRepository.save(rpaDelta1);

        CadastroRpa rpaDelta2 = CadastroRpa.builder()
                .cliente(delta)
                .nome("Folha de Pagamento")
                .identificadorRpa("rpa_sja_009")
                .descricao("Executa o cálculo de holerites e impostos.")
                .departamento("Financeiro")
                .status("Em Manutenção")
                .build();
        cadastroRpaRepository.save(rpaDelta2);

        // 5. Create execution history (Tasks & Subtasks) for ABC's Conciliação Fiscal NF-e
        RpaTask task1 = RpaTask.builder()
                .id(UUID.fromString("6d790d98-89c0-4c12-a7ad-35f922756df4"))
                .cadastroRpa(rpaAbc1)
                .nome("NFe_Entradas_26052025.json")
                .caminhoJsonDisco("/data/rpa/inputs/NFe_Entradas_26052025.json")
                .status("Erro")
                .totalLinhas(5)
                .linhasSucesso(3)
                .linhasErro(2)
                .timestampInicio(OffsetDateTime.parse("2026-05-26T08:14:00-03:00"))
                .timestampFim(OffsetDateTime.parse("2026-05-26T08:26:00-03:00"))
                .build();
        task1 = rpaTaskRepository.save(task1);

        RpaSubtask s1 = RpaSubtask.builder()
                .id(UUID.randomUUID())
                .task(task1)
                .nome("Linha 1")
                .status("Sucesso")
                .msgSefaz("Lançamento concluído — portal fiscal")
                .numeroDocumento("NF-000412")
                .serieDocumento("1")
                .dataEmissao(LocalDate.of(2026, 5, 20))
                .valorTotalDocumento(new BigDecimal("12500.00"))
                .codigoFornecedor("FORN-882")
                .nomeFornecedor("Velo Fornecedor Ltda")
                .build();
        rpaSubtaskRepository.save(s1);

        RpaSubtask s2 = RpaSubtask.builder()
                .id(UUID.randomUUID())
                .task(task1)
                .nome("Linha 2")
                .status("Inconsistência")
                .msgErro("CNPJ do fornecedor inválido na base do ERP")
                .msgSefaz("CNPJ fornecedor inválido — validação")
                .numeroDocumento("NF-000413")
                .serieDocumento("1")
                .dataEmissao(LocalDate.of(2026, 5, 21))
                .valorTotalDocumento(new BigDecimal("450.50"))
                .codigoFornecedor("FORN-120")
                .nomeFornecedor("Fornecedor X Eireli")
                .build();
        rpaSubtaskRepository.save(s2);

        RpaSubtask s3 = RpaSubtask.builder()
                .id(UUID.randomUUID())
                .task(task1)
                .nome("Linha 3")
                .status("Sucesso")
                .msgSefaz("Lançamento concluído — portal fiscal")
                .numeroDocumento("NF-000414")
                .serieDocumento("1")
                .dataEmissao(LocalDate.of(2026, 5, 22))
                .valorTotalDocumento(new BigDecimal("3200.00"))
                .codigoFornecedor("FORN-882")
                .nomeFornecedor("Velo Fornecedor Ltda")
                .build();
        rpaSubtaskRepository.save(s3);

        RpaSubtask s4 = RpaSubtask.builder()
                .id(UUID.randomUUID())
                .task(task1)
                .nome("Linha 4")
                .status("Erro")
                .msgErro("Conexão perdida com o banco de dados do ERP")
                .msgSefaz("Timeout na conexão — sistema ERP")
                .numeroDocumento("NF-000415")
                .serieDocumento("2")
                .dataEmissao(LocalDate.of(2026, 5, 23))
                .valorTotalDocumento(new BigDecimal("9800.00"))
                .codigoFornecedor("FORN-301")
                .nomeFornecedor("Parceiro Y Distribuidora")
                .build();
        rpaSubtaskRepository.save(s4);

        RpaSubtask s5 = RpaSubtask.builder()
                .id(UUID.randomUUID())
                .task(task1)
                .nome("Linha 5")
                .status("Sucesso")
                .msgSefaz("Lançamento concluído — portal fiscal")
                .numeroDocumento("NF-000416")
                .serieDocumento("1")
                .dataEmissao(LocalDate.of(2026, 5, 24))
                .valorTotalDocumento(new BigDecimal("1400.00"))
                .codigoFornecedor("FORN-882")
                .nomeFornecedor("Velo Fornecedor Ltda")
                .build();
        rpaSubtaskRepository.save(s5);
        
        // Let's add an execution task for XYZ too
        RpaTask task2 = RpaTask.builder()
                .id(UUID.fromString("8c14f09d-cb25-451e-b83c-1df52345e672"))
                .cadastroRpa(rpaXyz1)
                .nome("Faturamento_Batch_009.json")
                .status("Sucesso")
                .totalLinhas(2)
                .linhasSucesso(2)
                .linhasErro(0)
                .timestampInicio(OffsetDateTime.parse("2026-05-25T14:30:00-03:00"))
                .timestampFim(OffsetDateTime.parse("2026-05-25T14:35:00-03:00"))
                .build();
        task2 = rpaTaskRepository.save(task2);
        
        rpaSubtaskRepository.save(RpaSubtask.builder()
                .id(UUID.randomUUID())
                .task(task2)
                .nome("Venda 1024")
                .status("Sucesso")
                .numeroDocumento("NF-1024")
                .dataEmissao(LocalDate.of(2026, 5, 25))
                .valorTotalDocumento(new BigDecimal("250.00"))
                .nomeFornecedor("Cliente Final Consumidor")
                .build());
                
        rpaSubtaskRepository.save(RpaSubtask.builder()
                .id(UUID.randomUUID())
                .task(task2)
                .nome("Venda 1025")
                .status("Sucesso")
                .numeroDocumento("NF-1025")
                .dataEmissao(LocalDate.of(2026, 5, 25))
                .valorTotalDocumento(new BigDecimal("1200.50"))
                .nomeFornecedor("Cliente Final Consumidor")
                .build());
    }
}
