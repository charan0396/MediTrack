package com.example.login.dto;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

/** One miscellaneous entry with its audit columns (created by/date, updated by/date). */
public record MiscRow(
        Long id,
        LocalDate miscDate,
        String name,
        String description,
        BigDecimal amount,
        String createdBy,
        LocalDateTime createdDate,
        String updatedBy,
        LocalDateTime updatedDate) {
}
