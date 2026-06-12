package com.oneprocess.rpa.repository;

import com.oneprocess.rpa.model.Cliente;
import com.oneprocess.rpa.model.UsuarioPerfil;
import com.oneprocess.rpa.model.VinculoClienteUsuario;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface VinculoClienteUsuarioRepository extends JpaRepository<VinculoClienteUsuario, UUID> {
    List<VinculoClienteUsuario> findByUsuario(UsuarioPerfil usuario);
    List<VinculoClienteUsuario> findByUsuarioId(UUID usuarioId);
    List<VinculoClienteUsuario> findByClienteId(UUID clienteId);
    void deleteByClienteIdAndUsuarioId(UUID clienteId, UUID usuarioId);
}
