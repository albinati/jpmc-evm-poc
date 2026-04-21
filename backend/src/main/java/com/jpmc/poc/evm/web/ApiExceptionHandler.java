package com.jpmc.poc.evm.web;

import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.server.ResponseStatusException;

@RestControllerAdvice
public class ApiExceptionHandler {

  private static final Logger log = LoggerFactory.getLogger(ApiExceptionHandler.class);

  @ExceptionHandler(ResponseStatusException.class)
  public ResponseEntity<Map<String, Object>> handleResponseStatus(ResponseStatusException ex) {
    return ResponseEntity.status(ex.getStatusCode())
        .body(
            Map.of(
                "error", ex.getReason() != null ? ex.getReason() : ex.getStatusCode().toString(),
                "status", ex.getStatusCode().value()));
  }

  @ExceptionHandler(Exception.class)
  public ResponseEntity<Map<String, Object>> handleGeneric(Exception ex) {
    log.warn("Request failed: {}", ex.toString());
    String msg = ex.getMessage() != null ? ex.getMessage() : ex.getClass().getSimpleName();
    if (ex.getCause() != null && ex.getCause().getMessage() != null) {
      msg = msg + " — " + ex.getCause().getMessage();
    }
    return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
        .body(Map.of("error", msg, "status", 500));
  }
}
