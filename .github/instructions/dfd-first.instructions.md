```instructions
---
applyTo: "**/*.md"
---

# DFD-First: API Contracts Hide Complexity, Enable Delegation

The **Data Flow Diagram (DFD)** serves one primary purpose: **define the API data contracts (input/output types) at system boundaries, hiding internal complexity while chunking the problem into delegatable pieces.**

## Core Principle

**Define external data flows first; implementation details are owned by individual contributors:**

- **External entities → System boundary → Data contracts**: Document the data types, structures, and validation rules that flow between external users/services and the system
- **Hide internal complexity**: Read operations, database details, service layer internals are implementation decisions—not part of the DFD contract
- **Each flow = one delegatable unit**: A clearly-defined flow with input/output data types is sufficient for a developer or team to implement independently
- **Use DFD to order work**: Flows with no dependencies can be built in parallel; flows that depend on prior outputs are sequenced accordingly

The DFD is not a system architecture diagram. It is a **contract documentation tool** that makes scope, input/output types, and sequencing crystal clear.

## Where DFD-First Applies

### Making the DFD

- **Start with external entities**: Who/what provides data to the system and what does it ask for?
- **Map flows at system boundary**: For each flow, document:
  - **Input data types**: Exact structure, required fields, validation rules (e.g., `Warehouse ID: UUID`, `Quantity: int > 0`)
  - **Output data types**: What the system returns (e.g., `Movement record`, `Updated balance`)
  - **Dependencies**: Which flows must complete before this one can proceed
- **Hide internal complexity**: Do not document service layer design, database schema internals, or deployment details—these are implementation choices
- **Stop at clarity**: When external contracts are clear and flows are independent, the DFD is complete. Individual teams handle the "how"

### Defining User Stories

- **Each story maps to a DFD flow or contiguous flows**: "Add Stock" (Flow 1), "Remove Stock" (Flow 2), "Transfer Stock" (Flow 3)
- **Story boundaries align with DFD boundaries**: If a story spans disconnected flows, it's too broad—split it
- **Acceptance criteria reference the contract**: Story for "Add Stock" specifies the exact input fields (warehouse ID, barcode, qty, optional bin, optional item metadata) and output (movement record, updated balance)

### Assigning Work

- **Each flow = one team or contributor can implement end-to-end** (assuming dependencies are satisfied)
- **Provide the DFD contract, let implementers choose the tools**: If the contract says "Movement record must include ID, type (ADD/REMOVE/TRANSFER), date, user, qty, source, destination", the implementation (REST endpoint? Database design? UI form?) is theirs
- **No surprises at integration**: Because contracts are defined upfront, work integrates without rework

### Sequencing Work

- **Order flows by dependencies**: Flows with no upstream dependencies can start immediately; dependent flows start after their dependencies produce output
- **Example ordering**:
  - Flow 1 (Add Stock) and Flow 2 (Remove Stock) can start in parallel if independent
  - Flow 3 (Transfer) requires both warehouses to exist, so foundation flows complete first

## Process When the DFD Is Unclear

1. **Identify the problem**: A flow's input/output types are ambiguous, or dependencies between flows are unclear
2. **Refine the DFD**: Break the flow into sub-flows, each with explicit input/output contracts
3. **Example**: "User Authentication" → split into:
   - Sub-flow 1A: Validate credentials (input: email + password, output: validation result + user ID)
   - Sub-flow 1B: Create session token (input: user ID, output: token)
   - Sub-flow 1C: Return token to client (input: token, output: HTTP response with token)
4. **Re-evaluate**: Can a team implement each sub-flow independently given its contract? If yes, DFD is clear
5. **Document the split**: Show why each sub-flow exists and how they sequence

## When the DFD Is Complete

- External entities and system boundary are clear
- Every flow has input/output data types explicitly documented
- Dependencies between flows are labeled (e.g., "Flow B requires output of Flow A")
- Implementation teams can read the DFD and begin work without further clarification

## When NOT to Skip DFD

- Do not start implementing without reading the DFD for your feature—it defines your contract
- Do not design internal systems (DB schema, service layer) before the DFD contract exists
- Do not merge work that violates the DFD contract (input/output types must match)
- Do not defer DFD until "later"—unclear contracts cause rework and integration delays

The DFD is **not overhead; it is the contract that prevents rework**. When the contract is clear, delegation works.

```