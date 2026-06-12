package com.oneprocess.rpa.model;

import jakarta.persistence.*;
import lombok.*;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Entity
@Table(name = "cadastro_rpa")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class CadastroRpa {
    @Id
    @GeneratedValue(strategy = GenerationType.AUTO)
    private UUID id;
    
    @ManyToOne(optional = false)
    @JoinColumn(name = "id_cliente", nullable = false)
    private Cliente cliente;
    
    @Column(nullable = false)
    private String nome;
    
    @Column(columnDefinition = "TEXT")
    private String descricao;
    
    private String departamento;
    
    @Builder.Default
    private String status = "Ativo"; // "Ativo", "Inativo", "Em Manutenção"
    
    @Column(columnDefinition = "TEXT")
    private String regras;
    
    @Column(columnDefinition = "TEXT")
    private String riscos;
    
    @Column(columnDefinition = "TEXT")
    private String observacoes;
    
    @ElementCollection(fetch = FetchType.EAGER)
    @CollectionTable(name = "cadastro_rpa_emails_alerta", joinColumns = @JoinColumn(name = "id_cadastro_rpa"))
    @Column(name = "email")
    @Builder.Default
    private List<String> emailsAlerta = new ArrayList<>();
    
    @Column(name = "criado_em")
    @Builder.Default
    private OffsetDateTime criadoEm = OffsetDateTime.now();
}
