package com.example.login.service;

import com.example.login.dto.BillRow;
import com.example.login.dto.FileData;
import com.example.login.model.Bill;
import com.example.login.model.BillItem;
import com.example.login.model.DeletedBill;
import com.example.login.repository.BillRepository;
import com.example.login.repository.DeletedBillRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Service
public class BillService {

    private final BillRepository bills;
    private final DeletedBillRepository deletedBills;

    public BillService(BillRepository bills, DeletedBillRepository deletedBills) {
        this.bills = bills;
        this.deletedBills = deletedBills;
    }

    /** Saves the invoice and all of its products in one transaction (items are saved by cascade). */
    @Transactional
    public Bill save(Bill bill) {
        return bills.save(bill);
    }

    /** Product lines of one user's invoices, or of every user's when allUsers is true (super user). */
    @Transactional(readOnly = true)
    public List<BillRow> list(String owner, boolean allUsers) {
        return allUsers ? bills.findAllRows() : bills.findRowsByOwner(owner);
    }

    /** The captured bill image. Normal users can read only the images of their own invoices. */
    @Transactional(readOnly = true)
    public Optional<FileData> findImage(Long billId, String owner, boolean allUsers) {
        return allUsers ? bills.findImage(billId) : bills.findImageForOwner(billId, owner);
    }

    /**
     * Edit: replaces the invoice details and all of its products with those of {@code changes}
     * (an unsaved Bill built from the edited form). The bill image is replaced only when {@code changes}
     * carries a new one. Status, updated_by and updated_date are set here, and only here.
     * Returns false when the invoice does not exist or belongs to another user.
     */
    @Transactional
    public boolean update(Long billId, String user, boolean allUsers, Bill changes) {
        Optional<Bill> found = allUsers ? bills.findById(billId) : bills.findByIdAndCreatedBy(billId, user);
        if (found.isEmpty()) {
            return false;
        }
        Bill bill = found.get();

        bill.setName(changes.getName());
        bill.setBillDate(changes.getBillDate());
        bill.setMedicalShop(changes.getMedicalShop());
        bill.setInvoiceNumber(changes.getInvoiceNumber());
        bill.setSubTotal(changes.getSubTotal());
        bill.setDiscountType(changes.getDiscountType());
        bill.setDiscountValue(changes.getDiscountValue());
        bill.setDiscountAmount(changes.getDiscountAmount());
        bill.setGstPercent(changes.getGstPercent());
        bill.setGstAmount(changes.getGstAmount());
        bill.setTotalAmount(changes.getTotalAmount());

        bill.getItems().clear(); // old products are deleted (orphan removal), the edited list is saved instead
        for (BillItem item : changes.getItems()) {
            bill.addItem(new BillItem(item.getProduct(), item.getQuantity(), item.getPrice(), item.getLineTotal()));
        }

        if (changes.getBillImage() != null) {
            bill.setBillFileName(changes.getBillFileName());
            bill.setBillContentType(changes.getBillContentType());
            bill.setBillImage(changes.getBillImage());
        }

        bill.setStatus(Bill.STATUS_EDITED);
        bill.touch(user); // updated_by and updated_date
        return true;
    }

    /**
     * Delete: a full copy of the invoice (with its products and image) is saved in deleted_bills with status
     * "Deleted", the date and the user, and then the invoice is removed from bills. Both happen in one
     * transaction, so an invoice is never lost without a copy. Returns false when it does not exist or
     * belongs to another user.
     */
    @Transactional
    public boolean delete(Long billId, String user, boolean allUsers) {
        Optional<Bill> found = allUsers ? bills.findById(billId) : bills.findByIdAndCreatedBy(billId, user);
        if (found.isEmpty()) {
            return false;
        }
        Bill bill = found.get();
        deletedBills.save(DeletedBill.copyOf(bill, user, LocalDateTime.now()));
        bills.delete(bill);
        return true;
    }
}
