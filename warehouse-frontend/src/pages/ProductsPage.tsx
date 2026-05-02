import { FormEvent, useEffect, useMemo, useState } from "react";
import { ApiError, getApiErrorMessage } from "../lib/api";
import {
  useAddSku,
  useAddBarcode,
  useCreateItem,
  useItemById,
  useItems,
} from "../hooks/queries/useItems";
import { useAuthStore } from "../stores/authStore";
import { ScanOverlay } from "../components/ScanOverlay";

function normalizeInputs(values: string[]) {
  return values.map((value) => value.trim()).filter(Boolean);
}

function duplicateValue(values: string[]) {
  const seen = new Set<string>();

  for (const value of values) {
    if (seen.has(value)) {
      return value;
    }

    seen.add(value);
  }

  return null;
}

function formatSkuSummary(skus: string[]) {
  if (skus.length === 0) {
    return null;
  }

  return `SKUs: ${skus.slice(0, 3).join(", ")}${skus.length > 3 ? ` +${skus.length - 3} more` : ""}`;
}

export function ProductsPage() {
  const { user } = useAuthStore();
  const isOwner = user?.role === "owner";

  const [search, setSearch] = useState("");
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [skuInputs, setSkuInputs] = useState<string[]>([""]);
  const [barcodeInputs, setBarcodeInputs] = useState<string[]>([""]);
  const [nameError, setNameError] = useState<string | null>(null);
  const [skuError, setSkuError] = useState<string | null>(null);
  const [barcodeError, setBarcodeError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);
  const [newSku, setNewSku] = useState("");
  const [newSkuError, setNewSkuError] = useState<string | null>(null);
  const [newSkuSuccess, setNewSkuSuccess] = useState<string | null>(null);
  const [newBarcode, setNewBarcode] = useState("");
  const [newBarcodeError, setNewBarcodeError] = useState<string | null>(null);
  const [newBarcodeSuccess, setNewBarcodeSuccess] = useState<string | null>(
    null,
  );
  const [showAddBarcodeScanner, setShowAddBarcodeScanner] = useState(false);
  const [showCreateBarcodeScanner, setShowCreateBarcodeScanner] = useState<
    number | null
  >(null);

  const itemsQuery = useItems();
  const itemQuery = useItemById(selectedItemId);
  const createItemMutation = useCreateItem();
  const addSkuMutation = useAddSku();
  const addBarcodeMutation = useAddBarcode();

  const filteredItems = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    const items = itemsQuery.data || [];

    if (!normalizedSearch) {
      return items;
    }

    return items.filter((item) => {
      const barcodeMatch = item.barcodes.some((value) =>
        value.toLowerCase().includes(normalizedSearch),
      );

      return (
        item.name.toLowerCase().includes(normalizedSearch) ||
        item.skus.some((value) =>
          value.toLowerCase().includes(normalizedSearch),
        ) ||
        item.description?.toLowerCase().includes(normalizedSearch) ||
        barcodeMatch
      );
    });
  }, [itemsQuery.data, search]);

  useEffect(() => {
    if (!filteredItems.length) {
      setSelectedItemId(null);

      return;
    }

    const selectedStillVisible = filteredItems.some(
      (item) => item.id === selectedItemId,
    );

    if (!selectedItemId || !selectedStillVisible) {
      setSelectedItemId(filteredItems[0].id);
    }
  }, [filteredItems, itemsQuery.data, selectedItemId]);

  const resetCreateForm = () => {
    setName("");
    setDescription("");
    setSkuInputs([""]);
    setBarcodeInputs([""]);
    setNameError(null);
    setSkuError(null);
    setBarcodeError(null);
    setFormError(null);
  };

  const handleSkuChange = (index: number, value: string) => {
    setSkuInputs((current) =>
      current.map((entry, currentIndex) =>
        currentIndex === index ? value : entry,
      ),
    );
  };

  const addSkuInput = () => {
    setSkuInputs((current) => [...current, ""]);
  };

  const removeSkuInput = (index: number) => {
    setSkuInputs((current) =>
      current.length === 1
        ? [""]
        : current.filter((_, currentIndex) => currentIndex !== index),
    );
  };

  const handleBarcodeChange = (index: number, value: string) => {
    setBarcodeInputs((current) =>
      current.map((entry, currentIndex) =>
        currentIndex === index ? value : entry,
      ),
    );
  };

  const addBarcodeInput = () => {
    setBarcodeInputs((current) => [...current, ""]);
  };

  const removeBarcodeInput = (index: number) => {
    setBarcodeInputs((current) =>
      current.length === 1
        ? [""]
        : current.filter((_, currentIndex) => currentIndex !== index),
    );
  };

  const handleCreateItem = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const trimmedName = name.trim();
    const trimmedDescription = description.trim();
    const skus = normalizeInputs(skuInputs);
    const barcodes = normalizeInputs(barcodeInputs);
    const duplicateSku = duplicateValue(skus);
    const duplicateBarcodeValue = duplicateValue(barcodes);

    setNameError(null);
    setSkuError(null);
    setBarcodeError(null);
    setFormError(null);
    setFormSuccess(null);

    if (!trimmedName) {
      setNameError("Product name is required");
      return;
    }

    if (trimmedName.length > 200) {
      setNameError("Product name must be 200 characters or less");
      return;
    }

    if (trimmedDescription.length > 1000) {
      setFormError("Description must be 1000 characters or less");
      return;
    }

    if (duplicateSku) {
      setSkuError(`SKU \"${duplicateSku}\" is duplicated in this form`);
      return;
    }

    if (duplicateBarcodeValue) {
      setBarcodeError(
        `Barcode \"${duplicateBarcodeValue}\" is duplicated in this form`,
      );
      return;
    }

    try {
      const createdItem = await createItemMutation.mutateAsync({
        name: trimmedName,
        ...(trimmedDescription ? { description: trimmedDescription } : {}),
        ...(skus.length ? { skus } : {}),
        ...(barcodes.length ? { barcodes } : {}),
      });

      resetCreateForm();
      setSelectedItemId(createdItem.id);
      setFormSuccess("Product created");
    } catch (error) {
      if (error instanceof ApiError && error.status === 409) {
        const message = getApiErrorMessage(
          error,
          "Barcode or SKU already exists",
        );

        if (message.toLowerCase().includes("sku")) {
          setSkuError(message);
          return;
        }

        setBarcodeError(message);
        return;
      }

      if (error instanceof ApiError && error.status === 403) {
        setFormError("Only owners can create products");
        return;
      }

      setFormError(getApiErrorMessage(error, "Failed to create product"));
    }
  };

  const handleAddBarcode = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const trimmedBarcode = newBarcode.trim();
    setNewBarcodeError(null);
    setNewBarcodeSuccess(null);

    if (!selectedItemId) {
      setNewBarcodeError("Select a product before adding a barcode");
      return;
    }

    if (!trimmedBarcode) {
      setNewBarcodeError("Barcode is required");
      return;
    }

    if (trimmedBarcode.length > 200) {
      setNewBarcodeError("Barcode must be 200 characters or less");
      return;
    }

    try {
      const updatedItem = await addBarcodeMutation.mutateAsync({
        itemId: selectedItemId,
        barcode: trimmedBarcode,
      });

      setNewBarcode("");
      setNewBarcodeSuccess(`Barcode added to ${updatedItem.name}`);
    } catch (error) {
      if (error instanceof ApiError && error.status === 409) {
        setNewBarcodeError(getApiErrorMessage(error, "Barcode already exists"));
        return;
      }

      if (error instanceof ApiError && error.status === 403) {
        setNewBarcodeError("Only owners can add barcodes");
        return;
      }

      if (error instanceof ApiError && error.status === 404) {
        setNewBarcodeError("Product not found");
        return;
      }

      setNewBarcodeError(getApiErrorMessage(error, "Failed to add barcode"));
    }
  };

  const handleAddSku = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const trimmedSku = newSku.trim();
    setNewSkuError(null);
    setNewSkuSuccess(null);

    if (!selectedItemId) {
      setNewSkuError("Select a product before adding a SKU");
      return;
    }

    if (!trimmedSku) {
      setNewSkuError("SKU is required");
      return;
    }

    if (trimmedSku.length > 100) {
      setNewSkuError("SKU must be 100 characters or less");
      return;
    }

    try {
      const updatedItem = await addSkuMutation.mutateAsync({
        itemId: selectedItemId,
        sku: trimmedSku,
      });

      setNewSku("");
      setNewSkuSuccess(`SKU added to ${updatedItem.name}`);
    } catch (error) {
      if (error instanceof ApiError && error.status === 409) {
        setNewSkuError(getApiErrorMessage(error, "SKU already exists"));
        return;
      }

      if (error instanceof ApiError && error.status === 403) {
        setNewSkuError("Only owners can add SKUs");
        return;
      }

      if (error instanceof ApiError && error.status === 404) {
        setNewSkuError("Product not found");
        return;
      }

      setNewSkuError(getApiErrorMessage(error, "Failed to add SKU"));
    }
  };

  const selectedItem = itemQuery.data;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8 space-y-8">
        <div className="md:flex md:items-center md:justify-between">
          <div className="flex-1 min-w-0">
            <h1 className="text-3xl font-bold text-gray-900">Products</h1>
            <p className="mt-2 text-sm text-gray-600">
              Define items, attach multiple barcodes, and keep products
              discoverable for inventory flows.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
          <section className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between gap-4 mb-4">
              <div>
                <h2 className="text-xl font-semibold text-gray-900">
                  Create Product
                </h2>
                <p className="text-sm text-gray-600 mt-1">
                  Owners can register products before stock arrives.
                </p>
              </div>
            </div>

            {!isOwner ? (
              <div className="rounded-md bg-blue-50 p-4 text-sm text-blue-800">
                Product management is available to owners. You can still browse
                and search products from the list.
              </div>
            ) : (
              <form className="space-y-4" onSubmit={handleCreateItem}>
                {formError && (
                  <div className="rounded-md bg-red-50 p-4 text-sm text-red-800">
                    {formError}
                  </div>
                )}

                {formSuccess && (
                  <div className="rounded-md bg-green-50 p-4 text-sm text-green-800">
                    {formSuccess}
                  </div>
                )}

                <div>
                  <label
                    htmlFor="product-name"
                    className="block text-sm font-medium text-gray-700 mb-2"
                  >
                    Product Name
                  </label>
                  <input
                    id="product-name"
                    type="text"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    maxLength={200}
                    className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    placeholder="Protein powder, Tape roll, Cleaning spray"
                    disabled={createItemMutation.isPending}
                  />
                  {nameError && (
                    <p className="mt-2 text-sm text-red-600">{nameError}</p>
                  )}
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-4">
                    <label className="block text-sm font-medium text-gray-700">
                      SKUs
                    </label>
                    <button
                      type="button"
                      onClick={addSkuInput}
                      className="text-sm font-medium text-blue-600 hover:text-blue-700"
                      disabled={createItemMutation.isPending}
                    >
                      Add SKU field
                    </button>
                  </div>

                  {skuInputs.map((value, index) => (
                    <div
                      key={`${index}-${skuInputs.length}`}
                      className="flex gap-3"
                    >
                      <input
                        id={index === 0 ? "product-sku" : undefined}
                        type="text"
                        value={value}
                        onChange={(event) =>
                          handleSkuChange(index, event.target.value)
                        }
                        maxLength={100}
                        className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                        placeholder="Optional SKU"
                        disabled={createItemMutation.isPending}
                      />
                      <button
                        type="button"
                        onClick={() => removeSkuInput(index)}
                        className="px-3 py-2 text-sm font-medium text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50"
                        disabled={createItemMutation.isPending}
                      >
                        Remove
                      </button>
                    </div>
                  ))}

                  {skuError && (
                    <p className="text-sm text-red-600">{skuError}</p>
                  )}
                </div>

                <div>
                  <label
                    htmlFor="product-description"
                    className="block text-sm font-medium text-gray-700 mb-2"
                  >
                    Description
                  </label>
                  <textarea
                    id="product-description"
                    value={description}
                    onChange={(event) => setDescription(event.target.value)}
                    maxLength={1000}
                    rows={4}
                    className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    placeholder="Optional details for operators or purchasing"
                    disabled={createItemMutation.isPending}
                  />
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-4">
                    <label className="block text-sm font-medium text-gray-700">
                      Barcodes
                    </label>
                    <button
                      type="button"
                      onClick={addBarcodeInput}
                      className="text-sm font-medium text-blue-600 hover:text-blue-700"
                      disabled={createItemMutation.isPending}
                    >
                      Add barcode field
                    </button>
                  </div>

                  {barcodeInputs.map((value, index) => (
                    <div
                      key={`${index}-${barcodeInputs.length}`}
                      className="flex gap-3"
                    >
                      <input
                        type="text"
                        value={value}
                        onChange={(event) =>
                          handleBarcodeChange(index, event.target.value)
                        }
                        maxLength={200}
                        className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                        placeholder="Optional barcode"
                        disabled={createItemMutation.isPending}
                      />
                      <button
                        type="button"
                        onClick={() => setShowCreateBarcodeScanner(index)}
                        className="px-3 py-2 text-sm font-medium text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50"
                        disabled={createItemMutation.isPending}
                      >
                        📷
                      </button>
                      <button
                        type="button"
                        onClick={() => removeBarcodeInput(index)}
                        className="px-3 py-2 text-sm font-medium text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50"
                        disabled={createItemMutation.isPending}
                      >
                        Remove
                      </button>
                    </div>
                  ))}

                  {barcodeError && (
                    <p className="text-sm text-red-600">{barcodeError}</p>
                  )}
                </div>

                <button
                  type="submit"
                  className="w-full inline-flex justify-center rounded-md border border-transparent bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={createItemMutation.isPending}
                >
                  {createItemMutation.isPending
                    ? "Creating..."
                    : "Create Product"}
                </button>
              </form>
            )}
          </section>

          <section className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between gap-4 mb-4">
              <div>
                <h2 className="text-xl font-semibold text-gray-900">
                  Product List
                </h2>
                <p className="text-sm text-gray-600 mt-1">
                  Search by product name, SKU, description, or barcode.
                </p>
              </div>
            </div>

            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="block w-full px-3 py-2 mb-4 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
              placeholder="Search products by name, SKU, or barcode"
            />

            {itemsQuery.isLoading ? (
              <p className="text-sm text-gray-600">Loading products...</p>
            ) : itemsQuery.isError ? (
              <div className="rounded-md bg-red-50 p-4 text-sm text-red-800">
                Failed to load products.
              </div>
            ) : filteredItems.length === 0 ? (
              <div className="rounded-md bg-blue-50 p-4 text-sm text-blue-800">
                {(itemsQuery.data || []).length === 0
                  ? "No products yet. Create one to make it available to inventory flows."
                  : "No products match your search."}
              </div>
            ) : (
              <div className="space-y-3">
                {filteredItems.map((item) => {
                  const isSelected = item.id === selectedItemId;

                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setSelectedItemId(item.id)}
                      className={`w-full text-left rounded-lg border p-4 transition-colors ${
                        isSelected
                          ? "border-blue-500 bg-blue-50"
                          : "border-gray-200 hover:border-gray-300"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <h3 className="font-semibold text-gray-900">
                            {item.name}
                          </h3>
                          {item.skus.length > 0 && (
                            <p className="mt-1 text-xs font-medium uppercase tracking-wide text-blue-700">
                              {formatSkuSummary(item.skus)}
                            </p>
                          )}
                          {item.description && (
                            <p className="mt-1 text-sm text-gray-600 line-clamp-2">
                              {item.description}
                            </p>
                          )}
                        </div>
                        <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-700">
                          {item.barcode_count} barcode
                          {item.barcode_count === 1 ? "" : "s"}
                        </span>
                      </div>
                      <p className="mt-3 text-xs text-gray-500">
                        Created {new Date(item.created_at).toLocaleDateString()}
                      </p>
                    </button>
                  );
                })}
              </div>
            )}
          </section>

          <section className="bg-white rounded-lg shadow p-6">
            <div className="mb-4">
              <h2 className="text-xl font-semibold text-gray-900">
                Product Detail
              </h2>
              <p className="text-sm text-gray-600 mt-1">
                Review the barcode set operators will discover during stock
                work.
              </p>
            </div>

            {!selectedItemId ? (
              <div className="rounded-md bg-blue-50 p-4 text-sm text-blue-800">
                Select a product to inspect its barcode set.
              </div>
            ) : itemQuery.isLoading ? (
              <p className="text-sm text-gray-600">
                Loading product details...
              </p>
            ) : itemQuery.isError ? (
              <div className="rounded-md bg-red-50 p-4 text-sm text-red-800">
                Failed to load product details.
              </div>
            ) : !selectedItem ? (
              <div className="rounded-md bg-yellow-50 p-4 text-sm text-yellow-800">
                Product not found.
              </div>
            ) : (
              <div className="space-y-6">
                <div>
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h3 className="text-2xl font-bold text-gray-900">
                        {selectedItem.name}
                      </h3>
                      {selectedItem.skus.length > 0 && (
                        <p className="mt-2 text-sm font-medium uppercase tracking-wide text-blue-700">
                          {formatSkuSummary(selectedItem.skus)}
                        </p>
                      )}
                      <p className="mt-2 text-sm text-gray-600">
                        {selectedItem.description ||
                          "No description recorded for this product."}
                      </p>
                    </div>
                    <span className="inline-flex items-center rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-800">
                      {selectedItem.barcode_count} barcode
                      {selectedItem.barcode_count === 1 ? "" : "s"}
                    </span>
                  </div>
                </div>

                <div>
                  <h4 className="text-sm font-semibold text-gray-900 mb-3">
                    Registered SKUs
                  </h4>
                  {selectedItem.skus.length === 0 ? (
                    <div className="rounded-md bg-yellow-50 p-4 text-sm text-yellow-800">
                      This product has no SKUs yet.
                    </div>
                  ) : (
                    <ul className="space-y-2">
                      {selectedItem.skus.map((sku) => (
                        <li
                          key={sku}
                          className="rounded-md border border-gray-200 px-3 py-2 text-sm font-mono text-gray-700"
                        >
                          {sku}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <div>
                  <h4 className="text-sm font-semibold text-gray-900 mb-3">
                    Registered Barcodes
                  </h4>
                  {selectedItem.barcodes.length === 0 ? (
                    <div className="rounded-md bg-yellow-50 p-4 text-sm text-yellow-800">
                      This product has no barcodes yet. Add one before using
                      scan-first stock flows.
                    </div>
                  ) : (
                    <ul className="space-y-2">
                      {selectedItem.barcodes.map((barcode) => (
                        <li
                          key={barcode}
                          className="rounded-md border border-gray-200 px-3 py-2 text-sm font-mono text-gray-700"
                        >
                          {barcode}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                {isOwner && (
                  <div className="space-y-6">
                    <form className="space-y-3" onSubmit={handleAddSku}>
                      <div className="flex items-center justify-between gap-4">
                        <h4 className="text-sm font-semibold text-gray-900">
                          Add SKU
                        </h4>
                      </div>

                      {newSkuError && (
                        <div className="rounded-md bg-red-50 p-4 text-sm text-red-800">
                          {newSkuError}
                        </div>
                      )}

                      {newSkuSuccess && (
                        <div className="rounded-md bg-green-50 p-4 text-sm text-green-800">
                          {newSkuSuccess}
                        </div>
                      )}

                      <div className="flex gap-3">
                        <input
                          type="text"
                          value={newSku}
                          onChange={(event) => setNewSku(event.target.value)}
                          maxLength={100}
                          className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                          placeholder="Enter a new SKU"
                          disabled={addSkuMutation.isPending}
                        />
                        <button
                          type="submit"
                          className="inline-flex justify-center rounded-md border border-transparent bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                          disabled={addSkuMutation.isPending}
                        >
                          {addSkuMutation.isPending ? "Saving..." : "Add"}
                        </button>
                      </div>
                    </form>

                    <form className="space-y-3" onSubmit={handleAddBarcode}>
                      <div className="flex items-center justify-between gap-4">
                        <h4 className="text-sm font-semibold text-gray-900">
                          Add Barcode
                        </h4>
                      </div>

                      {newBarcodeError && (
                        <div className="rounded-md bg-red-50 p-4 text-sm text-red-800">
                          {newBarcodeError}
                        </div>
                      )}

                      {newBarcodeSuccess && (
                        <div className="rounded-md bg-green-50 p-4 text-sm text-green-800">
                          {newBarcodeSuccess}
                        </div>
                      )}

                      <div className="flex gap-3">
                        <input
                          type="text"
                          value={newBarcode}
                          onChange={(event) =>
                            setNewBarcode(event.target.value)
                          }
                          maxLength={200}
                          className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                          placeholder="Scan or enter a new barcode"
                          disabled={addBarcodeMutation.isPending}
                        />
                        <button
                          type="button"
                          onClick={() => setShowAddBarcodeScanner(true)}
                          className="inline-flex justify-center rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                        >
                          📷
                        </button>
                        <button
                          type="submit"
                          className="inline-flex justify-center rounded-md border border-transparent bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                          disabled={addBarcodeMutation.isPending}
                        >
                          {addBarcodeMutation.isPending ? "Saving..." : "Add"}
                        </button>
                      </div>
                    </form>
                  </div>
                )}
              </div>
            )}
          </section>
        </div>
      </div>
      {showAddBarcodeScanner && (
        <ScanOverlay
          onBarcodeScan={(value) => {
            setNewBarcode(value);
            setShowAddBarcodeScanner(false);
          }}
          onClose={() => setShowAddBarcodeScanner(false)}
        />
      )}
      {showCreateBarcodeScanner !== null && (
        <ScanOverlay
          onBarcodeScan={(value) => {
            handleBarcodeChange(showCreateBarcodeScanner, value);
            setShowCreateBarcodeScanner(null);
          }}
          onClose={() => setShowCreateBarcodeScanner(null)}
        />
      )}
    </div>
  );
}
