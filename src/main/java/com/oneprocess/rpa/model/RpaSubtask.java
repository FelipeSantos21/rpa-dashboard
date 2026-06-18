package com.oneprocess.rpa.model;

import jakarta.persistence.*;
import lombok.*;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(name = "rpa_sja_001_subtask")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class RpaSubtask {
    @Id
    private UUID id; // Generated via Hash in Java (Idempotency)
    
    @ManyToOne(optional = false)
    @JoinColumn(name = "id_task", nullable = false)
    private RpaTask task;
    
    private String nome;
    
    @Column(nullable = false)
    private String status; // "Sucesso", "Não Encontrado", "Erro"
    
    @Column(name = "msg_erro", columnDefinition = "TEXT")
    private String msgErro;
    
    // Business Data (ERP)
    @Column(name = "numero_documento")
    private String numeroDocumento;
    
    @Column(name = "serie_documento")
    private String serieDocumento;
    
    @Column(name = "data_emissao")
    private LocalDate dataEmissao;
    
    @Column(name = "valor_total_documento", precision = 15, scale = 2)
    private BigDecimal valorTotalDocumento;
    
    @Column(name = "codigo_fornecedor")
    private String codigoFornecedor;
    
    @Column(name = "nome_fornecedor")
    private String nomeFornecedor;
    
    @Column(name = "criado_em")
    @Builder.Default
    private OffsetDateTime criadoEm = OffsetDateTime.now();
}
