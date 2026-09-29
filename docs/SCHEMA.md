# Typed Schema Guide (`[schema]`)

Wiki-forge provides an opt-in, enforceable type system configured via `config.toml`. When enabled, the schema linter (`schema_lint.py` or `make schema-lint`) checks that every page adheres to type definitions, required frontmatter fields, and typed relations.

---

## 1. Enabling the Schema in `config.toml`

Add a `[schema]` section to your `config.toml`:

```toml
[schema]
enabled = true
strict  = false          # false: violations are warnings; true: exit code != 0 (errors)

[schema.types.concept]
required  = ["definition", "status"]
optional  = ["prefLabel", "altLabel", "domain"]
relations = { broader = "concept", related = "concept", defined_in = "source" }

[schema.types.entity]
required  = ["entity_kind"]
relations = { instance_of = "concept", mentioned_in = "source" }

[schema.types.source]
required  = ["source_type"]          # e.g. paper, book, policy, interview, web
relations = {}

[schema.types.competency_question]
required  = ["question", "priority", "cq_status"]
relations = { about = "concept" }

[schema.relations.broader]
inverse    = "narrower"
transitive = true
acyclic    = true

[schema.relations.related]
inverse    = "related"
symmetric  = true

[schema.relations.defined_in]
inverse    = "defines"
```

---

## 2. Schema Violation Codes (`SCH-*`)

The schema linter reports findings using the following standard codes:

| Code | Severity | Description | Action / Hint |
|---|---|---|---|
| `SCH-001` | Warning/Error | Missing required field for the page type | Add the missing field to page frontmatter |
| `SCH-002` | Warning/Error | Relation used on a page type where it is not declared | Declare the relation in `[schema.types.<type>.relations]` or remove it |
| `SCH-003` | Warning/Error | Relation points to a non-existent target page (unresolved wikilink) | Create the target page or fix the wikilink |
| `SCH-004` | Warning/Error | Target page has an unexpected type (domain/range mismatch) | Ensure target page type matches expected relation target |
| `SCH-005` | Warning/Error | Dependency cycle found in a relation marked `acyclic = true` | Break circular dependency in relation chain |
| `SCH-006` | Warning/Error | Unknown page type in `strict = true` mode | Declare page type in `[schema.types]` or correct `type` |

---

## 3. Inferring Schema from Existing Wikis

If you have an existing wiki without a `[schema]` block, you can auto-propose a candidate schema based on existing frontmatter fields and wikilink target types:

```bash
python3 scripts/schema_infer.py
# or
make schema-infer
```

This prints a candidate `[schema]` TOML block to `stdout` without modifying `config.toml`. You can review and paste it into `config.toml`.
