package com.oneprocess.rpa.repository;

import com.oneprocess.rpa.model.RpaSubtask;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface RpaSubtaskRepository extends JpaRepository<RpaSubtask, UUID> {
    List<RpaSubtask> findByTaskId(UUID taskId);
    List<RpaSubtask> findByTaskCadastroRpaClienteId(UUID clienteId);
    List<RpaSubtask> findByTaskCadastroRpaId(UUID rpaId);
}
