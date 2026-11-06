package com.example.login.dto;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

/**
 * One product line of a saved invoice, with the invoice columns beside it (used by the "Saved bills" table).
 * billFileName is null when no bill image was attached. subTotal, discount and GST are null for invoices saved
 * before those columns existed. status, updatedDate and updatedBy are null until the invoice is edited.
 */
public record BillRow(
        Long billId,
        LocalDateTime createdDate,
        String name,
        LocalDate billDate,
        String medicalShop,
        String invoiceNumber,
        String product,
        BigDecimal quantity,
        BigDecimal price,
        BigDecimal lineTotal,
        BigDecimal subTotal,
        String discountType,
        BigDecimal discountValue,
        BigDecimal discountAmount,
        BigDecimal gstPercent,
        BigDecimal gstAmount,
        BigDecimal totalAmount,
        String status,
        LocalDateTime updatedDate,
        String updatedBy,
        String billFileName) {

    /** The update columns are shown only for an edited invoice (the table also fills updated_date on insert). */
    public BillRow {
        if (status == null) {
            updatedDate = null;
            updatedBy = null;
        }
    }
}
