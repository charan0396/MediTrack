package com.example.login.dto;

import java.math.BigDecimal;
import java.time.LocalDate;

/**
 * One product line of a saved invoice, with the invoice columns beside it (used by the "Saved bills" table).
 * billFileName is null when no bill image was attached.
 */
public record BillRow(
        Long billId,
        LocalDate recordedDate,
        String name,
        LocalDate billDate,
        String medicalShop,
        String invoiceNumber,
        String product,
        BigDecimal quantity,
        BigDecimal price,
        BigDecimal lineTotal,
        BigDecimal totalAmount,
        String billFileName) {
}
