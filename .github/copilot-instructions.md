
# Context Map — Where to Find What

Before starting any non-trivial task, consult the relevant context sources:

### Specifications & Requirements

| Source                | Path                                | When to read                                                                                             |
| --------------------- | ----------------------------------- | -------------------------------------------------------------------------------------------------------- |
| **User Stories**      | [docs/user_stories.md](../../docs/user_stories.md) | Feature requirements and acceptance criteria.       |
| **Data Flow Diagram** | [docs/dfd_level0.md](../../docs/dfd_level0.md) | System boundaries, data flows, and entity relationships.  |
| **Technical Spec**    | [docs/technical.md](../../docs/technical.md) | Architecture, patterns, and technical decisions.                                                         |

### Code & Database

| Source                | Path                                | When to read                                                                                             |
| --------------------- | ----------------------------------- | -------------------------------------------------------------------------------------------------------- |
| **DB schema**         | `warehouse-backend/src/db/schema.ts` | Source of truth for data model.                                                                          |
| **Route files**       | `warehouse-backend/src/routes/*.ts`  | API endpoint definitions and request/response schemas.                                                   |

                                                                       |

## General Rules

### No unsolicited markdown files

Do not create `.md` summary or documentation files unless the user explicitly requests them.

### Iterate Harness Engineering
Whenever the user corrects you, explain what information you received that guided you to make the decision the user corrected you on. Think about putting information only in places that are relevant to that context, agent, skill etc, and reduce repetition.