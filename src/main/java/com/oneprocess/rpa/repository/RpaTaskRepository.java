package com.oneprocess.rpa.repository;

import com.oneprocess.rpa.model.RpaTask;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface RpaTaskRepository extends JpaRepository<RpaTask, UUID> {
    List<RpaTask> findByCadastroRpaClienteId(UUID clienteId);
    List<RpaTask> findByCadastroRpaId(UUID rpaId);
    
    @Query("SELECT COUNT(t) FROM RpaTask t WHERE t.cadastroRpa.cliente.id = :clienteId")
    long countByClienteId(@Param("clienteId") UUID clienteId);
    
    @Query("SELECT COALESCE(SUM(t.totalLinhas), 0) FROM RpaTask t WHERE t.cadastroRpa.cliente.id = :clienteId")
    long sumTotalLinhasByClienteId(@Param("clienteId") UUID clienteId);

    @Query("SELECT COALESCE(SUM(t.linhasSucesso), 0) FROM RpaTask t WHERE t.cadastroRpa.cliente.id = :clienteId")
    long sumLinhasSucessoByClienteId(@Param("clienteId") UUID clienteId);

    @Query("SELECT COALESCE(SUM(t.linhasErro), 0) FROM RpaTask t WHERE t.cadastroRpa.cliente.id = :clienteId")
    long sumLinhasErroByClienteId(@Param("clienteId") UUID clienteId);
}
