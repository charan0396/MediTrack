package com.example.login.dto;

import java.math.BigDecimal;
import java.time.LocalDate;

public record MiscRow(
        Long id,
        LocalDate recordedDate,
        LocalDate miscDate,
        String name,
        String description,
        BigDecimal amount,
        String ownerName) {
}
