package com.oneprocess.rpa.repository;

import com.oneprocess.rpa.model.RpaExecucaoFila;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface RpaExecucaoFilaRepository extends JpaRepository<RpaExecucaoFila, UUID> {
    List<RpaExecucaoFila> findByCadastroRpaId(UUID rpaId);
    List<RpaExecucaoFila> findByStatus(String status);

    @Query(value = "SELECT id, status FROM rpa_execucao_fila ORDER BY criado_em DESC LIMIT 50", nativeQuery = true)
    List<Object[]> findFingerprintData();
}
