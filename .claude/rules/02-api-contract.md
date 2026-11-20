# API contract rules

- OpenAPI 3.1 is the proposed canonical HTTP contract format.
- Contract is reviewed and versioned before backend/frontend parallel implementation.
- Define schemas, required/optional/null semantics, validation constraints, error envelope, auth, pagination, sorting, concurrency/version behavior and examples.
- Generate or validate C# and TypeScript types from the same contract where practical.
- No independently invented DTOs on either side.
- Breaking changes require explicit versioning/migration decision and compatibility tests.
- Mock server/fixtures must derive from the canonical contract.
