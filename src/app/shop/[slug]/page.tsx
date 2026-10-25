import { redirect } from "next/navigation";

interface ShopProductRedirectProps {
  params: Promise<{
    slug: string;
  }>;
}

export default async function ShopProductRedirect({ params }: ShopProductRedirectProps) {
  const { slug } = await params;
  redirect(`/product/${slug}`);
}
