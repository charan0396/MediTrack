package com.example.login.controller;

import com.example.login.config.AccessPolicy;
import com.example.login.dto.FileData;
import com.example.login.model.Bill;
import com.example.login.model.BillItem;
import com.example.login.service.BillService;
import com.example.login.util.FileTypes;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.util.StringUtils;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.time.format.DateTimeParseException;
import java.util.LinkedHashMap;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.Set;

/** Saves, lists, edits and deletes invoices (bills) with all of their products and the captured bill image. */
@RestController
@RequestMapping("/api/bills")
public class BillController {

    private static final int MAX_PRODUCTS = 50;
    private static final BigDecimal MAX_QUANTITY = new BigDecimal("100000");
    private static final BigDecimal MAX_PRICE = new BigDecimal("10000000");
    /** Largest invoice total that fits the database column (16 digits, 2 decimals). */
    private static final BigDecimal MAX_TOTAL = new BigDecimal("99999999999999.99");
    private static final BigDecimal HUNDRED = new BigDecimal("100");
    private static final String DISCOUNT_AMOUNT = "AMOUNT";
    private static final String DISCOUNT_PERCENT = "PERCENT";
    /** The text on the bill is read in the browser, so only pictures are accepted as the captured bill. */
    private static final Set<String> IMAGE_EXTENSIONS = Set.of("png", "jpg", "jpeg");

    private final BillService billService;
    private final AccessPolicy accessPolicy;

    public BillController(BillService billService, AccessPolicy accessPolicy) {
        this.billService = billService;
        this.accessPolicy = accessPolicy;
    }

    /**
     * Save one invoice. The products arrive as parallel lists (product[i], quantity[i], price[i]).
     * Every amount (line totals, sub total, discount, GST, total) is calculated here, never trusted from the page.
     */
    @PostMapping(consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<Map<String, Object>> create(
            HttpServletRequest http,
            @RequestParam(required = false) String name,
            @RequestParam(required = false) String billDate,
            @RequestParam(required = false) String medicalShop,
            @RequestParam(required = false) String invoiceNumber,
            @RequestParam(required = false) String discountType,
            @RequestParam(required = false) String discountValue,
            @RequestParam(required = false) String gstPercent,
            @RequestParam(required = false) MultipartFile image) throws IOException {

        String user = SessionUser.get(http);
        if (user == null) {
            return notLoggedIn();
        }

        Bill bill = buildBill(http, name, billDate, medicalShop, invoiceNumber,
                discountType, discountValue, gstPercent, image);
        bill.setOwnerName(user);
        // recorded_date is filled automatically with today's date when the invoice is saved
        // status, update_date and update_by stay empty until the invoice is edited

        Bill saved = billService.save(bill);

        Map<String, Object> body = new LinkedHashMap<>();
        body.put("success", true);
        body.put("message", "Invoice saved successfully");
        body.put("id", saved.getId());
        body.put("products", saved.getItems().size());
        body.put("totalAmount", saved.getTotalAmount());
        return ResponseEntity.status(HttpStatus.CREATED).body(body);
    }

    /**
     * Edit a saved invoice. Same fields as saving. The bill image is replaced only when a new one is sent.
     * Sets status "Edited", update date and update by. (POST, because the form carries a file.)
     */
    @PostMapping(value = "/{billId}/update", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<Map<String, Object>> update(
            HttpServletRequest http,
            @PathVariable Long billId,
            @RequestParam(required = false) String name,
            @RequestParam(required = false) String billDate,
            @RequestParam(required = false) String medicalShop,
            @RequestParam(required = false) String invoiceNumber,
            @RequestParam(required = false) String discountType,
            @RequestParam(required = false) String discountValue,
            @RequestParam(required = false) String gstPercent,
            @RequestParam(required = false) MultipartFile image) throws IOException {

        String user = SessionUser.get(http);
        if (user == null) {
            return notLoggedIn();
        }

        Bill changes = buildBill(http, name, billDate, medicalShop, invoiceNumber,
                discountType, discountValue, gstPercent, image);

        if (!billService.update(billId, user, accessPolicy.isSuper(user), changes)) {
            return notFound();
        }

        Map<String, Object> body = new LinkedHashMap<>();
        body.put("success", true);
        body.put("message", "Invoice updated successfully");
        body.put("id", billId);
        body.put("totalAmount", changes.getTotalAmount());
        return ResponseEntity.ok(body);
    }

    /** Delete a saved invoice. A full copy is kept in the deleted_bills table (see BillService.delete). */
    @DeleteMapping("/{billId}")
    public ResponseEntity<Map<String, Object>> delete(HttpServletRequest http, @PathVariable Long billId) {
        String user = SessionUser.get(http);
        if (user == null) {
            return notLoggedIn();
        }
        if (!billService.delete(billId, user, accessPolicy.isSuper(user))) {
            return notFound();
        }
        return ResponseEntity.ok(Map.of("success", true, "message", "Invoice deleted"));
    }

    /**
     * Saved invoices for the "Saved bills" table: one row per product, the logged-in user's own invoices,
     * or every invoice for the super user. Image names only, no image bytes.
     */
    @GetMapping
    public ResponseEntity<Object> list(HttpServletRequest http) {
        String owner = SessionUser.get(http);
        if (owner == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of("success", false, "message", "Please log in again"));
        }
        return ResponseEntity.ok()
                .header(HttpHeaders.CACHE_CONTROL, "private, no-store")
                .body(billService.list(owner, accessPolicy.isSuper(owner)));
    }

    /** The captured bill image of one invoice. Add ?download=true to force a download. */
    @GetMapping("/{billId}/image")
    public ResponseEntity<byte[]> image(HttpServletRequest http,
                                        @PathVariable Long billId,
                                        @RequestParam(defaultValue = "false") boolean download) {
        String owner = SessionUser.get(http);
        if (owner == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }
        Optional<FileData> found = billService.findImage(billId, owner, accessPolicy.isSuper(owner));
        if (found.isEmpty()) {
            return ResponseEntity.notFound().build();
        }

        FileData file = found.get();
        ContentDisposition disposition = (download ? ContentDisposition.attachment() : ContentDisposition.inline())
                .filename(file.fileName(), StandardCharsets.UTF_8)
                .build();

        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(FileTypes.contentType(file.fileName())))
                .contentLength(file.data().length)
                .header(HttpHeaders.CONTENT_DISPOSITION, disposition.toString())
                .header("X-Content-Type-Options", "nosniff")
                .header(HttpHeaders.CACHE_CONTROL, "private, no-store")
                .body(file.data());
    }

