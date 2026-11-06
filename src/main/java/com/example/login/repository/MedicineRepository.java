package com.example.login.repository;

import com.example.login.dto.FileData;
import com.example.login.dto.MedicineRow;
import com.example.login.model.Medicine;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface MedicineRepository extends JpaRepository<Medicine, Long> {

    String ROW = "select new com.example.login.dto.MedicineRow(m.id, m.createdDate, m.medDate, m.name, "
            + "m.medicalType, m.drName, m.hospitalName, m.sno, m.medicine, m.description, m.morning, "
            + "m.afternoon, m.night, m.prescriptionFileName) from Medicine m ";

    /** One user's medicines, newest day first. The image bytes are not read. */
    @Query(ROW + "where m.createdBy = :owner order by m.createdDate desc, m.id")
    List<MedicineRow> findRowsByOwner(@Param("owner") String owner);

    /** Every user's medicines (super user). */
    @Query(ROW + "order by m.createdDate desc, m.id")
    List<MedicineRow> findAllRows();

    /** The prescription image that belongs to the prescription of row {@code id}. */
    @Query("select new com.example.login.dto.FileData(m.prescriptionFileName, m.prescriptionImage) from Medicine m "
            + "where m.prescriptionImage is not null and m.prescriptionRef = "
            + "(select x.prescriptionRef from Medicine x where x.id = :id)")
    Optional<FileData> findImage(@Param("id") Long id);

    @Query("select new com.example.login.dto.FileData(m.prescriptionFileName, m.prescriptionImage) from Medicine m "
            + "where m.prescriptionImage is not null and m.prescriptionRef = "
            + "(select x.prescriptionRef from Medicine x where x.id = :id and x.createdBy = :owner)")
    Optional<FileData> findImageForOwner(@Param("id") Long id, @Param("owner") String owner);
}
