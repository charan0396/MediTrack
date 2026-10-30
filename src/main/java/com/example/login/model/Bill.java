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
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

/**
 * One saved invoice (bill). The products on the invoice are in {@link BillItem}; the captured bill image
 * is stored once here, however many products the invoice has.
 */
@Entity
@Table(name = "bills")
public class Bill {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** Login name of the user who saved this invoice. */
    @Column(name = "owner_name", length = 50)
    private String ownerName;

    /** The day the invoice was saved. Filled automatically. */
    @Column(name = "recorded_date")
    private LocalDate recordedDate;

    @Column(name = "name", nullable = false, length = 100)
    private String name;

    /** The date printed on the bill. */
    @Column(name = "bill_date", nullable = false)
    private LocalDate billDate;

    @Column(name = "medical_shop", length = 150)
    private String medicalShop;

    @Column(name = "invoice_number", length = 50)
    private String invoiceNumber;

    /** Sum of quantity x price of every product. Always calculated by the server. */
    @Column(name = "total_amount", nullable = false, precision = 16, scale = 2)
    private BigDecimal totalAmount;

    /** The captured (uploaded) bill image. Optional. */
    @Column(name = "bill_file_name", length = 255)
    private String billFileName;

    @Column(name = "bill_content_type", length = 100)
    private String billContentType;

    @Lob
    @Column(name = "bill_image")
    private byte[] billImage;

    @OneToMany(mappedBy = "bill", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("id")
    private List<BillItem> items = new ArrayList<>();

    @PrePersist
    void onCreate() {
        if (recordedDate == null) {
            recordedDate = LocalDate.now();
        }
    }

    public void addItem(BillItem item) {
        item.setBill(this);
        items.add(item);
    }

    public Long getId() { return id; }

    public String getOwnerName() { return ownerName; }
    public void setOwnerName(String ownerName) { this.ownerName = ownerName; }

    public LocalDate getRecordedDate() { return recordedDate; }
    public void setRecordedDate(LocalDate recordedDate) { this.recordedDate = recordedDate; }

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public LocalDate getBillDate() { return billDate; }
    public void setBillDate(LocalDate billDate) { this.billDate = billDate; }

    public String getMedicalShop() { return medicalShop; }
    public void setMedicalShop(String medicalShop) { this.medicalShop = medicalShop; }

    public String getInvoiceNumber() { return invoiceNumber; }
    public void setInvoiceNumber(String invoiceNumber) { this.invoiceNumber = invoiceNumber; }

    public BigDecimal getTotalAmount() { return totalAmount; }
    public void setTotalAmount(BigDecimal totalAmount) { this.totalAmount = totalAmount; }

    public String getBillFileName() { return billFileName; }
    public void setBillFileName(String billFileName) { this.billFileName = billFileName; }

    public String getBillContentType() { return billContentType; }
    public void setBillContentType(String billContentType) { this.billContentType = billContentType; }

    public byte[] getBillImage() { return billImage; }
    public void setBillImage(byte[] billImage) { this.billImage = billImage; }

    public List<BillItem> getItems() { return items; }
}
