package com.example.login.dto;

import java.time.LocalDateTime;

/** updatedDate = the day the record was saved, createdDate = the Date typed on the form. Text columns of one record (loaded by the list query, without any file data). */
public record RecordBase(
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
        String diagAddress) {
}
