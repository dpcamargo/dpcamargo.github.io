+++
title = "WeFood User Service"
author = "Dario Camargo"
date = "2026-09-25T00:00:00-03:00"
description = "Hexagonal Java microservice with strict framework isolation, ownership-aware RBAC, and Testcontainers verification"
stack = ["Java 21", "Spring Boot 3", "Spring Security", "PostgreSQL", "Testcontainers", "Docker"]
repo = "https://github.com/dpcamargo/wefood-user-service-spring"
+++

Authentication and user-management service for a multi-tenant food ordering platform, designed around strict Hexagonal (Ports & Adapters) boundaries where the domain and application use cases carry zero framework dependencies.

- **Strict Framework-Independent Core**: Core domain entities and use cases depend solely on pure Java interfaces; Spring Security BCrypt and Spring Data JPA are wired as interchangeable inbound/outbound adapters.
- **Ownership & Role-Aware RBAC**: Fine-grained access control distinguishing `ADMIN`, `RESTAURANT_OWNER`, and `CUSTOMER`, enforcing resource ownership constraints alongside role escalation safeguards.
- **Automated Soft-Deletion**: Implemented via global Hibernate filters (`deletedFilter`) to ensure deleted records remain invisible across relational queries without physical loss.
- **Integration Testing with Real Infrastructure**: Verified with JUnit 5, Mockito, and Testcontainers against ephemeral PostgreSQL instances.
