package com.example.login.model;

import jakarta.persistence.CascadeType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Lob;
import jakarta.persistence.OneToMany;
import jakarta.persistence.OrderBy;
import jakarta.persistence.Table;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

/**
 * A copy of an invoice that was deleted, kept so deletions can be tracked. When a user deletes an invoice it is
 * removed from {@code bills} and a full copy (with its products and bill image) is saved here.
 * status is "Deleted"; updated_by / updated_date say who deleted it and when.
 */
@Entity
@Table(name = "deleted_bills")
public class DeletedBill extends Auditable {

    public static final String STATUS_DELETED = "Deleted";

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** The id this invoice had in the bills table. */
    @Column(name = "original_bill_id", nullable = false)
    private Long originalBillId;

    @Column(name = "name", nullable = false, length = 100)
    private String name;

    @Column(name = "bill_date", nullable = false)
    private LocalDate billDate;

    @Column(name = "medical_shop", length = 150)
    private String medicalShop;

    @Column(name = "invoice_number", length = 50)
    private String invoiceNumber;

    @Column(name = "sub_total", precision = 16, scale = 2)
    private BigDecimal subTotal;

    @Column(name = "discount_type", length = 10)
    private String discountType;

    @Column(name = "discount_value", precision = 16, scale = 2)
    private BigDecimal discountValue;

    @Column(name = "discount_amount", precision = 16, scale = 2)
    private BigDecimal discountAmount;

    @Column(name = "gst_percent", precision = 5, scale = 2)
    private BigDecimal gstPercent;

    @Column(name = "gst_amount", precision = 16, scale = 2)
    private BigDecimal gstAmount;

    @Column(name = "total_amount", nullable = false, precision = 16, scale = 2)
    private BigDecimal totalAmount;

    @Column(name = "bill_file_name", length = 255)
    private String billFileName;

    @Column(name = "bill_content_type", length = 100)
    private String billContentType;

    @Lob
    @Column(name = "bill_image")
    private byte[] billImage;

    /** Always "Deleted". */
    @Column(name = "status", nullable = false, length = 20)
    private String status;

    @OneToMany(mappedBy = "deletedBill", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("id")
    private List<DeletedBillItem> items = new ArrayList<>();

    public DeletedBill() {
    }

    /** Copies everything of the invoice (header, image and every product) at the moment it is deleted. */
    public static DeletedBill copyOf(Bill bill, String deletedBy, LocalDateTime deletedAt) {
        DeletedBill d = new DeletedBill();
        d.originalBillId = bill.getId();
        // created_by / created_date are those of the original invoice
        d.setCreatedBy(bill.getCreatedBy());
        d.setCreatedDate(bill.getCreatedDate());
        d.name = bill.getName();
        d.billDate = bill.getBillDate();
        d.medicalShop = bill.getMedicalShop();
        d.invoiceNumber = bill.getInvoiceNumber();
        d.subTotal = bill.getSubTotal();
        d.discountType = bill.getDiscountType();
        d.discountValue = bill.getDiscountValue();
        d.discountAmount = bill.getDiscountAmount();
        d.gstPercent = bill.getGstPercent();
        d.gstAmount = bill.getGstAmount();
        d.totalAmount = bill.getTotalAmount();
        d.billFileName = bill.getBillFileName();
        d.billContentType = bill.getBillContentType();
        d.billImage = bill.getBillImage();
        d.status = STATUS_DELETED;
        // updated_by / updated_date say who deleted the invoice and when
        d.setUpdatedBy(deletedBy);
        d.setUpdatedDate(deletedAt);
        for (BillItem item : bill.getItems()) {
            DeletedBillItem copy = new DeletedBillItem(item.getProduct(), item.getQuantity(), item.getPrice(), item.getLineTotal());
            copy.setDeletedBill(d);
            d.items.add(copy);
        }
        return d;
    }

    public Long getId() { return id; }
    public Long getOriginalBillId() { return originalBillId; }
    public String getName() { return name; }
    public LocalDate getBillDate() { return billDate; }
    public String getMedicalShop() { return medicalShop; }
    public String getInvoiceNumber() { return invoiceNumber; }
    public BigDecimal getSubTotal() { return subTotal; }
    public String getDiscountType() { return discountType; }
    public BigDecimal getDiscountValue() { return discountValue; }
    public BigDecimal getDiscountAmount() { return discountAmount; }
    public BigDecimal getGstPercent() { return gstPercent; }
    public BigDecimal getGstAmount() { return gstAmount; }
    public BigDecimal getTotalAmount() { return totalAmount; }
    public String getBillFileName() { return billFileName; }
    public String getBillContentType() { return billContentType; }
    public byte[] getBillImage() { return billImage; }
    public String getStatus() { return status; }
    public List<DeletedBillItem> getItems() { return items; }
}
