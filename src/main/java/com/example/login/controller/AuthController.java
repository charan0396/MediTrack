package com.example.login.controller;

import com.example.login.config.AccessPolicy;
import com.example.login.config.LoginAttemptLimiter;
import com.example.login.service.UserService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpSession;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private final UserService userService;
    private final AccessPolicy accessPolicy;
    private final String resetCode;
    private final LoginAttemptLimiter limiter;

    public AuthController(UserService userService,
                          AccessPolicy accessPolicy,
                          LoginAttemptLimiter limiter,
                          @Value("${app.password-reset-code:}") String resetCode) {
        this.userService = userService;
        this.accessPolicy = accessPolicy;
        this.limiter = limiter;
        this.resetCode = resetCode;
    }

    public record RegisterRequest(
            @NotBlank(message = "Name is required")
            @Size(max = 50, message = "Name must be at most 50 characters")
            String name,
            @NotBlank(message = "Password is required")
            @Size(min = 4, max = 72, message = "Password must be 4 to 72 characters")
            String password) {
    }

    public record LoginRequest(
            @NotBlank(message = "User is required") String user,
            @NotBlank(message = "Password is required") String password) {
    }

    public record ResetRequest(
            @NotBlank(message = "User is required") String user,
            @NotBlank(message = "New password is required")
            @Size(min = 4, max = 72, message = "Password must be 4 to 72 characters")
            String newPassword,
            @NotBlank(message = "Reset code is required") String resetCode) {
    }

    @PostMapping("/register")
    public ResponseEntity<Map<String, Object>> register(@Valid @RequestBody RegisterRequest request) {
        boolean saved = userService.register(request.name(), request.password());
        if (!saved) {
            return ResponseEntity.status(HttpStatus.CONFLICT).body(body(false, "This name is already taken"));
        }
        return ResponseEntity.status(HttpStatus.CREATED).body(body(true, "User saved. You can log in now."));
    }

    @PostMapping("/login")
    public ResponseEntity<Map<String, Object>> login(@Valid @RequestBody LoginRequest request,
                                                     HttpServletRequest http) {
        // Wrong passwords are counted per user name and computer address; too many lock it for a while
        String attemptKey = "login|" + request.user().trim().toLowerCase(Locale.ROOT) + "|" + http.getRemoteAddr();
        long locked = limiter.secondsLocked(attemptKey);
        if (locked > 0) {
            return tooManyAttempts(locked);
        }

        Optional<String> user = userService.authenticate(request.user(), request.password());
        if (user.isEmpty()) {
            if (limiter.recordFailure(attemptKey)) {
                return tooManyAttempts(limiter.secondsLocked(attemptKey));
            }
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(body(false, "Invalid user or password"));
        }
        limiter.recordSuccess(attemptKey);

        // New session id on every login (prevents session fixation), then remember who logged in
        HttpSession session = http.getSession(true);
        http.changeSessionId();
        session.setAttribute(SessionUser.KEY, user.get());

        return ResponseEntity.ok(Map.of(
                "success", true,
                "message", "Login successful",
                "user", user.get(),
                "superUser", accessPolicy.isSuper(user.get())));
    }

    /** Forgot password: needs the reset code from application.properties. Sets updated_date. */
    @PostMapping("/reset-password")
    public ResponseEntity<Map<String, Object>> resetPassword(@Valid @RequestBody ResetRequest request,
                                                             HttpServletRequest http) {
        if (resetCode == null || resetCode.isBlank()) {
            return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE)
                    .body(body(false, "Password reset is not enabled. Please contact the administrator."));
        }
        // Wrong reset codes are counted per computer address, so the code cannot be guessed
        String attemptKey = "reset|" + http.getRemoteAddr();
        long locked = limiter.secondsLocked(attemptKey);
        if (locked > 0) {
            return tooManyAttempts(locked);
        }
        boolean codeOk = MessageDigest.isEqual(
                request.resetCode().getBytes(StandardCharsets.UTF_8),
                resetCode.getBytes(StandardCharsets.UTF_8));
        if (!codeOk) {
            if (limiter.recordFailure(attemptKey)) {
                return tooManyAttempts(limiter.secondsLocked(attemptKey));
            }
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(body(false, "Invalid reset code"));
        }
        limiter.recordSuccess(attemptKey);
        if (!userService.resetPassword(request.user(), request.newPassword())) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(body(false, "User not found"));
        }
        return ResponseEntity.ok(body(true, "Password reset. You can log in now."));
    }

    @PostMapping("/logout")
    public ResponseEntity<Map<String, Object>> logout(HttpServletRequest http) {
        HttpSession session = http.getSession(false);
        if (session != null) {
            session.invalidate();
        }
        return ResponseEntity.ok(body(true, "Logged out"));
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<Map<String, Object>> handleValidation(MethodArgumentNotValidException ex) {
        String message = ex.getBindingResult().getFieldErrors().stream()
                .map(FieldError::getDefaultMessage)
                .findFirst()
                .orElse("Invalid input");
        return ResponseEntity.badRequest().body(body(false, message));
    }

    private static ResponseEntity<Map<String, Object>> tooManyAttempts(long seconds) {
        long minutes = Math.max(1, (seconds + 59) / 60);
        return ResponseEntity.status(HttpStatus.TOO_MANY_REQUESTS)
                .body(body(false, "Too many wrong attempts. Please try again in " + minutes
                        + (minutes == 1 ? " minute." : " minutes.")));
    }

    private static Map<String, Object> body(boolean success, String message) {
        return Map.of("success", success, "message", message);
    }
}