    // ---------- building and checking an invoice ----------

    /** Reads and checks everything the page sent and returns an unsaved invoice with all amounts calculated. */
    private Bill buildBill(HttpServletRequest http, String name, String billDate, String medicalShop,
                           String invoiceNumber, String discountType, String discountValue, String gstPercent,
                           MultipartFile image) throws IOException {
        Bill bill = new Bill();
        bill.setName(required(name, 100, "Name"));
        bill.setBillDate(parseDate(billDate));
        bill.setMedicalShop(optional(medicalShop, 150, "Medical shop"));
        bill.setInvoiceNumber(optional(invoiceNumber, 50, "Invoice number"));

        // Read the raw values: a single value containing commas must not be split into several products
        BigDecimal subTotal = addProducts(bill,
                http.getParameterValues("product"),
                http.getParameterValues("quantity"),
                http.getParameterValues("price"));

        applyTotals(bill, subTotal, discountType, discountValue, gstPercent);
        addImage(bill, image);
        return bill;
    }

    /** Adds every non-blank product row to the bill and returns the sum of the line totals (the sub total). */
    private static BigDecimal addProducts(Bill bill, String[] products, String[] quantities, String[] prices) {
        int rows = Math.max(len(products), Math.max(len(quantities), len(prices)));
        if (rows > MAX_PRODUCTS) {
            throw new InvalidInputException("An invoice can have at most " + MAX_PRODUCTS + " products");
        }

        BigDecimal subTotal = BigDecimal.ZERO;
        for (int i = 0; i < rows; i++) {
            String product = at(products, i);
            String quantity = at(quantities, i);
            String price = at(prices, i);
            if (isBlank(product) && isBlank(quantity) && isBlank(price)) {
                continue; // an empty row on the page
            }

            String label = "Product " + (i + 1);
            String productName = required(product, 200, label + ": product name");
            BigDecimal qty = amount(quantity, label + ": quantity");
            BigDecimal unitPrice = amount(price, label + ": price");
            if (qty.signum() <= 0) {
                throw new InvalidInputException(label + ": quantity must be more than 0");
            }
            if (qty.compareTo(MAX_QUANTITY) > 0) {
                throw new InvalidInputException(label + ": quantity is too large");
            }
            if (unitPrice.compareTo(MAX_PRICE) > 0) {
                throw new InvalidInputException(label + ": price is too large");
            }

            BigDecimal lineTotal = qty.multiply(unitPrice).setScale(2, RoundingMode.HALF_UP);
            bill.addItem(new BillItem(productName, qty, unitPrice, lineTotal));
            subTotal = subTotal.add(lineTotal);
        }

        if (bill.getItems().isEmpty()) {
            throw new InvalidInputException("Add at least one product");
        }
        return subTotal;
    }

