package com.example.login.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;

import java.math.BigDecimal;

/** One product line of a deleted invoice (copy of a bill_items row). */
@Entity
@Table(name = "deleted_bill_items")
public class DeletedBillItem extends Auditable {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "deleted_bill_id", nullable = false)
    private DeletedBill deletedBill;

    @Column(name = "product", nullable = false, length = 200)
    private String product;

    @Column(name = "quantity", nullable = false, precision = 12, scale = 2)
    private BigDecimal quantity;

    @Column(name = "price", nullable = false, precision = 16, scale = 2)
    private BigDecimal price;

    @Column(name = "line_total", nullable = false, precision = 16, scale = 2)
    private BigDecimal lineTotal;

    public DeletedBillItem() {
    }

    /** The audit columns of a copied product line follow the deleted invoice it belongs to. */
    @PrePersist
    void inheritAudit() {
        if (deletedBill != null) {
            if (getCreatedBy() == null) {
                setCreatedBy(deletedBill.getCreatedBy());
            }
            setUpdatedBy(deletedBill.getUpdatedBy());
            setUpdatedDate(deletedBill.getUpdatedDate());
        }
    }

    public DeletedBillItem(String product, BigDecimal quantity, BigDecimal price, BigDecimal lineTotal) {
        this.product = product;
        this.quantity = quantity;
        this.price = price;
        this.lineTotal = lineTotal;
    }

    public Long getId() { return id; }

    public DeletedBill getDeletedBill() { return deletedBill; }
    public void setDeletedBill(DeletedBill deletedBill) { this.deletedBill = deletedBill; }

    public String getProduct() { return product; }
    public BigDecimal getQuantity() { return quantity; }
    public BigDecimal getPrice() { return price; }
    public BigDecimal getLineTotal() { return lineTotal; }
}
