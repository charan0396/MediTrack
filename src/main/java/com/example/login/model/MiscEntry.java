package com.example.login.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;

import java.math.BigDecimal;
import java.time.LocalDate;

/** One miscellaneous entry (table "miscellaneous"): date, name, description and amount. */
@Entity
@Table(name = "miscellaneous")
public class MiscEntry {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** Login name of the user who saved this entry. */
    @Column(name = "owner_name", length = 50)
    private String ownerName;

    /** The day the entry was saved. Filled automatically. */
    @Column(name = "recorded_date")
    private LocalDate recordedDate;

    /** The date typed on the page. */
    @Column(name = "misc_date", nullable = false)
    private LocalDate miscDate;

    @Column(name = "name", nullable = false, length = 100)
    private String name;

    @Column(name = "misc_description", length = 500)
    private String description;

    @Column(name = "amount", nullable = false, precision = 16, scale = 2)
    private BigDecimal amount;

    @PrePersist
    void onCreate() {
        if (recordedDate == null) {
            recordedDate = LocalDate.now();
        }
    }

    public Long getId() { return id; }
    public void setOwnerName(String ownerName) { this.ownerName = ownerName; }
    public void setMiscDate(LocalDate miscDate) { this.miscDate = miscDate; }
    public void setName(String name) { this.name = name; }
    public void setDescription(String description) { this.description = description; }
    public void setAmount(BigDecimal amount) { this.amount = amount; }
}
