package com.oneprocess.rpa.model;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;
import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(name = "rpa_execucao_fila")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class RpaExecucaoFila {
    @Id
    @GeneratedValue(strategy = GenerationType.AUTO)
    private UUID id;
    
    @ManyToOne(optional = false)
    @JoinColumn(name = "id_cadastro_rpa", nullable = false)
    private CadastroRpa cadastroRpa;
    
    @Builder.Default
    @Column(nullable = false)
    private String status = "pendente"; // "pendente", "em_execucao", "sucesso", "erro"
    
    @Column(name = "tipo_execucao", nullable = false)
    private String tipoExecucao; // "manual", "agendado", "reprocessamento"
    
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "parametros", columnDefinition = "jsonb")
    private String parametros; // JSON string e.g. {"caminho_planilha": "...", "documentos": [...]}
    
    @Column(name = "mensagem_status", columnDefinition = "TEXT")
    private String mensagemStatus;
    
    @Column(name = "criado_em")
    @Builder.Default
    private OffsetDateTime criadoEm = OffsetDateTime.now();
    
    @Column(name = "atualizado_em")
    @Builder.Default
    private OffsetDateTime atualizadoEm = OffsetDateTime.now();
}
