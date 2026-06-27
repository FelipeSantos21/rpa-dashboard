package com.oneprocess.rpa.model;

import jakarta.persistence.*;
import lombok.*;
import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(name = "jobs_rpa")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class JobsRpa {
    @Id
    @GeneratedValue(strategy = GenerationType.AUTO)
    private UUID id;
    
    @ManyToOne(optional = false)
    @JoinColumn(name = "id_cliente", nullable = false)
    private Cliente cliente;
    
    @ManyToOne(optional = false)
    @JoinColumn(name = "id_cadastro_rpa", nullable = false)
    private CadastroRpa cadastroRpa;
    
    @Column(name = "cron_expression", nullable = false)
    private String cronExpression;
    
    @Builder.Default
    @Column(nullable = false)
    private String status = "ativo"; // "ativo", "inativo"
    
    @Column(name = "criado_em")
    @Builder.Default
    private OffsetDateTime criadoEm = OffsetDateTime.now();
    
    @Column(name = "atualizado_em")
    @Builder.Default
    private OffsetDateTime atualizadoEm = OffsetDateTime.now();
}
