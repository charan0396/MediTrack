package com.example.login.dto;

import java.time.LocalDate;

/** One medicine row for the "Medicines" view. prescriptionFileName is null when no prescription file was attached. */
public record MedicineRow(
        Long id,
        LocalDate recordedDate,
        LocalDate medDate,
        String name,
        String medicalType,
        String drName,
        String hospitalName,
        Integer sno,
        String medicine,
        String description,
        Boolean morning,
        Boolean afternoon,
        Boolean night,
        String prescriptionFileName) {
}
