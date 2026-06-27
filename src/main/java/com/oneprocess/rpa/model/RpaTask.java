package com.oneprocess.rpa.model;

import jakarta.persistence.*;
import lombok.*;
import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(name = "rpa_sja_001_task")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class RpaTask {
    @Id
    private UUID id; // Generated via Hash in Java (Idempotency)
    
    @ManyToOne(optional = false)
    @JoinColumn(name = "id_cadastro_rpa", nullable = false)
    private CadastroRpa cadastroRpa;
    
    @Column(nullable = false)
    private String nome; // file name
    
    @Column(name = "caminho_json_disco")
    private String caminhoJsonDisco;
    
    @Column(name = "caminho_planilha")
    private String caminhoPlanilha;
    
    @Column(name = "timestamp_inicio")
    @Builder.Default
    private OffsetDateTime timestampInicio = OffsetDateTime.now();
    
    @Column(name = "timestamp_fim")
    private OffsetDateTime timestampFim;
    
    @Builder.Default
    private String status = "Processando"; // "Processando", "Sucesso", "Erro"
    
    @Column(name = "msg_erro", columnDefinition = "TEXT")
    private String msgErro;
    
    @Column(name = "total_linhas")
    @Builder.Default
    private Integer totalLinhas = 0;
    
    @Column(name = "linhas_sucesso")
    @Builder.Default
    private Integer linhasSucesso = 0;
    
    @Column(name = "linhas_erro")
    @Builder.Default
    private Integer linhasErro = 0;
    
    @Column(name = "linhas_nao_encontrado")
    @Builder.Default
    private Integer linhasNaoEncontrado = 0;
    
    @Column(name = "criado_em")
    @Builder.Default
    private OffsetDateTime criadoEm = OffsetDateTime.now();
}
