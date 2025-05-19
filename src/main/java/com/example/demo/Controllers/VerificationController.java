package com.example.demo.Controllers;

import com.example.demo.Models.VerificationToken;
import com.example.demo.Exceptions.InvalidTokenException;
import com.example.demo.Service.*;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.servlet.mvc.support.RedirectAttributes;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.transaction.annotation.Transactional;
import java.time.LocalDateTime;
import com.example.demo.Models.MedicalRecord;

import java.util.List;
import com.example.demo.Models.Patient;

@Controller
public class VerificationController {

    private final VerificationTokenService tokenService;
    private final UserService userService;
    private final EmailService emailService;
    private final AccountCleanupService accountCleanupService;

    public VerificationController(VerificationTokenService tokenService,
                                UserService userService,
                                EmailService emailService,
                                AccountCleanupService accountCleanupService) {
        this.tokenService = tokenService;
        this.userService = userService;
        this.emailService = emailService;
        this.accountCleanupService = accountCleanupService;
    }

    @GetMapping("/register/verify")
    public String verifyAccount(@RequestParam String token,
                              Model model,
                              RedirectAttributes redirectAttributes) {
        try {
            VerificationToken verificationToken = tokenService.validateToken(token);
            
            // Enable user account
            userService.enableUser(verificationToken.getUser());

            MedicalRecord medicalRecord=new MedicalRecord();
            Patient patient=(Patient) verificationToken.getUser();
            medicalRecord.setPatient(patient);
            
            // Send welcome email
            emailService.sendWelcomeEmail(
                verificationToken.getUser().getEmail(),
                verificationToken.getUser().getFirstName()
            );
            
            // Delete the used token
            tokenService.deleteToken(verificationToken);
            
            redirectAttributes.addFlashAttribute(
                "success", 
                "Your account has been verified successfully!"
            );
            return "redirect:/login";
            
        } catch (InvalidTokenException e) {
            // Handle invalid token
            accountCleanupService.handleFailedVerification(token);
            return "redirect:/register/verification-error";
        }
    }

    @GetMapping("/register/verification-error")
    public String showCheckEmailPage(Model model) {
        // Default error messages
        model.addAttribute("status", "400");
        model.addAttribute("error", "Invalid Token");
        model.addAttribute("message", "The token you provided is invalid or has expired.");
        return "verification-error";
    }

    // Scheduled task to clean up expired tokens daily at midnight
    @Scheduled(cron = "0 0 0 * * ?") // Runs every day at midnight
    @Transactional
    public void cleanupExpiredTokens() {
        LocalDateTime twentyFourHoursAgo = LocalDateTime.now().minusHours(24);
        List<VerificationToken> expiredTokens = tokenService.findExpiredTokens(twentyFourHoursAgo);
        
        for (VerificationToken token : expiredTokens) {
            try {
                accountCleanupService.handleFailedVerification(token.getToken());
            } catch (Exception e) {
                // Log error but continue with other tokens
                System.err.println("Error cleaning up token " + token.getToken() + ": " + e.getMessage());
            }
        }
    }
}