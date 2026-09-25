+++
title = "WeFood"
author = "Dario Camargo"
date = "2026-09-25T00:00:00-03:00"
description = "Restaurant management API — hexagonal Java backend for a multi-restaurant ordering platform"
stack = ["Java 21", "Spring Boot", "Spring Security", "Spring Data JPA", "MapStruct", "Docker"]
repo = "https://github.com/dpcamargo/fiap-wefood"
+++

Backend for a multi-restaurant ordering platform, built as the capstone for my postgraduate degree in Java Architecture and Development at FIAP. Hexagonal (Clean) Architecture with domain, use-case, and adapter layers kept independent, so business rules don't depend on Spring or the database.

- **Auth & authorization**: JWT-based login, role-based access control (admin / restaurant owner / customer)
- **Persistence**: Spring Data JPA, runs against PostgreSQL or H2 via Docker Compose profiles
- **API docs**: Swagger/OpenAPI, plus a Postman collection for manual testing
- **Testing**: JUnit 5 and Mockito
