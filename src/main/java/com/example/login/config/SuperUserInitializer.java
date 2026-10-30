package com.example.login.config;

import com.example.login.service.UserService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.stereotype.Component;

/** Creates the super user at startup when it does not exist yet. Never changes an existing user. */
@Component
public class SuperUserInitializer implements ApplicationRunner {

    private static final Logger log = LoggerFactory.getLogger(SuperUserInitializer.class);

    private final UserService userService;
    private final AccessPolicy accessPolicy;
    private final String password;

    public SuperUserInitializer(UserService userService,
                                AccessPolicy accessPolicy,
                                @Value("${app.super-user.password:family}") String password) {
        this.userService = userService;
        this.accessPolicy = accessPolicy;
        this.password = password;
    }

    @Override
    public void run(ApplicationArguments args) {
        String name = accessPolicy.superUserName();
        if (userService.createIfMissing(name, password)) {
            log.info("Super user '{}' created", name);
        }
    }
}