    /**
     * sub total - discount = amount after discount; GST is calculated on that amount;
     * total amount = amount after discount + GST. All rounded half up to 2 decimals.
     */
    private static void applyTotals(Bill bill, BigDecimal subTotal, String typeRaw, String discountRaw,
                                    String gstRaw) {
        String type = isBlank(typeRaw) ? DISCOUNT_AMOUNT : typeRaw.trim().toUpperCase(Locale.ROOT);
        if (!type.equals(DISCOUNT_AMOUNT) && !type.equals(DISCOUNT_PERCENT)) {
            throw new InvalidInputException("Discount type must be amount or percent");
        }
        BigDecimal discountValue = isBlank(discountRaw)
                ? BigDecimal.ZERO.setScale(2)
                : amount(discountRaw, "Discount");

        BigDecimal discount;
        if (type.equals(DISCOUNT_PERCENT)) {
            if (discountValue.compareTo(HUNDRED) > 0) {
                throw new InvalidInputException("Discount cannot be more than 100%");
            }
            discount = subTotal.multiply(discountValue).divide(HUNDRED, 2, RoundingMode.HALF_UP);
        } else {
            if (discountValue.compareTo(subTotal) > 0) {
                throw new InvalidInputException("Discount cannot be more than the sub total");
            }
            discount = discountValue;
        }
        BigDecimal afterDiscount = subTotal.subtract(discount);

        BigDecimal gstPercent = isBlank(gstRaw) ? BigDecimal.ZERO.setScale(2) : amount(gstRaw, "GST");
        if (gstPercent.compareTo(HUNDRED) > 0) {
            throw new InvalidInputException("GST cannot be more than 100%");
        }
        BigDecimal gst = afterDiscount.multiply(gstPercent).divide(HUNDRED, 2, RoundingMode.HALF_UP);

        BigDecimal total = afterDiscount.add(gst);
        if (total.compareTo(MAX_TOTAL) > 0) {
            throw new InvalidInputException("The invoice total is too large");
        }

        bill.setSubTotal(subTotal);
        bill.setDiscountType(type);
        bill.setDiscountValue(discountValue);
        bill.setDiscountAmount(discount);
        bill.setGstPercent(gstPercent);
        bill.setGstAmount(gst);
        bill.setTotalAmount(total);
    }

    // ---------- captured bill image ----------

    private static void addImage(Bill bill, MultipartFile image) throws IOException {
        if (image == null || image.isEmpty()) {
            return;
        }
        String original = image.getOriginalFilename() == null ? "" : image.getOriginalFilename();
        String fileName = StringUtils.getFilename(StringUtils.cleanPath(original));
        if (fileName == null || fileName.isBlank()) {
            fileName = "bill.png";
        }
        if (fileName.length() > 255) {
            fileName = fileName.substring(fileName.length() - 255); // keep the extension
        }
        if (!IMAGE_EXTENSIONS.contains(FileTypes.extension(fileName))) {
            throw new InvalidInputException("The bill image must be a PNG or JPG picture");
        }
        bill.setBillFileName(fileName);
        bill.setBillContentType(FileTypes.contentType(fileName));
        bill.setBillImage(image.getBytes());
    }

    // ---------- helpers ----------

    private static ResponseEntity<Map<String, Object>> notLoggedIn() {
        return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                .body(Map.of("success", false, "message", "Please log in again"));
    }

    private static ResponseEntity<Map<String, Object>> notFound() {
        return ResponseEntity.status(HttpStatus.NOT_FOUND)
                .body(Map.of("success", false, "message", "Invoice not found"));
    }

    private static LocalDate parseDate(String date) {
        if (isBlank(date)) {
            throw new InvalidInputException("Bill date is required");
        }
        try {
            return LocalDate.parse(date.trim());
        } catch (DateTimeParseException e) {
            throw new InvalidInputException("Bill date is invalid");
        }
    }

    /** A plain number with at most 2 decimals kept (extra decimals are rounded half up). */
    private static BigDecimal amount(String raw, String label) {
        if (isBlank(raw)) {
            throw new InvalidInputException(label + " is required");
        }
        String cleaned = raw.trim().replace(",", "").replace(" ", "");
        if (cleaned.length() > 20 || !cleaned.matches("\\d+(\\.\\d+)?")) {
            throw new InvalidInputException(label + " must be a number");
        }
        return new BigDecimal(cleaned).setScale(2, RoundingMode.HALF_UP);
    }

    private static String required(String value, int max, String label) {
        String v = optional(value, max, label);
        if (v == null) {
            throw new InvalidInputException(label + " is required");
        }
        return v;
    }

    private static String optional(String value, int max, String label) {
        if (isBlank(value)) {
            return null;
        }
        String v = value.trim();
        if (v.length() > max) {
            throw new InvalidInputException(label + " must be at most " + max + " characters");
        }
        return v;
    }

    private static boolean isBlank(String value) {
        return value == null || value.isBlank();
    }

    private static int len(String[] values) {
        return values == null ? 0 : values.length;
    }

    private static String at(String[] values, int index) {
        return values != null && index < values.length ? values[index] : null;
    }

    static class InvalidInputException extends RuntimeException {
        InvalidInputException(String message) {
            super(message);
        }
    }

    @ExceptionHandler(InvalidInputException.class)
    public ResponseEntity<Map<String, Object>> handleInvalid(InvalidInputException ex) {
        return ResponseEntity.badRequest().body(Map.of("success", false, "message", ex.getMessage()));
    }
}
