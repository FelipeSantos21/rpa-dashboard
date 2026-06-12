package com.oneprocess.rpa.repository;

import com.oneprocess.rpa.model.CadastroRpa;
import com.oneprocess.rpa.model.Cliente;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface CadastroRpaRepository extends JpaRepository<CadastroRpa, UUID> {
    List<CadastroRpa> findByClienteId(UUID clienteId);
    List<CadastroRpa> findByCliente(Cliente cliente);
}
