package com.example.login.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.math.BigDecimal;
import java.time.LocalDate;

/** One miscellaneous entry (table "miscellaneous"): date, name, description and amount. */
@Entity
@Table(name = "miscellaneous")
public class MiscEntry extends Auditable {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** The date typed on the page. */
    @Column(name = "misc_date", nullable = false)
    private LocalDate miscDate;

    @Column(name = "name", nullable = false, length = 100)
    private String name;

    @Column(name = "misc_description", length = 500)
    private String description;

    @Column(name = "amount", nullable = false, precision = 16, scale = 2)
    private BigDecimal amount;

    public Long getId() { return id; }
    public String getName() { return name; }
    public void setMiscDate(LocalDate miscDate) { this.miscDate = miscDate; }
    public void setName(String name) { this.name = name; }
    public void setDescription(String description) { this.description = description; }
    public void setAmount(BigDecimal amount) { this.amount = amount; }
}
