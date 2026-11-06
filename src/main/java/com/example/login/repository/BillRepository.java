package com.example.login.repository;

import com.example.login.dto.BillRow;
import com.example.login.dto.FileData;
import com.example.login.model.Bill;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface BillRepository extends JpaRepository<Bill, Long> {

    /** Product lines of one user's invoices, newest invoice first. No image bytes are read. */
    @Query("select new com.example.login.dto.BillRow(b.id, b.createdDate, b.name, b.billDate, b.medicalShop, "
            + "b.invoiceNumber, i.product, i.quantity, i.price, i.lineTotal, b.subTotal, b.discountType, "
            + "b.discountValue, b.discountAmount, b.gstPercent, b.gstAmount, b.totalAmount, b.status, "
            + "b.updatedDate, b.updatedBy, b.billFileName) "
            + "from BillItem i join i.bill b where b.createdBy = :owner order by b.id desc, i.id")
    List<BillRow> findRowsByOwner(@Param("owner") String owner);

    /** Product lines of every user's invoices (super user). */
    @Query("select new com.example.login.dto.BillRow(b.id, b.createdDate, b.name, b.billDate, b.medicalShop, "
            + "b.invoiceNumber, i.product, i.quantity, i.price, i.lineTotal, b.subTotal, b.discountType, "
            + "b.discountValue, b.discountAmount, b.gstPercent, b.gstAmount, b.totalAmount, b.status, "
            + "b.updatedDate, b.updatedBy, b.billFileName) "
            + "from BillItem i join i.bill b order by b.id desc, i.id")
    List<BillRow> findAllRows();

    Optional<Bill> findByIdAndCreatedBy(Long id, String createdBy);

    @Query("select new com.example.login.dto.FileData(b.billFileName, b.billImage) from Bill b "
            + "where b.id = :id and b.billImage is not null")
    Optional<FileData> findImage(@Param("id") Long id);

    @Query("select new com.example.login.dto.FileData(b.billFileName, b.billImage) from Bill b "
            + "where b.id = :id and b.createdBy = :owner and b.billImage is not null")
    Optional<FileData> findImageForOwner(@Param("id") Long id, @Param("owner") String owner);
}
