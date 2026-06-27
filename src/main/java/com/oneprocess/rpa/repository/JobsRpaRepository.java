package com.oneprocess.rpa.repository;

import com.oneprocess.rpa.model.JobsRpa;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface JobsRpaRepository extends JpaRepository<JobsRpa, UUID> {
    List<JobsRpa> findByClienteId(UUID clienteId);
    List<JobsRpa> findByCadastroRpaId(UUID rpaId);
}
