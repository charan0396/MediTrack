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

    /** All records of one user, or of every user when allUsers is true (super user). */
    @Transactional(readOnly = true)
    public List<RecordView> list(String owner, boolean allUsers) {
        List<RecordBase> base = allUsers ? records.findAllBase() : records.findBaseByOwner(owner);
        List<FileRef> refs = allUsers ? attachments.findAllRefs() : attachments.findRefsByOwner(owner);
        Map<Long, List<FileRef>> filesByRecord = refs.stream().collect(Collectors.groupingBy(FileRef::recordId));

        return base.stream().map(b -> {
            List<FileRef> files = filesByRecord.getOrDefault(b.id(), List.of());
            return new RecordView(b.id(), b.recordedDate(), b.name(), b.recordDate(), b.medicalType(), b.hospitalName(),
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
