package com.oneprocess.rpa.repository;

import com.oneprocess.rpa.model.UsuarioPerfil;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.UUID;

@Repository
public interface UsuarioPerfilRepository extends JpaRepository<UsuarioPerfil, UUID> {
    Optional<UsuarioPerfil> findByUsername(String username);
}
