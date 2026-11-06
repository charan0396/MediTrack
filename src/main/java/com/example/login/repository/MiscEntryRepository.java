package com.example.login.repository;

import com.example.login.dto.MiscRow;
import com.example.login.model.MiscEntry;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface MiscEntryRepository extends JpaRepository<MiscEntry, Long> {

    String ROW = "select new com.example.login.dto.MiscRow(e.id, e.miscDate, e.name, e.description, e.amount, "
            + "e.createdBy, e.createdDate, e.updatedBy, e.updatedDate) from MiscEntry e ";

    @Query(ROW + "where e.createdBy = :owner order by e.id desc")
    List<MiscRow> findRowsByOwner(@Param("owner") String owner);

    @Query(ROW + "order by e.id desc")
    List<MiscRow> findAllRows();

    Optional<MiscEntry> findByIdAndCreatedBy(Long id, String createdBy);
}
