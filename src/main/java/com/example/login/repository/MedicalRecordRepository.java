package com.example.login.repository;

import com.example.login.dto.RecordBase;
import com.example.login.model.MedicalRecord;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface MedicalRecordRepository extends JpaRepository<MedicalRecord, Long> {

    /** Records of one user, newest first. Text columns only (no files). */
    @Query("select new com.example.login.dto.RecordBase(r.id, r.recordedDate, r.name, r.recordDate, r.medicalType, r.hospitalName, "
            + "r.drName, r.address, r.diagnosticCenter, r.details, r.diagAddress) "
            + "from MedicalRecord r where r.ownerName = :owner order by r.id desc")
    List<RecordBase> findBaseByOwner(@Param("owner") String owner);

    /** Records of every user (super user), newest first. */
    @Query("select new com.example.login.dto.RecordBase(r.id, r.recordedDate, r.name, r.recordDate, r.medicalType, r.hospitalName, "
            + "r.drName, r.address, r.diagnosticCenter, r.details, r.diagAddress) "
            + "from MedicalRecord r order by r.id desc")
    List<RecordBase> findAllBase();
}
