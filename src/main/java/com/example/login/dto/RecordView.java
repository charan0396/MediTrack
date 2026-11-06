package com.example.login.dto;

import java.time.LocalDateTime;
import java.util.List;

/** One table row for the view page: text columns plus the files of each category. */
public record RecordView(
        Long id,
        LocalDateTime updatedDate,
        String name,
        LocalDateTime createdDate,
        String medicalType,
        String hospitalName,
        String drName,
        String address,
        String diagnosticCenter,
        String details,
        String diagAddress,
        List<FileRef> prescription,
        List<FileRef> bill,
        List<FileRef> scan,
        List<FileRef> others) {
}
