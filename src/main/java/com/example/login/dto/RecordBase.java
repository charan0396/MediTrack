package com.example.login.dto;

import java.time.LocalDate;

/** Text columns of one record (loaded by the list query, without any file data). */
public record RecordBase(
        Long id,
        LocalDate recordedDate,
        String name,
        LocalDate recordDate,
        String medicalType,
        String hospitalName,
        String drName,
        String address,
        String diagnosticCenter,
        String details,
        String diagAddress) {
}
