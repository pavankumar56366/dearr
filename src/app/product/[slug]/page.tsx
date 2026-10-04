import { cache } from "react";
import type { Metadata } from "next";
import { findProductBySlug, getRelatedProducts } from "@/lib/server";
import {
  ProductDetailsClient,
  ProductNotFound,
} from "@/components/customer/product";

export const dynamic = "force-dynamic";

interface ProductPageProps {
  params: Promise<{
    slug: string;
  }>;
}

/**
 * Deduplicated per-request product fetch across generateMetadata and ProductPage component.
 */
const getCachedProduct = cache(async (slug: string) => {
  return findProductBySlug(slug, false);
});

/**
 * Dynamic metadata generation for SEO and social sharing.
 * Queries actual active product from Hostinger MySQL (memoized per-request).
 */
export async function generateMetadata({
  params,
}: ProductPageProps): Promise<Metadata> {
  const { slug } = await params;
  const cleanSlug = slug?.trim().toLowerCase();

  try {
    const product = await getCachedProduct(cleanSlug);

    if (!product || !product.isActive) {
      return {
        title: "Product Not Found — Dearr | 3D Printed Products",
        description: "The requested 3D printed product could not be found.",
      };
    }

    const firstImage =
      product.images?.[0]?.url ||
      product.images?.[0]?.storagePath ||
      "/product-samples/1.jpeg";

    return {
      title: `${product.name} — Dearr | 3D Printed Products`,
      description: product.description,
      openGraph: {
        title: `${product.name} | Dearr 3D Printing`,
        description: product.description,
        images: [
          {
            url: firstImage,
            width: 800,
            height: 800,
            alt: `${product.name} — Precision 3D Printed`,
          },
        ],
      },
    };
  } catch (err) {
    console.error("[Product Metadata Fetch Error]", err);
    return {
      title: "Dearr | 3D Printed Products",
      description: "Precision 3D printed products.",
    };
  }
}

/**
 * Product Details Page
 * Route: /product/[slug]
 *
 * Connects directly to Hostinger MySQL via getCachedProduct and getRelatedProducts.
 */
export default async function ProductPage({ params }: ProductPageProps) {
  const { slug } = await params;
  const cleanSlug = slug?.trim().toLowerCase();

  let product = null;
  let relatedProducts: any[] = [];

  try {
    product = await getCachedProduct(cleanSlug);

    if (product && product.isActive) {
      // Single query for related products in same category/catalog
      relatedProducts = await getRelatedProducts(product.id, product.categoryId, 4);
    }
  } catch (err: unknown) {
    console.error("[Product Page Server Error]", err);
  }

  if (!product || !product.isActive) {
    return <ProductNotFound slug={cleanSlug} />;
  }

  return (
    <ProductDetailsClient
      initialProduct={product}
      initialRelatedProducts={relatedProducts}
      slug={cleanSlug}
    />
  );
}
