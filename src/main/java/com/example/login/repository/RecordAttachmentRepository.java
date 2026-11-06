package com.example.login.repository;

import com.example.login.dto.FileData;
import com.example.login.dto.FileRef;
import com.example.login.model.RecordAttachment;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface RecordAttachmentRepository extends JpaRepository<RecordAttachment, Long> {

    /** File names of one user's records. No file bytes are read. */
    @Query("select new com.example.login.dto.FileRef(a.id, a.medicalRecord.id, a.category, a.fileName) "
            + "from RecordAttachment a where a.medicalRecord.createdBy = :owner order by a.id")
    List<FileRef> findRefsByOwner(@Param("owner") String owner);

    /** File names of all records (super user). */
    @Query("select new com.example.login.dto.FileRef(a.id, a.medicalRecord.id, a.category, a.fileName) "
            + "from RecordAttachment a order by a.id")
    List<FileRef> findAllRefs();

    @Query("select new com.example.login.dto.FileData(a.fileName, a.data) from RecordAttachment a where a.id = :id")
    Optional<FileData> findFile(@Param("id") Long id);

    @Query("select new com.example.login.dto.FileData(a.fileName, a.data) from RecordAttachment a "
            + "where a.id = :id and a.medicalRecord.createdBy = :owner")
    Optional<FileData> findFileForOwner(@Param("id") Long id, @Param("owner") String owner);
}
