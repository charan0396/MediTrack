package com.example.login.repository;

import com.example.login.dto.MiscRow;
import com.example.login.model.MiscEntry;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface MiscEntryRepository extends JpaRepository<MiscEntry, Long> {

    String ROW = "select new com.example.login.dto.MiscRow(e.id, e.recordedDate, e.miscDate, e.name, "
            + "e.description, e.amount, e.ownerName) from MiscEntry e ";

    @Query(ROW + "where e.ownerName = :owner order by e.id desc")
    List<MiscRow> findRowsByOwner(@Param("owner") String owner);

    @Query(ROW + "order by e.id desc")
    List<MiscRow> findAllRows();
}
