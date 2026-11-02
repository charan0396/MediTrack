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
 * status is "Deleted"; update_date / update_by say when and by whom.
 */
@Entity
@Table(name = "deleted_bills")
public class DeletedBill {

    public static final String STATUS_DELETED = "Deleted";

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** The id this invoice had in the bills table. */
    @Column(name = "original_bill_id", nullable = false)
    private Long originalBillId;

    @Column(name = "owner_name", length = 50)
    private String ownerName;

    @Column(name = "recorded_date")
    private LocalDate recordedDate;

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

    /** When the invoice was deleted. */
    @Column(name = "update_date", nullable = false)
    private LocalDateTime updateDate;

    /** Login name of the user who deleted the invoice. */
    @Column(name = "update_by", nullable = false, length = 50)
    private String updateBy;

    @OneToMany(mappedBy = "deletedBill", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("id")
    private List<DeletedBillItem> items = new ArrayList<>();

    public DeletedBill() {
    }

    /** Copies everything of the invoice (header, image and every product) at the moment it is deleted. */
    public static DeletedBill copyOf(Bill bill, String deletedBy, LocalDateTime deletedAt) {
        DeletedBill d = new DeletedBill();
        d.originalBillId = bill.getId();
        d.ownerName = bill.getOwnerName();
        d.recordedDate = bill.getRecordedDate();
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
        d.updateDate = deletedAt;
        d.updateBy = deletedBy;
        for (BillItem item : bill.getItems()) {
            DeletedBillItem copy = new DeletedBillItem(item.getProduct(), item.getQuantity(), item.getPrice(), item.getLineTotal());
            copy.setDeletedBill(d);
            d.items.add(copy);
        }
        return d;
    }

    public Long getId() { return id; }
    public Long getOriginalBillId() { return originalBillId; }
    public String getOwnerName() { return ownerName; }
    public LocalDate getRecordedDate() { return recordedDate; }
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
    public LocalDateTime getUpdateDate() { return updateDate; }
    public String getUpdateBy() { return updateBy; }
    public List<DeletedBillItem> getItems() { return items; }
}
