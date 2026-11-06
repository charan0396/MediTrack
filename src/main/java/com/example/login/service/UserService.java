package com.example.login.service;

import com.example.login.config.AccessPolicy;
import com.example.login.model.AppUser;
import com.example.login.repository.AppUserRepository;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.Optional;

@Service
public class UserService {

    private final AppUserRepository repository;
    private final PasswordEncoder passwordEncoder;
    private final AccessPolicy accessPolicy;

    public UserService(AppUserRepository repository, PasswordEncoder passwordEncoder, AccessPolicy accessPolicy) {
        this.repository = repository;
        this.passwordEncoder = passwordEncoder;
        this.accessPolicy = accessPolicy;
    }

    /** Saves a new user (created_date is set automatically). Returns false if the name is taken or reserved. */
    public boolean register(String name, String rawPassword) {
        String cleanName = name.trim();
        if (accessPolicy.isReserved(cleanName) || repository.existsByName(cleanName)) {
            return false;
        }
        repository.save(new AppUser(cleanName, passwordEncoder.encode(rawPassword)));
        return true;
    }

    /** Used at startup for the super user. Returns true only if a new user was created. */
    public boolean createIfMissing(String name, String rawPassword) {
        if (repository.existsByName(name)) {
            return false;
        }
        repository.save(new AppUser(name, passwordEncoder.encode(rawPassword)));
        return true;
    }

    /**
     * Login succeeds only if the user exists in the DB and the password matches.
     * Returns the name exactly as stored in the DB (so records always belong to one spelling).
     */
    public Optional<String> authenticate(String name, String rawPassword) {
        return repository.findByName(name.trim())
                .filter(user -> passwordEncoder.matches(rawPassword, user.getPasswordHash()))
                .map(AppUser::getName);
    }

    /** Sets a new password and updated_date = today. Returns false if the user does not exist. */
    @Transactional
    public boolean resetPassword(String name, String newRawPassword) {
        Optional<AppUser> found = repository.findByName(name.trim());
        if (found.isEmpty()) {
            return false;
        }
        AppUser user = found.get();
        user.setPasswordHash(passwordEncoder.encode(newRawPassword));
        user.setUpdatedDate(LocalDate.now());
        user.setUpdatedBy(user.getName());
        repository.save(user);
        return true;
    }
}
