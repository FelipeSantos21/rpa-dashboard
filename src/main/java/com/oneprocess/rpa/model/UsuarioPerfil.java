package com.oneprocess.rpa.model;

import jakarta.persistence.*;
import lombok.*;
import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(name = "usuario_perfil")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class UsuarioPerfil {
    @Id
    private UUID id;
    
    @Column(nullable = false)
    private String nome;
    
    private String sobrenome;
    
    private String departamento;
    
    @Column(unique = true, nullable = false)
    private String username;
    
    @Column(nullable = false)
    private String role; // "admin" or "client"
    
    @Column(name = "criado_em")
    @Builder.Default
    private OffsetDateTime criadoEm = OffsetDateTime.now();
}
