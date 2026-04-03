A very simple barcode-driven inventory web app used by a small family team to track items across two warehouses (A & B).
The system records every movement of stock, optionally tracks bins/shelves, and keeps the interface optimized for fast scanning workflows.

1. User Stories
   Inventory visibility
   Owner
   As an owner, I want to search or scan an item and see how many we have in Warehouse A and B, so I know stock availability immediately.

Owner
As an owner, I want to see where an item is stored (bins if used) so I can find it quickly.

Owner
As an owner, I want to see the history of movements for an item, so I understand why inventory changed.

Adding stock
Family user
As a user, I want to scan an item and add quantity to a warehouse, so inventory stays accurate when items arrive.

Family user
As a user, I want the system to let me create a new item when scanning an unknown barcode, so onboarding new products is easy.

Removing stock
Family user
As a user, I want to scan an item and remove quantity, so inventory reflects items sold, consumed, or discarded.

Owner
As an owner, I want the system to warn if removal would cause negative stock, so mistakes are prevented.

Moving stock
Family user
As a user, I want to transfer items between warehouses, so inventory location stays correct.

Family user
As a user, I want to optionally specify bins when moving items, so storage locations remain accurate.

Counting stock
Family user
As a user, I want to quickly count items on a shelf/bin and update inventory, so discrepancies are corrected easily.

System administration
Owner
As an owner, I want to define whether a warehouse uses bins or not, so the system matches how the space is organized.

Owner
As an owner, I want to manage items, barcodes, warehouses, and bins, so the system reflects the real environment.

Owner
As an owner, I want to export inventory data, so I can use it in spreadsheets or accounting.

2. Functional Requirements
   2.1 Warehouses
   The system supports two warehouses initially.
   Each warehouse contains:
   name

optional bins

inventory

Configuration:
Warehouse

- id
- name
- use_bins (boolean)
  If use_bins = false, inventory exists only at warehouse level.
  If use_bins = true, inventory must be stored in bins.

  2.2 Items (SKUs)
  Each item has:
  name

internal id

optional barcodes

Multiple barcodes may map to the same item.
Users may create items during scanning if barcode unknown.

2.3 Bins (optional)
Bins represent shelves or locations.
Used only if warehouse has bins enabled.
Example:
B1
Shelf-A
Rack-12

2.4 Inventory balance
Inventory is tracked as quantity per:
warehouse
optional bin
item
Balances update automatically from movements.

2.5 Movements (core system record)
Every inventory change creates a movement record.
Movement types:
ADD (receiving)

REMOVE (consumption)

TRANSFER

COUNT_ADJUSTMENT

MANUAL_ADJUSTMENT

Movement includes:
timestamp

user

item

quantity

source warehouse/bin

destination warehouse/bin

optional note

Movements are append-only.
They cannot be edited after creation.

2.6 Add stock
User flow:
Select warehouse

Scan barcode

If item unknown → create item

Enter quantity

If bins enabled → select bin

Confirm

System effect:
movement created

inventory balance updated

2.7 Remove stock
User flow:
Select warehouse

Scan item

Enter quantity

Confirm

If bins enabled, user must choose bin.
System validates stock availability.
Negative inventory is blocked unless owner override.

2.8 Transfer stock
User flow:
Scan item

Enter quantity

Select source warehouse

Select destination warehouse

Select bins if enabled

Confirm

System records transfer movement.
Inventory decreases in source and increases in destination.

2.9 Quick count
User flow:
Select warehouse or bin

Scan item

Enter actual quantity observed

System computes difference and creates adjustment movement.

2.10 Search and inventory view
Users may search by:
barcode

item name

item code

Item page displays:
total quantity

quantity per warehouse

quantity per bin (if applicable)

movement history

2.11 User roles
Two roles exist.
Owner
Can:
change settings

override negative inventory

manage items/bins/users

User
Can:
add

remove

transfer

count

2.12 Data export
Owner can export:
current inventory

movement history

Formats:
CSV
