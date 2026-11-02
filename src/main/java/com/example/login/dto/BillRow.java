package com.example.login.dto;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

/**
 * One product line of a saved invoice, with the invoice columns beside it (used by the "Saved bills" table).
 * billFileName is null when no bill image was attached. subTotal, discount and GST are null for invoices saved
 * before those columns existed. status, updateDate and updateBy are null until the invoice is edited.
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
        BigDecimal subTotal,
        String discountType,
        BigDecimal discountValue,
        BigDecimal discountAmount,
        BigDecimal gstPercent,
        BigDecimal gstAmount,
        BigDecimal totalAmount,
        String status,
        LocalDateTime updateDate,
        String updateBy,
        String billFileName) {
}
