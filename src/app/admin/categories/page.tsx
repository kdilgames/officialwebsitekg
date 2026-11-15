import { FolderTree, Sparkles } from "lucide-react";

import { CategoryForm } from "@/components/admin/admin-forms";
import { ActionButton, StateActionButton } from "@/components/admin/action-forms";
import { EmptyState } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import {
  createCategoryAction,
  deleteCategoryAction,
  seedDefaultSubcategoriesAction,
  toggleCategoryAction,
  updateCategoryAction,
} from "@/lib/admin/actions";
import { listAllCategories } from "@/lib/admin/queries";
import {
  DEFAULT_PARENT_CATEGORIES,
  DEFAULT_SUBCATEGORIES,
} from "@/lib/catalog-hierarchy";

export const dynamic = "force-dynamic";
export const metadata = { title: "Categories · Admin" };

export default async function AdminCategoriesPage() {
  const categories = await listAllCategories();
  const names = new Map<string, string>(categories.map((category: any) => [category.id, category.name]));
  const options = categories.map((category: any) => ({ id: category.id, name: category.name }));
  const existingSlugs = new Set(categories.map((category: { slug: string }) => category.slug));
  const missingDefaultsCount =
    DEFAULT_PARENT_CATEGORIES.filter((entry) => !existingSlugs.has(entry.slug)).length +
    DEFAULT_SUBCATEGORIES.filter((entry) => !existingSlugs.has(entry.slug)).length;

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-[18px] font-semibold tracking-tight">Categories</h1>
          <p className="muted mt-1 text-[12.5px]">
            Categories are managed here and appear in the storefront navigation. A category can only
            be deleted when it holds no products and no sub-categories.
          </p>
        </div>
      </header>

      {missingDefaultsCount > 0 ? (
        <Card>
          <CardHeader
            title="Default subcategories pack"
            description={`${missingDefaultsCount} built-in category or subcategory slug${missingDefaultsCount === 1 ? " is" : "s are"} not in the database yet (e.g. Roblox Scripts, Game setups, Maps, Vehicles, Weapons, Models, Clothing, Graphics & UI, Animations & VFX, Audio).`}
          />
          <CardBody className="flex flex-wrap items-center justify-between gap-3">
            <p className="muted max-w-2xl text-[12.5px]">
              Add all missing default top-level ecosystems and subcategories safely without touching
              or overwriting anything you already customized.
            </p>
            <StateActionButton
              action={seedDefaultSubcategoriesAction}
              fields={{}}
              variant="primary"
              pendingLabel="Adding subcategories…"
            >
              <Sparkles className="size-3.5" aria-hidden />
              Add {missingDefaultsCount} default categories &amp; subcategories
            </StateActionButton>
          </CardBody>
        </Card>
      ) : null}

      <Card>
        <CardHeader
          title="New category"
          description="Slugs must be unique and are used in storefront URLs."
        />
        <CardBody>
          <CategoryForm action={createCategoryAction} categories={options} />
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title={`${categories.length} categor${categories.length === 1 ? "y" : "ies"}`}
          description="Sorted by sort order, then name."
        />

        {categories.length === 0 ? (
          <EmptyState
            title="No categories yet"
            description="Create the first category so sellers have somewhere to list products."
            icon={<FolderTree className="size-5" aria-hidden />}
          />
        ) : (
          <ul className="divide-y divide-line">
            {categories.map((category: any) => (
              <li key={category.id} className="space-y-3 px-4 py-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="truncate text-[13.5px] font-medium">{category.name}</span>
                      {category.isActive ? (
                        <Badge tone="positive">active</Badge>
                      ) : (
                        <Badge tone="caution">hidden</Badge>
                      )}
                      {category.parentId ? (
                        <Badge>in {names.get(category.parentId) ?? "unknown"}</Badge>
                      ) : (
                        <Badge tone="accent">top level</Badge>
                      )}
                    </div>
                    <p className="subtle mt-0.5 font-mono text-[11.5px]">/{category.slug}</p>
                    {category.description ? (
                      <p className="muted mt-1 text-[12.5px]">{category.description}</p>
                    ) : null}
                    <p className="subtle mt-0.5 text-[11.5px]">
                      {category._count.products} product
                      {category._count.products === 1 ? "" : "s"} · {category._count.children}{" "}
                      sub-categor{category._count.children === 1 ? "y" : "ies"} · sort order{" "}
                      {category.sortOrder}
                      {category.icon ? ` · icon ${category.icon}` : ""}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-start gap-2">
                    <ActionButton
                      action={toggleCategoryAction}
                      fields={{ categoryId: category.id }}
                    >
                      {category.isActive ? "Hide" : "Show"}
                    </ActionButton>
                    {category._count.products === 0 && category._count.children === 0 ? (
                      <ActionButton
                        action={deleteCategoryAction}
                        fields={{ categoryId: category.id }}
                        variant="danger"
                        confirm={`Delete “${category.name}”? This cannot be undone.`}
                      >
                        Delete
                      </ActionButton>
                    ) : (
                      <span className="subtle self-center text-[11.5px]">
                        Cannot be deleted while in use
                      </span>
                    )}
                  </div>
                </div>

                <details>
                  <summary className="cursor-pointer text-[12px] text-ink-muted hover:text-ink">
                    Edit category
                  </summary>
                  <div className="surface-elevated mt-2 p-3">
                    <CategoryForm
                      action={updateCategoryAction}
                      categories={options.filter((option: any) => option.id !== category.id)}
                      categoryId={category.id}
                      idPrefix={`cat-${category.id}-`}
                      submitLabel="Save category"
                      defaults={{
                        name: category.name,
                        slug: category.slug,
                        description: category.description ?? "",
                        icon: category.icon ?? "",
                        parentId: category.parentId ?? "",
                        sortOrder: String(category.sortOrder),
                        isActive: category.isActive,
                      }}
                    />
                  </div>
                </details>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
