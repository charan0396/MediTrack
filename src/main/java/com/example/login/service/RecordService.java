package com.example.login.service;

import com.example.login.dto.FileData;
import com.example.login.dto.FileRef;
import com.example.login.dto.RecordBase;
import com.example.login.dto.RecordView;
import com.example.login.model.MedicalRecord;
import com.example.login.model.RecordAttachment;
import com.example.login.repository.MedicalRecordRepository;
import com.example.login.repository.RecordAttachmentRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.stream.Collectors;

@Service
public class RecordService {

    /** Most files for one document type in one record (same as the controller). */
    private static final int MAX_FILES_PER_TYPE = 10;

    private final MedicalRecordRepository records;
    private final RecordAttachmentRepository attachments;

    public RecordService(MedicalRecordRepository records, RecordAttachmentRepository attachments) {
        this.records = records;
        this.attachments = attachments;
    }

    @Transactional
    public MedicalRecord save(MedicalRecord record) {
        return records.save(record); // attachments are saved with it (cascade)
    }

    /**
     * Edit a record: its text fields, remove some of its files and add new ones. Sets updated_by / updated_date.
     * Returns false when the record does not exist or is not the user's (normal users edit only their own).
     * Throws IllegalArgumentException when a document type would have more than 10 files.
     */
    @Transactional
    public boolean update(Long id, String user, boolean allUsers, MedicalRecord changes,
                          List<Long> removeFileIds, List<RecordAttachment> added) {
        MedicalRecord record = records.findById(id).orElse(null);
        if (record == null || (!allUsers && !user.equals(record.getCreatedBy()))) {
            return false;
        }
        record.setName(changes.getName());
        record.setCreatedDate(changes.getCreatedDate()); // created_date = the Date typed on the form
        record.setMedicalType(changes.getMedicalType());
        record.setHospitalName(changes.getHospitalName());
        record.setDrName(changes.getDrName());
        record.setAddress(changes.getAddress());
        record.setDiagnosticCenter(changes.getDiagnosticCenter());
        record.setDetails(changes.getDetails());
        record.setDiagAddress(changes.getDiagAddress());

        record.getAttachments().removeIf(a -> removeFileIds.contains(a.getId())); // orphan removal deletes them
        added.forEach(record::addAttachment);
        for (String category : List.of(RecordAttachment.PRESCRIPTION, RecordAttachment.BILL,
                RecordAttachment.SCAN, RecordAttachment.OTHERS)) {
            long count = record.getAttachments().stream().filter(a -> category.equals(a.getCategory())).count();
            if (count > MAX_FILES_PER_TYPE) {
                throw new IllegalArgumentException("A record can have at most " + MAX_FILES_PER_TYPE
                        + " files for each document type (" + category + ")");
            }
        }
        record.touch(user); // updated_by and updated_date
        return true;
    }

    /** All records of one user, or of every user when allUsers is true (super user). */
    @Transactional(readOnly = true)
    public List<RecordView> list(String owner, boolean allUsers) {
        List<RecordBase> base = allUsers ? records.findAllBase() : records.findBaseByOwner(owner);
        List<FileRef> refs = allUsers ? attachments.findAllRefs() : attachments.findRefsByOwner(owner);
        Map<Long, List<FileRef>> filesByRecord = refs.stream().collect(Collectors.groupingBy(FileRef::recordId));

        return base.stream().map(b -> {
            List<FileRef> files = filesByRecord.getOrDefault(b.id(), List.of());
            return new RecordView(b.id(), b.updatedDate(), b.name(), b.createdDate(), b.medicalType(), b.hospitalName(),
                    b.drName(), b.address(), b.diagnosticCenter(), b.details(), b.diagAddress(),
                    pick(files, RecordAttachment.PRESCRIPTION),
                    pick(files, RecordAttachment.BILL),
                    pick(files, RecordAttachment.SCAN),
                    pick(files, RecordAttachment.OTHERS));
        }).toList();
    }

    /** One file. Normal users can read only files of their own records. */
    @Transactional(readOnly = true)
    public Optional<FileData> findFile(Long fileId, String owner, boolean allUsers) {
        return allUsers ? attachments.findFile(fileId) : attachments.findFileForOwner(fileId, owner);
    }

    private static List<FileRef> pick(List<FileRef> files, String category) {
        return files.stream().filter(f -> category.equals(f.category())).toList();
    }
}
